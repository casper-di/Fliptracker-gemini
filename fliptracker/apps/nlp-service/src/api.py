from fastapi import FastAPI
from pydantic import BaseModel
import time
import logging

# Configuration du logger pour voir les sorties dans Render
logger = logging.getLogger(__name__)

# ========================================
# 1. CREATE FASTAPI APP
# ========================================
app = FastAPI(title="FlipTracker NLP")

# ========================================
# 2. MODELS (Pydantic)
# ========================================
class Email(BaseModel):
    body: str
    subject: str = ""
    sender: str = ""

class EmailBatchRequest(BaseModel):
    emails: list[Email]

# ========================================
# 3. LAZY LOADING DU MOTEUR NLP
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
    """Vérification de l'état du service"""
    return {"status": "ok"}

@app.post("/extract/batch")
def extract_batch(request: EmailBatchRequest):
    _ensure_engine_loaded()
    
    results = []
    start_time = time.time()
    
    for email in request.emails:
        print(f"--- 📩 Processing Email ---")
        print(f"Subject: {email.subject}")
        
        # On appelle la méthode exacte de ton extractor.py
        # On passe le body du mail à l'IA
        result = nlp_engine.extract_entities(email.body)
        
        # ON LOG LE RÉSULTAT DANS RENDER POUR VÉRIFIER
        # Note: On utilise les clés définies dans ton extractor.py
        print(f"🔍 Extraction Result:")
        print(f"   📍 Address: {result.get('address')}")
        print(f"   🚚 Carrier: {result.get('carrier')}")
        print(f"   🔢 Tracking: {result.get('tracking_number')}")
        
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
    """Point d'entrée principal"""
    return {
        "service": "FlipTracker NLP",
        "version": "1.0",
        "status": "active",
        "endpoints": {
            "health": "/health",
            "extract": "/extract/batch"
        }
    }