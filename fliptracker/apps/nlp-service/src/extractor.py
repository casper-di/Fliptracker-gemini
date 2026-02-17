import spacy
import os
import logging
import re
from bs4 import BeautifulSoup

# Configuration du logging
logger = logging.getLogger(__name__)

class HybridExtractor:
    def __init__(self):
        # Chemin validé par tes logs Docker
        self.model_path = "/app/trained_models"
        
        # Regex de secours pour l'adresse (cherche un code postal 5 chiffres + ville)
        self.address_regex = re.compile(r'(\d{5}\s+[A-ZÀ-Z\s\-]+)', re.IGNORECASE)
        # Regex pour les numéros de suivi (souvent 13 à 15 caractères alphanum)
        self.tracking_regex = re.compile(r'\b[A-Z0-9]{10,20}\b')

        if os.path.exists(os.path.join(self.model_path, "config.cfg")):
            try:
                self.nlp = spacy.load(self.model_path)
                logger.info("✅ CERVEAU CONNECTÉ : Modèle chargé.")
            except Exception as e:
                logger.error(f"❌ CRASH CHARGEMENT : {e}")
                self.nlp = spacy.blank("fr")
        else:
            logger.warning("⚠️ GPS PERDU : Modèle introuvable, utilisation d'un modèle vide.")
            self.nlp = spacy.blank("fr")

    def clean_html(self, raw_html):
        """Nettoyage chirurgical du HTML"""
        if not raw_html:
            return ""
        try:
            soup = BeautifulSoup(raw_html, "lxml")
            for element in soup(["script", "style", "head", "title", "meta"]):
                element.decompose()
            
            # On garde les sauts de ligne pour aider l'IA à voir les blocs
            text = soup.get_text(separator=' ')
            lines = (line.strip() for line in text.splitlines())
            return "\n".join(chunk for chunk in lines if chunk)
        except Exception as e:
            logger.error(f"Erreur nettoyage : {e}")
            return raw_html

    def extract_entities(self, text: str):
        cleaned_text = self.clean_html(text)
        doc = self.nlp(cleaned_text)
        
        results = {
            "address": None,
            "carrier": None,
            "tracking_number": None
        }

        # 1. Tentative avec l'IA (tes labels entraînés)
        for ent in doc.ents:
            label = ent.label_
            val = ent.text.strip()
            
            if label == "ADDRESS" and not results["address"]:
                results["address"] = val
            elif label in ["CARRIER", "ORG"] and not results["carrier"]:
                # On évite les captures débiles comme "Monsieur" ou "Aide"
                if len(val) > 2 and val.lower() not in ["monsieur", "madame", "aide", "bonjour"]:
                    results["carrier"] = val
            elif label in ["TRACKING", "TRACKING_NUM"] and not results["tracking_number"]:
                results["tracking_number"] = val

        # 2. SYSTÈME DE SECOURS (Si l'IA a échoué)
        
        # Secours Adresse : Si rien trouvé, on cherche un code postal dans le texte
        if not results["address"]:
            match = self.address_regex.search(cleaned_text)
            if match:
                # On prend un peu de texte avant le code postal pour avoir la rue
                start = max(0, match.start() - 30)
                results["address"] = cleaned_text[start:match.end()].strip().replace('\n', ' ')
                logger.info(f"Fallback Regex : Adresse trouvée via code postal")

        # Secours Tracking : On cherche des motifs classiques
        if not results["tracking_number"]:
            # On cherche dans le sujet ou le corps (souvent après un #)
            ids = re.findall(r'#([A-Z0-9]{10,})', cleaned_text)
            if ids:
                results["tracking_number"] = ids[0]

        return results