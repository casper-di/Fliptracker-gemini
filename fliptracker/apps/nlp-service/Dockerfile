# 1. Base Image
FROM python:3.12-slim

# 2. Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# 3. Install System Dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 4. Install Heavy Python Dependencies (Cached)
# We install torch and gdown first to keep them in a separate layer
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir gdown uvicorn

# 5. Install App Requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 6. Prepare for Model Download
# We define this as an ARG so Render can pass your Env Var into the build process
ARG MODELS_GDRIVE_ID
COPY download_models.sh /app/
RUN chmod +x /app/download_models.sh

# 7. BUILD-TIME DOWNLOAD
# This is the "Magic" step. By running this during 'docker build', 
# the models become part of the image layer.
RUN /app/download_models.sh

# 8. Pre-cache CamemBERT base (optional but recommended)
RUN python -c "from transformers import CamembertTokenizer, CamembertForSequenceClassification; \
    CamembertTokenizer.from_pretrained('camembert-base'); \
    CamembertForSequenceClassification.from_pretrained('camembert-base')"

# 9. Copy Source Code (Done last because it changes most often)
COPY src/ src/

# 10. Port & Healthcheck
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 11. STARTUP COMMAND
# Since models are already downloaded, we start the API instantly.
CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]