import time
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# On importe NOTRE nouveau moteur
from src.extractor import HybridExtractor

# Variable globale pour stocker le modèle en mémoire
nlp_engine: Optional[HybridExtractor] = None


def _ensure_engine_loaded():
    global nlp_engine
    if nlp_engine is None:
        start = time.time()
        nlp_engine = HybridExtractor()
        print(f"✅ NLP Service ready in {time.time() - start:.2f}s (lazy loaded)")


app = FastAPI(title="FlipTracker NLP Hybrid")


# --- Modèles de données ---
class EmailRequest(BaseModel):
    body: str
    subject: str = ""
    sender: str = ""


class BatchRequest(BaseModel):
    emails: List[EmailRequest]


# --- Endpoints ---


@app.get("/health")
def health():
    _ensure_engine_loaded()
    return {"status": "ok", "loaded": nlp_engine is not None}


@app.post("/extract")
def extract_one(req: EmailRequest):
    _ensure_engine_loaded()
    if not nlp_engine:
        raise HTTPException(503, "NLP Engine not ready")
    start = time.time()
    result = nlp_engine.process(req.body, req.subject, req.sender)
    process_time = (time.time() - start) * 1000
    # On ajoute les métriques de temps
    result["processingTimeMs"] = round(process_time, 1)
    return result


@app.post("/extract/batch")
def extract_batch(req: BatchRequest):
    _ensure_engine_loaded()
    if not nlp_engine:
        raise HTTPException(503, "NLP Engine not ready")
    start_total = time.time()
    results = []
    print(f"[Batch] Processing {len(req.emails)} emails...")
    for email in req.emails:
        # Traitement séquentiel très rapide
        res = nlp_engine.process(email.body, email.subject, email.sender)
        results.append(res)
    total_time = (time.time() - start_total) * 1000
    avg_time = total_time / len(req.emails) if req.emails else 0
    print(
        f"[Batch] Done using Hybrid Engine. Total: {total_time:.0f}ms (Avg: {avg_time:.1f}ms/mail)"
    )
    return {
        "results": results,
        "count": len(results),
        "totalProcessingTimeMs": round(total_time, 1),
    }
