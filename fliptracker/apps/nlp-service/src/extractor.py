import spacy
from pathlib import Path

class HybridExtractor:
    def __init__(self):
        print("⚡ Loading models...")
        self.nlp_fr = spacy.load("fr_core_news_sm", disable=["parser", "lemmatizer"])
        
        # Carrier model (patterns)
        carrier_path = Path("/app/trained_models/ner_model/model-best")
        self.carrier_model = spacy.load(str(carrier_path)) if carrier_path.exists() else None
        
        # Address NER (trained)
        address_path = Path("/app/trained_models/address_ner/model-best")
        self.address_model = spacy.load(str(address_path)) if address_path.exists() else None
        
        print("✅ Models loaded!")
    
    def process(self, raw_body: str, subject: str = "", sender: str = "") -> dict:
        from bs4 import BeautifulSoup
        import re
        
        soup = BeautifulSoup(raw_body, "html.parser")
        for tag in soup(["script", "style"]):
            tag.decompose()
        text = soup.get_text()
        
        # Adresses avec modèle entraîné
        addresses = []
        if self.address_model:
            doc = self.address_model(text[:3000])
            addresses = [ent.text for ent in doc.ents if ent.label_ == "ADDRESS"]
        
        # Carriers avec patterns
        carrier = None
        if self.carrier_model:
            doc = self.carrier_model(text)
            for ent in doc.ents:
                if ent.label_ == "ORG":
                    carrier = {"label": ent.text, "confidence": 0.99}
                    break
        
        # Tracking avec regex
        tracking = re.findall(r'\b([0-9]{8,15})\b', text)
        
        return {
            "trackingNumbers": list(set(tracking)),
            "pickupAddress": addresses[0] if addresses else None,
            "deliveryAddress": addresses[1] if len(addresses) > 1 else None,
            "carrier": carrier,
        }