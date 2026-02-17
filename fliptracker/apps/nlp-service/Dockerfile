FROM python:3.11-slim

# Configuration de l'environnement
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    MODEL_VERSION="2025_v4_97percent" \
    MODELS_GDRIVE_ID=13AtAMSQ7VpQT9LdIHEbAlod7nlqZ-q9x

WORKDIR /app

# ========================================
# 1. Dépendances système (unzip et tar sont requis)
# ========================================
RUN apt-get update && \
    apt-get install -y build-essential curl unzip && \
    rm -rf /var/lib/apt/lists/*

# ========================================
# 2. Dépendances Python
# ========================================
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install gdown langdetect beautifulsoup4 lxml

# ========================================
# 3. Modèle spaCy de base (Français)
# ========================================
RUN python -m spacy download fr_core_news_sm

# ========================================
# 4. Téléchargement et Extraction du modèle IA
# ========================================
RUN mkdir -p /app/trained_models /tmp/models_extracted && \
    echo "🚀 Début du téléchargement du modèle..." && \
    gdown --id ${MODELS_GDRIVE_ID} -O /tmp/models.zip && \
    unzip /tmp/models.zip -d /tmp/models_extracted && \
    # Vérification : si le tar.gz est dans le zip, on l'extrait, sinon on copie tout
    if [ -f /tmp/models_extracted/nlp-models.tar.gz ]; then \
        tar -xzf /tmp/models_extracted/nlp-models.tar.gz -C /app/trained_models; \
    else \
        cp -r /tmp/models_extracted/* /app/trained_models/; \
    fi && \
    echo "✅ Modèle installé avec succès" && \
    rm -rf /tmp/models.zip /tmp/models_extracted

# ========================================
# 5. Vérification du dossier (pour débugger dans les logs)
# ========================================
RUN echo "--- STRUCTURE DU DOSSIER MODELS ---" && \
    ls -R /app/trained_models && \
    echo "--- FIN VERIFICATION ---"

# ========================================
# 6. Copie du code source
# ========================================
# On fait ça à la fin pour profiter du cache Docker
COPY src/ src/

# ========================================
# 7. Lancement
# ========================================
EXPOSE 8000

CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]