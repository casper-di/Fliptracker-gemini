#!/bin/bash
set -e

echo "📥 Downloading NLP models from Google Drive..."

if [ -z "$MODELS_GDRIVE_ID" ]; then
    echo "❌ MODELS_GDRIVE_ID not set!"
    echo "⚠️  Starting with blank models..."
    mkdir -p /app/models
    exit 0
fi

pip install --no-cache-dir gdown

gdown --id "${MODELS_GDRIVE_ID}" -O /tmp/models.tar.gz

if [ ! -f /tmp/models.tar.gz ] || [ ! -s /tmp/models.tar.gz ]; then
    echo "❌ Download failed or file is empty!"
    mkdir -p /app/models
    exit 1
fi

FILE_SIZE=$(du -sh /tmp/models.tar.gz | cut -f1)
echo "✅ Downloaded ${FILE_SIZE}"

echo "📂 Extracting models..."
mkdir -p /app/models
tar -xzf /tmp/models.tar.gz -C /app/models --strip-components=1

rm -f /tmp/models.tar.gz

echo "✅ Models ready!"
ls -la /app/models/
du -sh /app/models/*