# 1. Image de base légère
FROM python:3.11-slim

# 2. Variables d'environnement pour optimiser Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# 3. Installation des dépendances système (Sécurité)
# J'ai remis 'build-essential' et 'git' car certaines librairies Python (comme numpy ou pydantic)
# en ont parfois besoin pour s'installer correctement sur Linux.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# 4. Copie et Installation des dépendances Python
COPY requirements.txt .

# ATTENTION : Assure-toi que 'torch' et 'transformers' ne sont PLUS dans ce fichier
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir langdetect beautifulsoup4

# 5. Téléchargement des modèles spaCy (Légers)
# Cela se fait pendant le build, donc ils seront directement dans l'image.
RUN python -m spacy download fr_core_news_lg && \
    python -m spacy download en_core_web_lg

# 6. Copie du code source
COPY src/ src/

# 7. Configuration du port pour Render
EXPOSE 8000

# 8. Healthcheck (Pour que Render sache si l'app a démarré)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 9. Démarrage
CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]