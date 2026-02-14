# 1. Image de base légère
FROM python:3.11-slim

# 2. Variables d'environnement pour optimiser Python
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

# 4. Copie et Installation des dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir langdetect beautifulsoup4 gdown

# 5. Téléchargement des modèles spaCy (SMALL)
RUN python -m spacy download fr_core_news_sm && \
    python -m spacy download en_core_web_sm

# 6. COPIE ET EXÉCUTION DU SCRIPT DE TÉLÉCHARGEMENT
COPY download_models.sh /tmp/download_models.sh
RUN chmod +x /tmp/download_models.sh && bash /tmp/download_models.sh && rm /tmp/download_models.sh

# 7. COPIE DES MODÈLES LOCAUX (si disponibles)
COPY models /app/models

# 8. Copie du code source
COPY src/ src/

# 9. Configuration du port pour Render
EXPOSE 8000

# 10. Démarrage
CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]