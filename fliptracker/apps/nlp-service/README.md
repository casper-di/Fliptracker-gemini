# FlipTracker NLP Service

Custom NER + classification service for French parcel email parsing, powered by **CamemBERT**.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  NestJS Backend                                         │
│  POST /nlp/extract → NLP Service → Structured JSON      │
└──────────────┬──────────────────────────────────────────┘
               │ HTTP
┌──────────────▼──────────────────────────────────────────┐
│  FastAPI NLP Service (Python)                           │
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │ CamemBERT NER   │  │ CamemBERT Classifiers        │  │
│  │ - TRACKING      │  │ - Carrier (14 classes)        │  │
│  │ - ADDRESS       │  │ - Type (purchase/sale)        │  │
│  │ - PERSON        │  │ - Marketplace (~20 classes)   │  │
│  │ - WITHDRAWAL    │  │                               │  │
│  │ - ORDER         │  └──────────────────────────────┘  │
│  │ - PRODUCT       │                                    │
│  │ - PRICE / DATE  │                                    │
│  └─────────────────┘                                    │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
cd fliptracker/apps/nlp-service
pip install -r requirements.txt
python -m spacy download fr_core_news_sm  # baseline French model
```

### 2. Export Training Data

Requires Firebase service account credentials.

```bash
# Set Firebase credentials
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Export from Firestore
python training/export_data.py
```

### 3. Prepare Annotations

```bash
python training/prepare_data.py
```

This auto-annotates using existing parsed data as weak labels.

### 4. Train Models

```bash
# Train NER + classifiers
python training/train.py

# Or separately
python training/train.py --ner-only --epochs-ner 30
python training/train.py --classifier-only --epochs-cls 5
```

For transformer-based NER (recommended), use the generated spaCy config:

```bash
python -m spacy train models/ner_config.cfg \
  --output models/ner_model \
  --paths.train data/spacy_docbin/train.spacy \
  --paths.dev data/spacy_docbin/val.spacy \
  --gpu-id -1
```

### 5. Evaluate

```bash
python training/evaluate.py
```

### 6. Run API Server

```bash
uvicorn src.api:app --host 0.0.0.0 --port 8000
```

### 7. Test

```bash
curl -X POST http://localhost:8000/extract \
  -H "Content-Type: application/json" \
  -d '{
    "body": "Votre colis 6A12345678901 est disponible au point relais Mondial Relay situé au 15 rue de la Paix, 75001 Paris.",
    "subject": "Colis disponible",
    "sender": "noreply@mondialrelay.fr"
  }'
```

## API Endpoints

| Method | Path             | Description                         |
|--------|-----------------|-------------------------------------|
| GET    | `/health`       | Health check                        |
| POST   | `/extract`      | Extract from single email           |
| POST   | `/extract/batch`| Extract from multiple emails        |
| GET    | `/models/info`  | Info about loaded models            |

## Docker

```bash
docker build -t fliptracker-nlp .
docker run -p 8000:8000 fliptracker-nlp
```

## Project Structure

```
nlp-service/
├── src/
│   ├── api.py           # FastAPI endpoints
│   ├── config.py        # Settings
│   └── extractor.py     # Model loading + inference
├── training/
│   ├── export_data.py   # Firestore → training JSON
│   ├── prepare_data.py  # Auto-annotation pipeline
│   ├── train.py         # Training script
│   └── evaluate.py      # Evaluation metrics
├── data/                # Training data (git-ignored)
├── models/              # Trained models (git-ignored)
├── requirements.txt
├── Dockerfile
└── README.md
```

## Model Details

- **Backbone**: CamemBERT-base (110M params, French BERT)
- **NER**: spaCy transition-based parser with transformer features
- **Classifiers**: Fine-tuned CamemBERT sequence classification heads
- **Training data**: ~400 emails auto-annotated from existing Firestore data
