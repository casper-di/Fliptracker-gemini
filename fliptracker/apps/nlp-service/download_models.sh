#!/bin/bash
set -e

echo "📥 Downloading NLP models from Google Drive..."

if [ -z "$MODELS_GDRIVE_ID" ]; then
    echo "❌ MODELS_GDRIVE_ID not set!"
    echo "⚠️  Starting with blank models..."
    mkdir -p /app/trained_models
    exit 0
fi

echo "📦 File ID: ${MODELS_GDRIVE_ID}"

# Install gdown (Python tool for Google Drive)
pip install --no-cache-dir gdown

# Download using gdown (handles large files correctly)
gdown --id "${MODELS_GDRIVE_ID}" -O /tmp/models.tar.gz

# Verify download
if [ ! -f /tmp/models.tar.gz ] || [ ! -s /tmp/models.tar.gz ]; then
    echo "❌ Download failed or file is empty!"
    mkdir -p /app/trained_models
    exit 1
fi

FILE_SIZE=$(du -sh /tmp/models.tar.gz | cut -f1)
echo "✅ Downloaded ${FILE_SIZE}"

echo "📂 Extracting models..."
mkdir -p /app/trained_models
tar -xzf /tmp/models.tar.gz -C /app/trained_models --strip-components=1

rm -f /tmp/models.tar.gz

echo "✅ Models ready!"
echo ""
echo "=== Models structure ==="
ls -la /app/trained_models/
echo ""
echo "=== Model sizes ==="
du -sh /app/trained_models/*