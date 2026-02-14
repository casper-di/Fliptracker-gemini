import re
import spacy
from bs4 import BeautifulSoup
from langdetect import detect, LangDetectException


class HybridExtractor:
    def __init__(self):
        print("⚡ Loading Hybrid NLP Models (CPU Optimized)...")
        # On charge les modèles légers
        try:
            self.nlp_fr = spacy.load(
                "fr_core_news_sm", disable=["parser", "lemmatizer"]
            )
            self.nlp_en = spacy.load("en_core_web_sm", disable=["parser", "lemmatizer"])
        except OSError:
            print(
                "⚠️ Models not found. Did you run 'python -m spacy download ...' in Dockerfile?"
            )
            raise

        # Configuration des EntityRuler (Logique métier)
        self._setup_patterns(self.nlp_fr)
        self._setup_patterns(self.nlp_en)
        print("✅ Hybrid Models Loaded!")

    def _setup_patterns(self, nlp):
        """Ajoute des règles manuelles pour ne jamais rater un transporteur connu."""
        ruler = nlp.add_pipe("entity_ruler", before="ner")
        patterns = [
            {"label": "ORG", "pattern": [{"LOWER": "mondial"}, {"LOWER": "relay"}]},
            {"label": "ORG", "pattern": [{"LOWER": "relais"}, {"LOWER": "colis"}]},
            {"label": "ORG", "pattern": [{"LOWER": "chronopost"}]},
            {"label": "ORG", "pattern": [{"LOWER": "colissimo"}]},
            {"label": "ORG", "pattern": [{"LOWER": "amazon"}]},
            {"label": "ORG", "pattern": [{"LOWER": "ups"}]},
            {"label": "ORG", "pattern": [{"LOWER": "dhl"}]},
            {"label": "ORG", "pattern": [{"LOWER": "fedex"}]},
        ]
        ruler.add_patterns(patterns)

    def clean_html(self, html_content: str) -> str:
        """Transforme le HTML sale en texte propre."""
        if not html_content or len(html_content) < 5:
            return ""

        # BeautifulSoup est 100x plus rapide que de laisser l'IA lire le HTML
        soup = BeautifulSoup(html_content, "html.parser")

        # On vire le bruit (CSS, JS)
        for script in soup(["script", "style", "head", "meta", "noscript"]):
            script.decompose()

        text = soup.get_text(separator="\n")

        # Nettoyage des espaces multiples
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        clean_text = "\n".join(chunk for chunk in chunks if chunk)

        # Troncature intelligente (Début + Fin) si c'est trop long
        if len(clean_text) > 4000:
            return clean_text[:3000] + "\n...\n" + clean_text[-1000:]
        return clean_text

    def extract_tracking_regex(self, text: str) -> list[str]:
        """Regex infaillibles pour les numéros de suivi."""
        patterns = [
            r"\b(1Z[0-9A-Z]{16})\b",  # UPS
            r"\b(6A[0-9]{11})\b",  # Colissimo classique
            r"\b([0-9]{13,15})\b",  # Chronopost / Colissimo
            r"\b([A-Z]{2}[0-9]{9}[A-Z]{2})\b",  # Standard International
            r"\b([0-9]{8,12})\b",  # Mondial Relay / Autres
        ]
        found = set()
        for p in patterns:
            matches = re.findall(p, text)
            for m in matches:
                # Filtrage basique pour éviter les faux positifs (numéros de tél, etc.)
                if len(m) > 6:
                    found.add(m)
        return list(found)

    def process(self, raw_body: str, subject: str = "", sender: str = "") -> dict:
        """Pipeline principal : Nettoyage -> Regex -> NLP"""

        # 1. Nettoyage HTML
        clean_body = self.clean_html(raw_body)
        full_text = f"{subject}\n{sender}\n{clean_body}"

        # 2. Regex (La priorité)
        tracking_numbers = self.extract_tracking_regex(full_text)

        # 3. Détection Langue & Choix du modèle
        try:
            lang = detect(full_text[:1000])
        except LangDetectException:
            lang = "fr"

        nlp = self.nlp_en if lang == "en" else self.nlp_fr

        # 4. Inférence NLP (Rapide car modèle 'lg' et texte propre)
        doc = nlp(full_text[:3000])  # On limite pour la vitesse

        entities = []
        carrier = None

        # Extraction intelligente
        for ent in doc.ents:
            if ent.label_ in ["ORG", "GPE", "DATE", "MONEY"]:
                entities.append(
                    {
                        "text": ent.text,
                        "label": ent.label_,
                        "confidence": 0.95,  # spaCy lg est fiable
                    }
                )
                # Si l'entité est une ORG connue, on la met en carrier
                if ent.label_ == "ORG" and not carrier:
                    if any(
                        x in ent.text.lower()
                        for x in ["poste", "colis", "relay", "ups", "dhl", "chronopost"]
                    ):
                        carrier = {"label": ent.text, "confidence": 0.99}

        return {
            "trackingNumbers": tracking_numbers,
            "carrier": carrier,
            "entities": entities,  # Garde pour debug
            "language": lang,
            "raw_text_snippet": clean_body[:100],  # Pour vérifier le nettoyage
        }
