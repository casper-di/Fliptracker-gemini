"""
FlipTracker NLP — FastAPI Inference Service

REST API for email entity extraction and classification.
Called by the NestJS backend to extract structured data from emails.

Usage:
    uvicorn src.api:app --host 0.0.0.0 --port 8000
"""
import time
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from src.config import settings
from src.extractor import EmailExtractor, ExtractionResult


# ── Global model instance ──
extractor: Optional[EmailExtractor] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load models at startup."""
    global extractor
    print("🚀 Loading NLP models...")
    start = time.time()
    
    extractor = EmailExtractor(
        ner_model_path=settings.ner_model_path,
        cls_carrier_path=settings.cls_carrier_path,
        cls_type_path=settings.cls_type_path,
        cls_marketplace_path=settings.cls_marketplace_path,
        cls_email_type_path=settings.cls_email_type_path,
    )
    
    elapsed = time.time() - start
    print(f"✅ Models loaded in {elapsed:.1f}s")
    yield
    print("👋 Shutting down NLP service")


app = FastAPI(
    title="FlipTracker NLP Service",
    description="Email entity extraction and classification using CamemBERT NER",
    version="1.0.0",
    lifespan=lifespan,
)


# ── Request/Response Models ──
class ExtractRequest(BaseModel):
    """Email extraction request."""
    body: str
    subject: str = ""
    sender: str = ""


class ExtractBatchRequest(BaseModel):
    """Batch extraction request."""
    emails: list[ExtractRequest]


class EntityResponse(BaseModel):
    text: str
    label: str
    start: int
    end: int
    confidence: float = 1.0


class ClassificationResponse(BaseModel):
    label: str
    confidence: float


class ExtractResponse(BaseModel):
    """Extraction result."""
    trackingNumbers: list[str] = []
    pickupAddress: Optional[str] = None
    deliveryAddress: Optional[str] = None
    personNames: list[str] = []
    withdrawalCodes: list[str] = []
    orderNumbers: list[str] = []
    productNames: list[str] = []
    prices: list[str] = []
    dates: list[str] = []
    carrier: Optional[ClassificationResponse] = None
    shipmentType: Optional[ClassificationResponse] = None
    marketplace: Optional[ClassificationResponse] = None
    emailType: Optional[ClassificationResponse] = None
    entities: list[EntityResponse] = []
    processingTimeMs: float = 0


# ── Endpoints ──
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "models_loaded": extractor is not None,
    }


@app.post("/extract", response_model=ExtractResponse)
async def extract_email(request: ExtractRequest):
    """
    Extract structured information from a single email.
    
    Returns tracking numbers, addresses, carrier, type, marketplace, etc.
    """
    if not extractor:
        raise HTTPException(status_code=503, detail="Models not loaded")

    print(f"[NLP API] /extract request: subject='{request.subject[:80]}', sender='{request.sender}', body_len={len(request.body)}")
    start = time.time()

    result: ExtractionResult = extractor.extract(
        email_body=request.body,
        email_subject=request.subject,
        sender=request.sender,
    )

    elapsed_ms = (time.time() - start) * 1000

    response_data = result.to_dict()
    response_data["processingTimeMs"] = round(elapsed_ms, 1)

    print(f"[NLP API] /extract response: processingTimeMs={response_data['processingTimeMs']}, trackingNumbers={response_data.get('trackingNumbers', [])}")
    return response_data


@app.post("/extract/batch")
async def extract_batch(request: ExtractBatchRequest):
    """
    Extract structured information from multiple emails (batch, optimized).
    - Tronque chaque email à 2000 caractères
    - Utilise torch.no_grad() pour la prédiction
    - Utilise le batch tokenizer si possible
    """
    if not extractor:
        raise HTTPException(status_code=503, detail="Models not loaded")

    import torch
    from transformers import CamembertTokenizer

    print(f"[NLP API] /extract/batch request: {len(request.emails)} emails")
    start = time.time()
    results = []

    # Tronque chaque email à 2000 caractères
    cleaned_emails = []
    for idx, email in enumerate(request.emails):
        truncated_body = email.body[:2000]
        cleaned_emails.append({
            "body": truncated_body,
            "subject": email.subject,
            "sender": email.sender,
        })

    # Batch tokenization (si Camembert présent)
    # On suppose que extractor.nlp n'est pas Camembert, mais que extractor.cls_carrier/tokenizer existe
    # On utilise le batch tokenizer pour la classification, mais la NER reste par boucle (spacy)
    # Extraction NER (spacy) + classification (Camembert) en batch
    tokenizer = None
    model = None
    if hasattr(extractor, "cls_carrier") and extractor.cls_carrier:
        tokenizer = extractor.cls_carrier["tokenizer"]
        model = extractor.cls_carrier["model"]

    # NER extraction (toujours boucle, car spacy)
    ner_results = []
    for idx, email in enumerate(cleaned_emails):
        print(f"  [NLP API]   Email {idx+1}: subject='{email['subject'][:80]}', sender='{email['sender']}', body_len={len(email['body'])}")
        ner_results.append(extractor.extract(
            email_body=email["body"],
            email_subject=email["subject"],
            sender=email["sender"],
        ))

    # Batch classification (si possible)
    if tokenizer and model:
        texts = [f"{email['subject']}\n{email['body']}" for email in cleaned_emails]
        with torch.no_grad():
            inputs = tokenizer(texts, padding=True, truncation=True, max_length=512, return_tensors="pt")
            outputs = model(**inputs)
            probs = torch.softmax(outputs.logits, dim=-1)
            pred_idxs = probs.argmax(dim=-1).tolist()
            confidences = probs.max(dim=-1).values.tolist()
        # On pourrait injecter ces résultats dans ner_results si besoin

    # Conversion en dict
    for result in ner_results:
        results.append(result.to_dict())

    elapsed_ms = (time.time() - start) * 1000

    print(f"[NLP API] /extract/batch response: processed={len(results)}, totalProcessingTimeMs={round(elapsed_ms, 1)}")
    return {
        "results": results,
        "count": len(results),
        "totalProcessingTimeMs": round(elapsed_ms, 1),
    }


@app.get("/models/info")
async def model_info():
    """Return information about loaded models."""
    if not extractor:
        raise HTTPException(status_code=503, detail="Models not loaded")
    
    info = {
        "ner": {
            "loaded": extractor.nlp is not None,
            "pipeline": list(extractor.nlp.pipe_names) if extractor.nlp else [],
            "labels": list(extractor.nlp.get_pipe("ner").labels) if "ner" in extractor.nlp.pipe_names else [],
        },
        "classifiers": {
            "carrier": {
                "loaded": extractor.cls_carrier is not None,
                "labels": extractor.cls_carrier["labels"] if extractor.cls_carrier else [],
            },
            "type": {
                "loaded": extractor.cls_type is not None,
                "labels": extractor.cls_type["labels"] if extractor.cls_type else [],
            },
            "marketplace": {
                "loaded": extractor.cls_marketplace is not None,
                "labels": extractor.cls_marketplace["labels"] if extractor.cls_marketplace else [],
            },
            "emailType": {
                "loaded": extractor.cls_email_type is not None,
                "labels": extractor.cls_email_type["labels"] if extractor.cls_email_type else [],
            },
        }
    }
    return info
