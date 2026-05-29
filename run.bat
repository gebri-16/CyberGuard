@echo off
title CyberGuard - AI Cyberbullying Detection
color 0A

echo.
echo  ======================================
echo   CYBERGUARD - Deteksi Cyberbullying
echo  ======================================
echo.
echo  [*] Mengaktifkan virtual environment...
call D:\CyberGuard\app\venv311\Scripts\activate

echo  [*] Menjalankan Flask server...
echo.
echo  Buka browser: http://127.0.0.1:5000
echo  Tekan Ctrl+C untuk menghentikan server
echo.

cd /d D:\CyberGuard\app
python app.py

pause