from fastapi import FastAPI
from pydantic import BaseModel
import time

# ========================================
# 1. CREATE FASTAPI APP
# ========================================
app = FastAPI(title="FlipTracker NLP")

# ========================================
# 2. MODELS
# ========================================
class Email(BaseModel):
    body: str
    subject: str = ""
    sender: str = ""

class EmailBatchRequest(BaseModel):
    emails: list[Email]

# ========================================
# 3. LAZY LOADING
# ========================================
nlp_engine = None

def _ensure_engine_loaded():
    global nlp_engine
    if nlp_engine is None:
        print("🚀 Loading NLP engine...")
        from src.extractor import HybridExtractor
        nlp_engine = HybridExtractor()
        print("✅ NLP engine ready")

# ========================================
# 4. ROUTES
# ========================================
@app.get("/health")
def health():
    """Health check"""
    return {"status": "ok"}

@app.post("/extract/batch")
def extract_batch(request: EmailBatchRequest):
    _ensure_engine_loaded()
    
    results = []
    start_time = time.time()
    
    for email in request.emails:
        # On log l'entrée pour savoir quel mail on traite
        print(f"--- 📩 Processing Email ---")
        print(f"Subject: {email.subject}")
        
        result = nlp_engine.process(
            raw_body=email.body,
            subject=email.subject or "",
            sender=email.sender or ""
        )
        
        # ON LOG LE RÉSULTAT DE L'EXTRACTION
        print(f"🔍 Extraction Result:")
        print(f"   📍 Address: {result.get('address')}")
        print(f"   🚚 Shop/Carrier: {result.get('shop')}")
        print(f"   🔢 Tracking: {result.get('tracking')}")
        
        results.append(result)
    
    elapsed = (time.time() - start_time) * 1000
    print(f"✅ Batch complete: {len(results)} emails in {elapsed:.1f}ms")
    
    return {
        "results": results,
        "count": len(results),
        "totalProcessingTimeMs": elapsed
    }
    
@app.get("/")
def root():
    """Root endpoint"""
    return {
        "service": "FlipTracker NLP",
        "version": "1.0",
        "endpoints": {
            "health": "/health",
            "extract": "/extract/batch"
        }
    }