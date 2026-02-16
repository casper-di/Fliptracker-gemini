import spacy
import re
import os
from bs4 import BeautifulSoup

class HybridExtractor:
    def __init__(self):
        print("⚡ Loading Fliptracker NER Model...")
        
        # On charge TON modèle entraîné (celui généré par GitHub Actions)
        # On suppose qu'il est dans le dossier 'model-best' à la racine de l'app
        model_path = os.path.join(os.path.dirname(__file__), "../model-best")
        
        try:
            self.nlp = spacy.load(model_path)
            print("✅ Custom NER model loaded")
        except:
            print("⚠️ Custom model not found, falling back to blank FR")
            self.nlp = spacy.blank("fr")

    def _clean_text(self, raw_body):
        soup = BeautifulSoup(raw_body, "html.parser")
        # Supprimer le bruit
        for tag in soup(["script", "style"]):
            tag.decompose()
        # Important : préserver un peu de structure avec des espaces
        return soup.get_text(separator=' ')

    def process(self, raw_body: str, subject: str = "", sender: str = "") -> dict:
        text = self._clean_text(raw_body)
        
        # L'IA fait tout le travail ici (Extraction de l'adresse et du shop)
        doc = self.nlp(text[:5000]) # On limite pour la performance
        
        res = {
            "trackingNumbers": self._extract_tracking(text),
            "pickupAddress": None,
            "shopName": None,
            "language": "fr" # Par défaut
        }

        # On récupère ce que l'IA a trouvé grâce à ton training
        for ent in doc.ents:
            if ent.label_ == "ADDRESS" and not res["pickupAddress"]:
                res["pickupAddress"] = ent.text.strip()
            if ent.label_ == "CARRIER" and not res["shopName"]:
                res["shopName"] = ent.text.strip()
        
        # Fallback pour le Shop Name avec tes Regex si l'IA a raté
        if not res["shopName"]:
            res["shopName"] = self._fallback_shop_name(text)

        return res

    def _extract_tracking(self, text):
        # On garde tes Regex pour le tracking, car elles sont très efficaces
        patterns = [
            r'\b([0-9]{8,15})\b',
            r'\b(1Z[0-9A-Z]{16})\b',
            r'\b([0-9]{3}-[0-9]{7}-[0-9]{7})\b',
        ]
        tracking = set()
        for p in patterns:
            matches = re.findall(p, text)
            tracking.update(matches)
        return list(tracking)

    def _fallback_shop_name(self, text):
        # Tes règles manuelles en secours
        known = ["VINTED GO", "MONDIAL RELAY", "CHRONOPOST", "RELAIS COLIS"]
        for s in known:
            if s in text.upper(): return s
        return None