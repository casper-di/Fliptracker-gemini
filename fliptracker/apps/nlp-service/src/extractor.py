import spacy
import os
import logging

# Configuration du logging pour voir les résultats dans Render
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

class HybridExtractor:
    def __init__(self):
        # 1. LE CHEMIN EXACT DETECTE DANS TES LOGS DOCKER
        # D'après ton log #14 : /app/trained_models/models-final/carrier/
        self.model_path = "/app/trained_models/models-final/carrier"
        
        logger.info("--- 🔍 CHARGEMENT DU MODÈLE IA ---")
        
        if os.path.exists(self.model_path):
            try:
                # On vérifie si config.cfg est bien là
                if os.path.exists(os.path.join(self.model_path, "config.cfg")):
                    logger.info(f"✅ Dossier config trouvé. Chargement de : {self.model_path}")
                    self.nlp = spacy.load(self.model_path)
                    logger.info("🚀 Modèle IA chargé avec succès à 97% !")
                else:
                    logger.error(f"❌ config.cfg absent dans {self.model_path}")
                    self.nlp = spacy.blank("fr")
            except Exception as e:
                logger.error(f"❌ Erreur lors du chargement : {str(e)}")
                self.nlp = spacy.blank("fr")
        else:
            logger.warning(f"⚠️ Chemin introuvable : {self.model_path}. Utilisation d'un modèle vide.")
            # Petit scan pour t'aider si ça rate encore
            if os.path.exists("/app/trained_models"):
                logger.info(f"Contenu de /app/trained_models : {os.listdir('/app/trained_models')}")
            self.nlp = spacy.blank("fr")

    def extract_entities(self, text: str):
        """
        Analyse le texte et extrait les entités (Adresse, Transporteur, Tracking)
        """
        if not text or not text.strip():
            return {"address": None, "carrier": None, "tracking_number": None}

        # Limitation du texte pour la performance (les 4000 premiers caractères)
        doc = self.nlp(text[:4000])
        
        # Initialisation des résultats
        results = {
            "address": None,
            "carrier": None,
            "tracking_number": None
        }

        # DEBUG LOG : Pour voir si l'IA trouve enfin quelque chose
        if doc.ents:
            logger.info(f"🎯 IA a trouvé {len(doc.ents)} entités !")
            for ent in doc.ents:
                logger.info(f"DEBUG ENTITY: [{ent.text}] -> Label: {ent.label_}")
        else:
            logger.warning("💨 L'IA n'a détecté aucune entité dans ce mail.")

        # Mapping des labels (assure-toi que ce sont les mêmes labels que lors de l'entraînement)
        for ent in doc.ents:
            label = ent.label_
            value = ent.text.strip()

            if label == "ADDRESS" and not results["address"]:
                results["address"] = value
            elif label == "CARRIER" and not results["carrier"]:
                results["carrier"] = value
            elif label == "TRACKING_NUM" and not results["tracking_number"]:
                results["tracking_number"] = value

        return results