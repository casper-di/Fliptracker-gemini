import spacy
import os
import logging
from bs4 import BeautifulSoup

# Configuration du logging
logger = logging.getLogger(__name__)

class HybridExtractor:
    def __init__(self):
        # FIX : Le chemin doit correspondre à l'endroit où Docker a extrait les fichiers
        self.model_path = "/app/trained_models"
        
        logger.info(f"🔍 Tentative de chargement du modèle depuis : {self.model_path}")
        
        # On vérifie si config.cfg existe (preuve que c'est un modèle spaCy valide)
        config_path = os.path.join(self.model_path, "config.cfg")
        
        if os.path.exists(config_path):
            try:
                self.nlp = spacy.load(self.model_path)
                logger.info("✅ CERVEAU CONNECTÉ : Modèle chargé avec succès.")
            except Exception as e:
                logger.error(f"❌ CRASH CHARGEMENT : {e}")
                self.nlp = spacy.blank("fr")
        else:
            logger.warning(f"⚠️ GPS PERDU : Pas de config.cfg trouvé dans {self.model_path}")
            self.nlp = spacy.blank("fr")

    def clean_html(self, raw_html):
        """Le Karcher : On dégage tout le bruit HTML/CSS"""
        if not raw_html:
            return ""
        try:
            # On utilise lxml pour la performance (déjà dans ton requirements.txt)
            soup = BeautifulSoup(raw_html, "lxml") 
            for element in soup(["script", "style", "head", "title", "meta", "[document]"]):
                element.decompose()
            
            # Récupération du texte avec des espaces pour éviter de coller les mots
            text = soup.get_text(separator=' ')
            
            # Nettoyage des espaces blancs inutiles
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            cleaned = "\n".join(chunk for chunk in chunks if chunk)
            return cleaned
        except Exception as e:
            logger.error(f"Erreur nettoyage : {e}")
            return raw_html

    def extract_entities(self, text: str):
        # 1. Nettoyage HTML
        cleaned_text = self.clean_html(text)
        
        # LOG DE DEBUG : Pour voir ce que l'IA traite réellement
        logger.info(f"--- Texte envoyé à l'IA --- \n{cleaned_text[:300]}...")
        
        # 2. Inférence spaCy
        doc = self.nlp(cleaned_text)
        
        results = {
            "address": None,
            "carrier": None,
            "tracking_number": None
        }

        # 3. Extraction par labels (plus flexible)
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