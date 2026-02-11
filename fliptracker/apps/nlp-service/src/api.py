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
    
    start = time.time()
    
    result: ExtractionResult = extractor.extract(
        email_body=request.body,
        email_subject=request.subject,
        sender=request.sender,
    )
    
    elapsed_ms = (time.time() - start) * 1000
    
    response_data = result.to_dict()
    response_data["processingTimeMs"] = round(elapsed_ms, 1)
    
    return response_data


@app.post("/extract/batch")
async def extract_batch(request: ExtractBatchRequest):
    """
    Extract structured information from multiple emails.
    
    Returns list of extraction results.
    """
    if not extractor:
        raise HTTPException(status_code=503, detail="Models not loaded")
    
    start = time.time()
    results = []
    
    for email in request.emails:
        result = extractor.extract(
            email_body=email.body,
            email_subject=email.subject,
            sender=email.sender,
        )
        results.append(result.to_dict())
    
    elapsed_ms = (time.time() - start) * 1000
    
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
        }
    }
    return info
