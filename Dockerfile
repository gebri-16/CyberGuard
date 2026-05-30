FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy app files
COPY app/ .

# Download model dari Hugging Face Hub saat startup
COPY download_model.py .

# Expose port 7860 (port default Hugging Face Spaces)
EXPOSE 7860

# Jalankan download model dulu, lalu Flask
CMD python download_model.py && python app.py
