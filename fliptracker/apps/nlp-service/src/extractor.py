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
        
        # Matchers
        self.matcher_fr = self._create_address_matcher(self.nlp_fr)
        self.matcher_en = self._create_address_matcher(self.nlp_en)
        
        # Carrier model
        carrier_path = Path("/app/trained_models/ner_model/model-best")
        self.carrier_model = spacy.load(str(carrier_path)) if carrier_path.exists() else None
        
        print("✅ Models loaded!")
    
    def _create_address_matcher(self, nlp):
        matcher = Matcher(nlp.vocab)
        patterns = [
            [
                {"IS_DIGIT": True, "OP": "?"},
                {"LOWER": {"IN": ["rue", "avenue", "boulevard", "allée", "place", "chemin", "quai", "impasse", "passage", "square"]}},
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
    
    def _extract_addresses(self, text, matcher, nlp):
        """Extract addresses and keep only the best ones"""
        doc = nlp(text[:3000])
        matches = matcher(doc)
        
        addresses = []
        
        if matches:
            # Garder seulement la PLUS LONGUE pour éviter les doublons
            best_matches = []
            for match_id, start, end in matches:
                addr_text = doc[start:end].text.strip()
                if len(addr_text) > 5:
                    best_matches.append((start, end, addr_text))
            
            # Enlever les duplicatas
            seen = set()
            for start, end, addr_text in sorted(best_matches, key=lambda x: -(x[1]-x[0])):
                is_duplicate = False
                for s, e, a in seen:
                    if addr_text in a or a in addr_text:
                        is_duplicate = True
                        break
                
                if not is_duplicate:
                    addresses.append(addr_text)
                    seen.add((start, end, addr_text))
        
        return addresses
    
    def process(self, raw_body: str, subject: str = "", sender: str = "") -> dict:
        from langdetect import detect, LangDetectException
        
        soup = BeautifulSoup(raw_body, "html.parser")
        for tag in soup(["script", "style"]):
            tag.decompose()
        text = soup.get_text()
        
        try:
            lang = detect(text[:1000])
        except:
            lang = "fr"
        
        nlp = self.nlp_en if lang == "en" else self.nlp_fr
        matcher = self.matcher_en if lang == "en" else self.matcher_fr
        
        # Adresses
        addresses = self._extract_addresses(text, matcher, nlp)
        
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