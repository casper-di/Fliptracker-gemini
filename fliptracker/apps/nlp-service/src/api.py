import time
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from src.extractor import HybridExtractor

nlp_engine: Optional[HybridExtractor] = None

app = FastAPI(title="FlipTracker NLP Hybrid")

def _ensure_engine_loaded():
    """Charge les modèles seulement à la première requête"""
    global nlp_engine
    if nlp_engine is None:
        start = time.time()
        nlp_engine = HybridExtractor()
        print(f"✅ NLP Service ready in {time.time() - start:.2f}s")

class EmailRequest(BaseModel):
    body: str
    subject: str = ""
    sender: str = ""

class BatchRequest(BaseModel):
    emails: List[EmailRequest]

@app.get("/health")
def health():
    return {"status": "ok", "loaded": nlp_engine is not None}

@app.post("/extract")
def extract_one(req: EmailRequest):
    _ensure_engine_loaded()
    
    start = time.time()
    result = nlp_engine.process(req.body, req.subject, req.sender)
    result["processingTimeMs"] = round((time.time() - start) * 1000, 1)
    return result

@app.post("/extract/batch")
def extract_batch(req: BatchRequest):
    _ensure_engine_loaded()
    
    start_total = time.time()
    results = []
    
    print(f"[Batch] Processing {len(req.emails)} emails...")
    
    for email in req.emails:
        res = nlp_engine.process(email.body, email.subject, email.sender)
        results.append(res)
        
    total_time = (time.time() - start_total) * 1000
    
    print(f"results  {results}")
    return {
        "results": results,
        "count": len(results),
        "totalProcessingTimeMs": round(total_time, 1)
    }