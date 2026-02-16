import spacy
import os
import re
from bs4 import BeautifulSoup

class HybridExtractor:
    def __init__(self):
        # Charge le modèle généré par le job 'train'
        base_path = os.path.dirname(os.path.dirname(__file__))
        model_path = os.path.join(base_path, "model-best")
        self.nlp = spacy.load(model_path) if os.path.exists(model_path) else spacy.blank("fr")

    def process(self, raw_body: str) -> dict:
        soup = BeautifulSoup(raw_body, "html.parser")
        text = soup.get_text(separator=' ')
        doc = self.nlp(text[:4000])
        
        results = {"tracking": [], "address": None, "shop": None}
        
        for ent in doc.ents:
            if ent.label_ == "ADDRESS": results["address"] = ent.text.strip()
            if ent.label_ == "CARRIER": results["shop"] = ent.text.strip()
            
        # Regex pour le tracking (toujours plus fiable que le NER pour les suites de chiffres)
        results["tracking"] = list(set(re.findall(r'\b[0-9A-Z]{10,20}\b', text)))
        return results