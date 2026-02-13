FROM python:3.12-slim

WORKDIR /app

# System dependencies for spaCy + transformers
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch CPU-only first (much smaller than CUDA version)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install remaining Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download CamemBERT tokenizer + model weights (cached in image)
RUN python -c "from transformers import CamembertTokenizer, CamembertForSequenceClassification; \
    CamembertTokenizer.from_pretrained('camembert-base'); \
    CamembertForSequenceClassification.from_pretrained('camembert-base')"

# Copy source code
COPY src/ src/

# 🔥 NOUVEAU : Copier les modèles entraînés
COPY trained_models/ /app/trained_models/

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run
CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Structure de ton projet** :
```
fliptracker/apps/nlp-service/
├── Dockerfile
├── requirements.txt
├── src/
│   └── api.py
└── trained_models/          # 🔥 AJOUTE CE DOSSIER
    ├── ner_model/
    │   └── model-best/
    ├── cls_carrier/
    │   └── model-best/
    ├── cls_type/
    │   └── model-best/
    ├── cls_marketplace/
    │   └── model-best/
    └── cls_email_type/
        └── model-best/