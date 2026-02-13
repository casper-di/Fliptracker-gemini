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

# Download from Google Drive (handles large files)
curl -c /tmp/cookies -L \
    "https://drive.google.com/uc?export=download&id=${MODELS_GDRIVE_ID}" \
    -o /tmp/download.html

# Get confirmation token for large files
CONFIRM=$(grep -o 'confirm=[^&]*' /tmp/download.html | sed 's/confirm=//')

if [ -n "$CONFIRM" ]; then
    echo "📦 Large file detected, using confirmation token..."
    curl -b /tmp/cookies -L \
        "https://drive.google.com/uc?export=download&id=${MODELS_GDRIVE_ID}&confirm=${CONFIRM}" \
        -o /tmp/models.tar.gz
else
    curl -L \
        "https://drive.google.com/uc?export=download&id=${MODELS_GDRIVE_ID}" \
        -o /tmp/models.tar.gz
fi

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

rm -f /tmp/models.tar.gz /tmp/cookies /tmp/download.html

echo "✅ Models ready!"
echo ""
echo "=== Models structure ==="
ls -la /app/trained_models/
echo ""
echo "=== Model sizes ==="
du -sh /app/trained_models/*