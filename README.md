# CyberGuard - Deteksi Cyberbullying Bahasa Indonesia

Sistem AI untuk mendeteksi dan mengklasifikasikan komentar/chat Bahasa Indonesia ke dalam 4 kategori:

| Label | Deskripsi |
|---|---|
| Abusive | Kata kasar atau makian |
| Hate Speech | Ujaran kebencian / rasis |
| Harassment | Pelecehan atau intimidasi |
| Normal | Komentar biasa, aman |

## Tech Stack
- **Backend:** Flask (Python)
- **Model Utama:** IndoBERT (`indobenchmark/indobert-base-p1`) — akurasi 92%
- **Model Fallback:** SVM + TF-IDF — untuk Bulk CSV
- **Dataset:** ~19.500 data komentar Bahasa Indonesia (setelah dedup)

## Fitur
- Single Text Detection — analisis satu komentar dengan confidence score
- Bulk CSV Analysis — upload CSV, deteksi semua baris sekaligus
- Dashboard Analitik — visualisasi distribusi hasil deteksi

## Cara Menjalankan

### 1. Clone repo
```bash