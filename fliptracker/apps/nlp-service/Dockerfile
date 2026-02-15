FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    MODELS_GDRIVE_ID=1aVrRnX2k0ycvJAUt2uaFpHp8XttL7SYT

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt && \
    pip install gdown langdetect beautifulsoup4

# Download spaCy models
RUN python -m spacy download fr_core_news_sm && \
    python -m spacy download en_core_web_sm

# Download custom models from Google Drive
RUN python3 << 'EOF'
import gdown
import zipfile
import os
import sys

gdrive_id = os.environ.get('MODELS_GDRIVE_ID', '1aVrRnX2k0ycvJAUt2uaFpHp8XttL7SYT')
output = '/tmp/models.zip'

print(f"Downloading from Google Drive...")
try:
    gdown.download(f"https://drive.google.com/uc?id={gdrive_id}", output, quiet=False)
    print("✅ Downloaded")
except Exception as e:
    print(f"❌ Download failed: {e}")
    sys.exit(1)

print("📂 Extracting models...")
try:
    with zipfile.ZipFile(output, 'r') as zip_ref:
        zip_ref.extractall('/app/trained_models')
    print("✅ Extracted")
except Exception as e:
    print(f"❌ Extraction failed: {e}")
    sys.exit(1)

print("✅ Models ready!")
os.system("ls -la /app/trained_models/")
os.remove(output)
EOF

# Copy source code
COPY src/ src/

EXPOSE 8000

CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]