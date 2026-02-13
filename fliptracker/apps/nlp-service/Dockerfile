FROM python:3.12-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch CPU-only
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download CamemBERT base
RUN python -c "from transformers import CamembertTokenizer, CamembertForSequenceClassification; \
    CamembertTokenizer.from_pretrained('camembert-base'); \
    CamembertForSequenceClassification.from_pretrained('camembert-base')"

# Copy source code
COPY src/ src/

# Copy download script
COPY download_models.sh /app/
RUN chmod +x /app/download_models.sh

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Download models at startup, then run
CMD ["/bin/bash", "-c", "/app/download_models.sh && uvicorn src.api:app --host 0.0.0.0 --port 8000"]