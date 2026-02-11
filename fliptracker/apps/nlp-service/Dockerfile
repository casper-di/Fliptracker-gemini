FROM python:3.12-slim

WORKDIR /app

# System dependencies for spaCy + transformers
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download CamemBERT tokenizer (cached in image)
RUN python -c "from transformers import CamembertTokenizer; CamembertTokenizer.from_pretrained('camembert-base')"

# Copy source code
COPY src/ src/
COPY models/ models/

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run
CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]
