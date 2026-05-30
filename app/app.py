import pickle
import re
import os
import io
import torch
import torch.nn.functional as F
import pandas as pd
from flask import Flask, request, jsonify, render_template, send_file
from transformers import AutoTokenizer, AutoModelForSequenceClassification

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "model", "saved")
BERT_PATH = os.path.join(MODEL_DIR, "indobert_cyberguard")

# ============================================================
#  LOAD INDOBERT (MODEL UTAMA)
# ============================================================
bert_tokenizer = AutoTokenizer.from_pretrained(BERT_PATH)
bert_model     = AutoModelForSequenceClassification.from_pretrained(BERT_PATH)
bert_model.eval()

ID2LABEL = bert_model.config.id2label
print("✅ IndoBERT loaded. Labels:", ID2LABEL)

# ============================================================
#  LOAD SVM (FALLBACK & BULK)
# ============================================================
try:
    with open(os.path.join(MODEL_DIR, "svm_model.pkl"), "rb") as f:
        svm_model = pickle.load(f)
    with open(os.path.join(MODEL_DIR, "tfidf_vectorizer.pkl"), "rb") as f:
        tfidf_vectorizer = pickle.load(f)
    SVM_AVAILABLE = True
    print("✅ SVM fallback loaded.")
except Exception as e:
    SVM_AVAILABLE = False
    print(f"⚠️  SVM tidak tersedia: {e}")


# ============================================================
#  PREPROCESSING
# ============================================================
def preprocess(text: str) -> str:
    text = text.lower()
    text = re.sub(r"http\S+|www\S+", "", text)
    text = re.sub(r"@\w+|#\w+", "", text)
    text = re.sub(r"\buser\b", " ", text)
    text = re.sub(r"[^a-z\s!?]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


# ============================================================
#  PREDIKSI INDOBERT
# ============================================================
def predict_bert(text: str) -> dict:
    inputs = bert_tokenizer(
        text, return_tensors="pt",
        truncation=True, max_length=128, padding=True
    )
    with torch.no_grad():
        logits = bert_model(**inputs).logits

    probs    = F.softmax(logits, dim=-1)[0]
    label_id = int(probs.argmax())
    label    = ID2LABEL[label_id]
    conf     = round(float(probs.max()) * 100, 1)

    probabilities = {
        ID2LABEL[i]: round(float(probs[i]) * 100, 1)
        for i in range(len(ID2LABEL))
    }

    return {
        "prediction":    label,
        "confidence":    conf,
        "probabilities": probabilities,
        "model_used":    "IndoBERT"
    }


# ============================================================
#  PREDIKSI SVM
# ============================================================
def predict_svm(text: str) -> dict:
    vec   = tfidf_vectorizer.transform([text])
    label = svm_model.predict(vec)[0]
    probs = svm_model.predict_proba(vec)[0]
    conf  = round(float(probs.max()) * 100, 1)

    classes = svm_model.classes_
    probabilities = {
        classes[i]: round(float(probs[i]) * 100, 1)
        for i in range(len(classes))
    }

    return {
        "prediction":    str(label),
        "confidence":    conf,
        "probabilities": probabilities,
        "model_used":    "SVM"
    }


# ============================================================
#  PREDICT SATU TEKS — IndoBERT utama, SVM fallback
#  (dipakai oleh route /predict)
# ============================================================
def predict_one(text: str) -> dict:
    clean = preprocess(text)
    try:
        result = predict_bert(clean)
    except Exception as e:
        print(f"IndoBERT error: {e}")
        if SVM_AVAILABLE:
            result = predict_svm(clean)
        else:
            return {"error": str(e)}

    result["low_confidence"] = result["confidence"] < 65
    if result["low_confidence"]:
        result["warning"] = "Prediksi kurang yakin, perlu review manual"
    return result


# ============================================================
#  ROUTES
# ============================================================
@app.route("/")
def index():
    return render_template("index.html")


# ── Single predict (IndoBERT) ─────────────────────────────
@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()
    if not data or not data.get("text", "").strip():
        return jsonify({"error": "Teks tidak boleh kosong."}), 400

    result = predict_one(data["text"].strip())
    if "error" in result:
        return jsonify(result), 500
    return jsonify(result)


# ── Bulk predict via CSV (SVM — cepat) ───────────────────
@app.route("/bulk", methods=["POST"])
def bulk():
    if "file" not in request.files:
        return jsonify({"error": "File tidak ditemukan."}), 400

    file = request.files["file"]
    if not file.filename.endswith(".csv"):
        return jsonify({"error": "Hanya file .csv yang diterima."}), 400

    try:
        df = pd.read_csv(file)
    except Exception as e:
        return jsonify({"error": f"Gagal membaca CSV: {e}"}), 400

    # Cari kolom teks secara fleksibel
    text_col = None
    for col in ["text", "chat", "comment", "komentar", "teks"]:
        if col in df.columns:
            text_col = col
            break
    if text_col is None:
        text_col = df.columns[0]

    # Batasi 1000 baris agar tidak terlalu lama
    MAX_ROWS  = 1000
    truncated = len(df) > MAX_ROWS
    if truncated:
        df = df.head(MAX_ROWS)

    results = []
    stats   = {"Abusive": 0, "Normal": 0, "Hate Speech": 0, "Harassment": 0}

    for _, row in df.iterrows():
        teks  = str(row[text_col])
        clean = preprocess(teks)
        # ✅ Bulk pakai SVM — jauh lebih cepat untuk data banyak
        # IndoBERT tetap dipakai di Single Text untuk akurasi lebih tinggi
        res   = predict_svm(clean) if SVM_AVAILABLE else predict_one(teks)
        label = res.get("prediction", "Unknown")
        conf  = res.get("confidence", 0)

        results.append({
            "text":       teks,
            "prediction": label,
            "confidence": conf,
            "model_used": res.get("model_used", "-")
        })
        if label in stats:
            stats[label] += 1

    return jsonify({
        "total":     len(results),
        "results":   results,
        "stats":     stats,
        "truncated": truncated,
        "max_rows":  MAX_ROWS
    })


# ── Download hasil bulk sebagai CSV ──────────────────────
@app.route("/bulk/download", methods=["POST"])
def bulk_download():
    data = request.get_json()
    if not data or "results" not in data:
        return jsonify({"error": "Tidak ada data."}), 400

    df  = pd.DataFrame(data["results"])
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)

    return send_file(
        io.BytesIO(buf.getvalue().encode()),
        mimetype="text/csv",
        as_attachment=True,
        download_name="hasil_cyberguard.csv"
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    app.run(host="0.0.0.0", port=port, debug=False)