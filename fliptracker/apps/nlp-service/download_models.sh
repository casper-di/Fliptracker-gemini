#!/bin/bash

echo "Downloading models from Google Drive..."

GDRIVE_ID="1aVrRnX2k0ycvJAUt2uaFpHp8XttL7SYT"
OUTPUT_FILE="/tmp/models"

# Download
python3 << 'EOF'
import gdown
print("Downloading...")
gdown.download(f"https://drive.google.com/uc?id={os.environ['GDRIVE_ID']}", "/tmp/models", quiet=False)
EOF

echo "✅ Downloaded"
echo "📂 Extracting models..."

# Check if ZIP or TAR
if file /tmp/models | grep -q "Zip"; then
    echo "Detected ZIP format"
    unzip -q /tmp/models -d /app/trained_models
elif file /tmp/models | grep -q "gzip"; then
    echo "Detected TAR.GZ format"
    tar -xzf /tmp/models -C /app/trained_models
else
    echo "Unknown format"
    file /tmp/models
    exit 1
fi

echo "✅ Models ready!"
ls -la /app/trained_models/

rm -f /tmp/models