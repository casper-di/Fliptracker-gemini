# 1. Image de base légère
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# 3. Installation des dépendances système
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# 4. Copie et installation des dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir langdetect beautifulsoup4 gdown

# 5. Téléchargement des modèles spaCy
RUN python -m spacy download fr_core_news_sm && \
    python -m spacy download en_core_web_sm

# 6. COPIE ET EXÉCUTION DU SCRIPT DE TÉLÉCHARGEMENT
COPY download.sh /tmp/download.sh
RUN chmod +x /tmp/download.sh && bash /tmp/download.sh && rm /tmp/download.sh

# 7. ÉLAGAGE DES MODÈLES (enlever les word vectors pour réduire la taille)
RUN python << 'EOF'
import os
import spacy
from pathlib import Path

print("\n🔍 Compressing models...")
models_dir = Path("/app/trained_models")

for model_path in models_dir.glob("*/model-best"):
    if model_path.exists():
        try:
            model_name = model_path.parent.name
            print(f"\n📦 Processing: {model_name}")
            
            # Taille avant
            import subprocess
            size_before = subprocess.check_output(["du", "-sh", str(model_path)]).decode().split()[0]
            print(f"   Size before: {size_before}")
            
            # Charger et élaguer
            nlp = spacy.load(str(model_path))
            nlp.vocab.vectors.shape = (0, 0)  # Enlever les vecteurs
            nlp.to_disk(str(model_path))  # Overwrite
            
            # Taille après
            size_after = subprocess.check_output(["du", "-sh", str(model_path)]).decode().split()[0]
            print(f"   Size after: {size_after} ✅")
        except Exception as e:
            print(f"   ⚠️  Error: {e}")

# Afficher la taille totale
import subprocess
total_size = subprocess.check_output(["du", "-sh", "/app/trained_models"]).decode().split()[0]
print(f"\n📊 Total trained_models size: {total_size}")
EOF

# 8. Copie du code source
COPY src/ src/

# 9. Configuration du port
EXPOSE 8000

# 10. Démarrage
CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]