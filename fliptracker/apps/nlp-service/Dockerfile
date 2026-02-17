FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    # 1. CHANGE CETTE VERSION pour forcer le téléchargement si tu mets à jour le Drive
    MODEL_VERSION="2025_v4_97percent" \
    MODELS_GDRIVE_ID=1JhLK017B9t7Id1ZXu4Pmu4dvPsnrODWC

WORKDIR /app

# ========================================
# 1. System dependencies
# ========================================
RUN apt-get update && \
    apt-get install -y build-essential curl && \
    rm -rf /var/lib/apt/lists/*

# ========================================
# 2. Python dependencies
# ========================================
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt && \
    pip install gdown langdetect beautifulsoup4

# ========================================
# 3. Download base spaCy models
# ========================================
RUN python -m spacy download fr_core_news_sm

# ========================================
# 4. Download and extract custom models
# ========================================
RUN mkdir -p /app/trained_models && \
    python3 << 'EOF'
import gdown
import zipfile
import tarfile
import os
import sys
import shutil

gdrive_id = os.environ.get('MODELS_GDRIVE_ID')
zip_file = '/tmp/models.zip'
extract_dir = '/tmp/models_extracted'

print(f"🚀 Version du modèle : {os.environ.get('MODEL_VERSION')}")

try:
    # Téléchargement
    url = f"https://drive.google.com/uc?id={gdrive_id}"
    gdown.download(url, zip_file, quiet=False)
    
    # Extraction ZIP
    with zipfile.ZipFile(zip_file, 'r') as z:
        z.extractall(extract_dir)
    
    # Extraction du TAR.GZ (ton modèle spaCy)
    tar_path = os.path.join(extract_dir, 'nlp-models.tar.gz')
    if os.path.exists(tar_path):
        with tarfile.open(tar_path, 'r:gz') as t:
            t.extractall('/app/trained_models')
        print("✅ Extraction réussie dans /app/trained_models")
    else:
        # Si le fichier n'est pas dans un zip mais direct
        print("⚠️ nlp-models.tar.gz non trouvé, vérification du contenu extrait...")
        print(os.listdir(extract_dir))

    # Nettoyage
    os.remove(zip_file)
    shutil.rmtree(extract_dir)

except Exception as e:
    print(f"❌ ERREUR CRITIQUE : {e}")
    sys.exit(1)
EOF

# ========================================
# 5. VERIFICATION POST-INSTALL (Regarde tes logs de build !)
# ========================================
RUN echo "--- CONTENU DU DOSSIER MODELS ---" && \
    ls -R /app/trained_models && \
    echo "--- FIN VERIFICATION ---"

# ========================================
# 6. Copy source code
# ========================================
COPY src/ src/

# ========================================
# 7. Expose and Run
# ========================================
EXPOSE 8000

CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]