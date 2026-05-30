"""
Script ini dijalankan saat container startup.
Download model dari Hugging Face Hub ke folder lokal.

Pastikan kamu sudah upload model ke:
https://huggingface.co/USERNAME/cyberguard-models
"""

import os
from huggingface_hub import hf_hub_download, snapshot_download

# Ganti dengan username Hugging Face kamu
HF_USERNAME = os.environ.get("HF_USERNAME", "gebriyan")
MODEL_REPO  = f"{HF_USERNAME}/cyberguard-models"
MODEL_DIR   = "model/saved"

def download_models():
    print("=" * 50)
    print("  Downloading models from Hugging Face Hub...")
    print("=" * 50)

    os.makedirs(f"{MODEL_DIR}/indobert_cyberguard", exist_ok=True)

    try:
        # Download IndoBERT model
        print("\n[1/2] Downloading IndoBERT model...")
        snapshot_download(
            repo_id=MODEL_REPO,
            local_dir=MODEL_DIR,
            ignore_patterns=["*.md", ".gitattributes"]
        )
        print("✅ IndoBERT downloaded!")

        print("\n✅ Semua model berhasil didownload!")
        print("=" * 50)

    except Exception as e:
        print(f"❌ Error downloading model: {e}")
        print("Pastikan model sudah diupload ke:")
        print(f"https://huggingface.co/{MODEL_REPO}")
        raise

if __name__ == "__main__":
    # Skip download kalau model sudah ada
    if os.path.exists(f"{MODEL_DIR}/indobert_cyberguard/config.json"):
        print("✅ Model sudah ada, skip download.")
    else:
        download_models()
