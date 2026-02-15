FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    MODELS_GDRIVE_ID=1aVrRnX2k0ycvJAUt2uaFpHp8XttL7SYT

WORKDIR /app

# ========================================
# 1. System dependencies
# ========================================
RUN apt-get update && \
    apt-get install -y build-essential && \
    rm -rf /var/lib/apt/lists/*

# ========================================
# 2. Python dependencies
# ========================================
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt && \
    pip install gdown langdetect beautifulsoup4

# ========================================
# 3. Download spaCy models
# ========================================
RUN python -m spacy download fr_core_news_sm && \
    python -m spacy download en_core_web_sm

# ========================================
# 4. Download and extract custom models from Google Drive
# ========================================
RUN mkdir -p /app/trained_models && \
    python3 << 'EOF'
import gdown
import zipfile
import tarfile
import os
import sys

gdrive_id = os.environ.get('MODELS_GDRIVE_ID', '1aVrRnX2k0ycvJAUt2uaFpHp8XttL7SYT')
zip_file = '/tmp/models.zip'
extract_dir = '/tmp/models_extracted'

print("=" * 50)
print("📥 DOWNLOADING MODELS")
print("=" * 50)

try:
    gdown.download(f"https://drive.google.com/uc?id={gdrive_id}", zip_file, quiet=False)
    print("✅ Download complete\n")
except Exception as e:
    print(f"❌ Download failed: {e}")
    sys.exit(1)

print("=" * 50)
print("📦 EXTRACTING ZIP")
print("=" * 50)

try:
    with zipfile.ZipFile(zip_file, 'r') as z:
        z.extractall(extract_dir)
    print("✅ ZIP extracted\n")
except Exception as e:
    print(f"❌ ZIP extraction failed: {e}")
    sys.exit(1)

print("=" * 50)
print("📦 EXTRACTING TAR.GZ")
print("=" * 50)

tar_file = f'{extract_dir}/nlp-models.tar.gz'
if os.path.exists(tar_file):
    try:
        with tarfile.open(tar_file, 'r:gz') as t:
            t.extractall('/app/trained_models')
        print("✅ TAR.GZ extracted\n")
    except Exception as e:
        print(f"❌ TAR.GZ extraction failed: {e}")
        sys.exit(1)
else:
    print(f"❌ TAR.GZ not found at {tar_file}")
    sys.exit(1)

print("=" * 50)
print("📂 CHECKING MODELS")
print("=" * 50)

os.system("ls -la /app/trained_models/")
print()
os.system("find /app/trained_models -type d | head -10")
print()

# Cleanup
os.remove(zip_file)
if os.path.exists(extract_dir):
    import shutil
    shutil.rmtree(extract_dir)

print("=" * 50)
print("✅ MODELS READY")
print("=" * 50)

EOF

# ========================================
# 5. Copy source code
# ========================================
COPY src/ src/

# ========================================
# 6. Health check
# ========================================
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health', timeout=5)"

# ========================================
# 7. Expose port
# ========================================
EXPOSE 8000

# ========================================
# 8. Run application
# ========================================
CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]