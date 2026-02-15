import spacy
from pathlib import Path

class HybridExtractor:
    def __init__(self):
        print("⚡ Loading models...")
        self.nlp_fr = spacy.load("fr_core_news_sm", disable=["parser", "lemmatizer"])
        self.nlp_en = spacy.load("en_core_web_sm", disable=["parser", "lemmatizer"])
        
        # Add entity_ruler with patterns
        self._add_patterns(self.nlp_fr)
        self._add_patterns(self.nlp_en)
        
        print("✅ Models loaded!")
    
    def _add_patterns(self, nlp):
        ruler = nlp.add_pipe("entity_ruler", before="ner")
        patterns = [
            {"label": "ORG", "pattern": "CHRONOPOST"},
            {"label": "ORG", "pattern": "COLISSIMO"},
            {"label": "ORG", "pattern": "DHL"},
            {"label": "ORG", "pattern": "UPS"},
            {"label": "ORG", "pattern": "FEDEX"},
            {"label": "ORG", "pattern": [{"LOWER": "mondial"}, {"LOWER": "relay"}]},
            {"label": "ORG", "pattern": [{"LOWER": "relais"}, {"LOWER": "colis"}]},
            {"label": "ORG", "pattern": [{"LOWER": "la"}, {"LOWER": "poste"}]},
            {"label": "ORG", "pattern": "AMAZON"},
            {"label": "ORG", "pattern": "VINTED"},
        ]
        ruler.add_patterns(patterns)
    
    def process(self, raw_body: str, subject: str = "", sender: str = "") -> dict:
        from bs4 import BeautifulSoup
        from langdetect import detect, LangDetectException
        import re
        
        # Clean HTML
        soup = BeautifulSoup(raw_body, "html.parser")
        for tag in soup(["script", "style"]):
            tag.decompose()
        text = soup.get_text(separator="\n")
        
        # Detect language
        try:
            lang = detect(text[:1000])
        except:
            lang = "fr"
        
        nlp = self.nlp_en if lang == "en" else self.nlp_fr
        doc = nlp(text[:3000])
        
        # Extract
        tracking = list(set(re.findall(r'\b([0-9]{8,15})\b', text)))
        
        entities = []
        for ent in doc.ents:
            entities.append({
                "text": ent.text,
                "label": ent.label_,
                "confidence": 0.95
            })
        
        return {
            "trackingNumbers": tracking,
            "carrier": None,
            "entities": entities,
            "language": lang,
        }