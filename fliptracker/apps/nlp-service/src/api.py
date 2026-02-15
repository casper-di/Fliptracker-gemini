from src.extractor import HybridExtractor

nlp_engine = None

def _ensure_engine_loaded():
    global nlp_engine
    if nlp_engine is None:
        print("🚀 Loading NLP engine...")
        nlp_engine = HybridExtractor()
        print("✅ NLP engine ready")

@app.post("/extract/batch")
def extract_batch(request: EmailBatchRequest):
    _ensure_engine_loaded()
    
    results = []
    start_time = time.time()
    
    for email in request.emails:
        result = nlp_engine.process(
            raw_body=email.body,
            subject=email.subject or "",
            sender=email.sender or ""
        )
        results.append(result)
    
    elapsed = (time.time() - start_time) * 1000
    
    print(f"✅ Processed {len(results)} emails in {elapsed:.1f}ms")
    print(f"📊 Sample result: {results[0]}")
    
    return {
        "results": results,
        "count": len(results),
        "totalProcessingTimeMs": elapsed
    }