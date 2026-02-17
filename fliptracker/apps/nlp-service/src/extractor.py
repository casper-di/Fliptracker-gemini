import spacy
import os
import logging
from bs4 import BeautifulSoup  # <--- Ajoute ça !

logger = logging.getLogger(__name__)

class HybridExtractor:
    def __init__(self):
        self.model_path = "/app/trained_models/models-final/carrier"
        if os.path.exists(self.model_path):
            self.nlp = spacy.load(self.model_path)
        else:
            self.nlp = spacy.blank("fr")

    def clean_html(self, raw_html):
        """Transforme le HTML immonde en texte propre"""
        if not raw_html:
            return ""
        # 1. On retire tout le HTML
        soup = BeautifulSoup(raw_html, "html.parser")
        # 2. On supprime les balises style et script qui polluent
        for script_or_style in soup(["script", "style"]):
            script_or_style.decompose()
        # 3. On récupère le texte avec des espaces propres
        text = soup.get_text(separator=' ')
        # 4. On nettoie les espaces multiples et les sauts de ligne
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        return "\n".join(chunk for chunk in chunks if chunk)

    def extract_entities(self, text: str):
        # --- ÉTAPE CRUCIALE : NETTOYAGE ---
        cleaned_text = self.clean_html(text)
        logger.info(f"--- Texte nettoyé pour l'IA --- \n{cleaned_text[:500]}...")
        
        if not cleaned_text:
            return {"address": None, "carrier": None, "tracking_number": None}

        doc = self.nlp(cleaned_text)
        
        results = {"address": None, "carrier": None, "tracking_number": None}

        # Mapping flexible pour capturer ORG et TRACKING vus dans tes logs
        for ent in doc.ents:
            label = ent.label_
            val = ent.text.strip()
            
            if label == "ADDRESS" and not results["address"]:
                results["address"] = val
            elif label in ["CARRIER", "ORG"] and not results["carrier"]:
                results["carrier"] = val
            elif label in ["TRACKING", "TRACKING_NUM"] and not results["tracking_number"]:
                results["tracking_number"] = val
                
        return results