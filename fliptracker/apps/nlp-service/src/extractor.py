import spacy
import os
import logging
from bs4 import BeautifulSoup

# Configuration du logging
logger = logging.getLogger(__name__)

class HybridExtractor:
    def __init__(self):
        # Le chemin que tes logs Docker ont confirmé
        self.model_path = "/app/trained_models/models-final/carrier"
        
        if os.path.exists(self.model_path):
            try:
                self.nlp = spacy.load(self.model_path)
                logger.info("✅ CERVEAU CONNECTÉ : Modèle chargé.")
            except Exception as e:
                logger.error(f"❌ CRASH CHARGEMENT : {e}")
                self.nlp = spacy.blank("fr")
        else:
            logger.warning("⚠️ GPS PERDU : Chemin introuvable, modèle vide utilisé.")
            self.nlp = spacy.blank("fr")

    def clean_html(self, raw_html):
        """Le Karcher : On dégage tout le bruit HTML/CSS"""
        if not raw_html:
            return ""
        try:
            soup = BeautifulSoup(raw_html, "lxml") # lxml est plus rapide et robuste
            for element in soup(["script", "style", "head", "title", "meta", "[document]"]):
                element.decompose()
            text = soup.get_text(separator=' ')
            # Nettoyage des espaces et sauts de ligne multiples
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            return "\n".join(chunk for chunk in chunks if chunk)
        except Exception as e:
            logger.error(f"Erreur nettoyage : {e}")
            return raw_html

    def extract_entities(self, text: str):
        # 1. On nettoie l'entrée avant que l'IA ne la voie
        cleaned_text = self.clean_html(text)
        
        # 2. On passe le texte propre à l'IA
        doc = self.nlp(cleaned_text)
        
        results = {
            "address": None,
            "carrier": None,
            "tracking_number": None
        }

        # 3. Mapping ultra-large pour ne rien laisser passer
        # On a vu dans tes logs que l'IA crache 'ORG' et 'TRACKING'
        for ent in doc.ents:
            label = ent.label_
            val = ent.text.strip()
            
            # Capture de l'adresse (on prend la première trouvée)
            if label == "ADDRESS" and not results["address"]:
                results["address"] = val
            
            # Capture du transporteur (Label CARRIER ou ORG comme 'La Poste')
            elif label in ["CARRIER", "ORG"] and not results["carrier"]:
                results["carrier"] = val
                
            # Capture du tracking (Label TRACKING ou TRACKING_NUM)
            elif label in ["TRACKING", "TRACKING_NUM"] and not results["tracking_number"]:
                results["tracking_number"] = val

        return results