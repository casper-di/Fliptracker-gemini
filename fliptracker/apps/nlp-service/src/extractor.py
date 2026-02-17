import os      # <-- RÉPARE LE CRASH 'NameError'
import re
import spacy
import logging
from bs4 import BeautifulSoup

# Configuration des logs pour Render
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class HybridExtractor:
    def __init__(self):
        # 1. Chemins Docker vs Local
        # Le chemin /app/trained_models est celui défini dans ton Dockerfile
        docker_model_path = "/app/trained_models/model-best"
        local_model_path = os.path.join(os.getcwd(), "model-best")

        if os.path.exists(docker_model_path):
            logger.info(f"✅ Loading Docker model from {docker_model_path}")
            self.nlp = spacy.load(docker_model_path)
        elif os.path.exists(local_model_path):
            logger.info(f"✅ Loading local model from {local_model_path}")
            self.nlp = spacy.load(local_model_path)
        else:
            logger.warning("⚠️ No custom model found. Using blank 'fr' model.")
            self.nlp = spacy.blank("fr")

    def process(self, raw_body: str, subject: str = "", sender: str = "") -> dict:
        """
        Signature alignée avec api.py pour éviter les crashs 'TypeError'.
        """
        if not raw_body:
            return {"tracking": [], "address": None, "shop": None}

        # 2. Nettoyage HTML
        soup = BeautifulSoup(raw_body, "html.parser")
        # Le séparateur ' ' évite de coller les mots entre les balises
        text = soup.get_text(separator=' ')
        # On nettoie les espaces multiples et sauts de ligne
        text = re.sub(r'\s+', ' ', text).strip()

        # 3. Analyse NLP (IA) sur les 4000 premiers caractères
        doc = self.nlp(text[:4000])
        
        results = {
            "tracking": [],
            "address": None,
            "shop": None
        }
        
        # 4. Extraction des entités via ton modèle entraîné
        for ent in doc.ents:
            # Récupère l'adresse (on prend la première trouvée)
            if ent.label_ == "ADDRESS" and not results["address"]:
                results["address"] = ent.text.strip()
            
            # Récupère le transporteur (CARRIER dans ton modèle -> shop pour ton API)
            if ent.label_ == "CARRIER" and not results["shop"]:
                results["shop"] = ent.text.strip()

        # 5. Extraction Tracking (Mix NER + Regex pour une fiabilité maximale)
        # Regex cherche des suites alphanumériques de 10 à 20 caractères
        regex_tracking = list(set(re.findall(r'\b[0-9A-Z]{10,20}\b', text)))
        # NER cherche ce que l'IA a identifié comme TRACKING_NUM
        ner_tracking = [ent.text.strip() for ent in doc.ents if ent.label_ == "TRACKING_NUM"]
        
        all_tracking = list(set(regex_tracking + ner_tracking))
        # Filtre pour garder uniquement ce qui contient au moins un chiffre (évite les mots simples)
        results["tracking"] = [t for t in all_tracking if any(c.isdigit() for c in t)]

        return results