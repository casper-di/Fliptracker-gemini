import spacy
from spacy.matcher import Matcher
import re
from bs4 import BeautifulSoup
from pathlib import Path

class HybridExtractor:
    def __init__(self):
        print("⚡ Loading models...")
        self.nlp_fr = spacy.load("fr_core_news_sm", disable=["parser", "lemmatizer"])
        self.nlp_en = spacy.load("en_core_web_sm", disable=["parser", "lemmatizer"])
        
        # Matcher pour les adresses
        self.matcher_fr = self._create_address_matcher(self.nlp_fr)
        self.matcher_en = self._create_address_matcher(self.nlp_en)
        
        # Carrier patterns
        carrier_path = Path("/app/trained_models/ner_model/model-best")
        self.carrier_model = spacy.load(str(carrier_path)) if carrier_path.exists() else None
        
        print("✅ Models loaded!")
    
    def _create_address_matcher(self, nlp):
        """Crée un matcher pour les adresses"""
        matcher = Matcher(nlp.vocab)
        
        patterns = [
            [
                {"IS_DIGIT": True, "OP": "?"},
                {"LOWER": {"IN": ["rue", "avenue", "boulevard", "allée", "place", "chemin", "quai", "impasse"]}},
                {"IS_ALPHA": True, "OP": "*"},
                {"IS_DIGIT": True, "OP": "*"},
                {"ORTH": ",", "OP": "?"},
                {"IS_DIGIT": True, "LENGTH": 5},
                {"IS_ALPHA": True, "OP": "*"}
            ],
            [
                {"IS_DIGIT": True, "LENGTH": 5},
                {"IS_ALPHA": True, "OP": "+"}
            ]
        ]
        
        matcher.add("ADDRESS", patterns)
        return matcher
    
    def process(self, raw_body: str, subject: str = "", sender: str = "") -> dict:
        soup = BeautifulSoup(raw_body, "html.parser")
        for tag in soup(["script", "style"]):
            tag.decompose()
        text = soup.get_text()
        
        # Détect langue
        try:
            from langdetect import detect
            lang = detect(text[:1000])
        except:
            lang = "fr"
        
        nlp = self.nlp_en if lang == "en" else self.nlp_fr
        matcher = self.matcher_en if lang == "en" else self.matcher_fr
        doc = nlp(text[:3000])
        
        # Adresses avec Matcher
        addresses = []
        for match_id, start, end in matcher(doc):
            addr = doc[start:end].text.strip()
            if len(addr) > 5:
                addresses.append(addr)
        
        # Carriers
        carrier = None
        if self.carrier_model:
            doc_carrier = self.carrier_model(text)
            for ent in doc_carrier.ents:
                if ent.label_ == "ORG":
                    carrier = {"label": ent.text, "confidence": 0.99}
                    break
        
        # Tracking
        tracking = re.findall(r'\b([0-9]{8,15})\b', text)
        
        return {
            "trackingNumbers": list(set(tracking)),
            "pickupAddress": addresses[0] if addresses else None,
            "deliveryAddress": addresses[1] if len(addresses) > 1 else None,
            "carrier": carrier,
            "language": lang,
        }