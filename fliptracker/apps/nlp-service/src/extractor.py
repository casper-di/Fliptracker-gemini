import re
import spacy
from bs4 import BeautifulSoup
from langdetect import detect, LangDetectException
from pathlib import Path


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

        # ✅ CHARGER LES MODÈLES CUSTOM
        self.carrier_model = self._load_custom_model("carrier_model")
        self.tracking_model = self._load_custom_model("tracking_model")
        self.type_model = self._load_custom_model("type_model")
        self.marketplace_model = self._load_custom_model("marketplace_model")
        self.email_type_model = self._load_custom_model("email_type_model")

        # Configuration des EntityRuler
        self._setup_patterns(self.nlp_fr)
        self._setup_patterns(self.nlp_en)
        print("✅ Hybrid Models Loaded!")

    def _load_custom_model(self, model_name: str):
        """Charge les modèles custom depuis trained_models/"""
        model_path = Path(f"/app/trained_models/{model_name}/model-best")
        
        if model_path.exists():
            try:
                print(f"   ✅ {model_name} loaded")
                return spacy.load(str(model_path))
            except Exception as e:
                print(f"   ⚠️  {model_name} failed: {e}")
                return None
        else:
            print(f"   ⚠️  {model_name} not found at {model_path}")
            return None

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

        soup = BeautifulSoup(html_content, "html.parser")

        for script in soup(["script", "style", "head", "meta", "noscript"]):
            script.decompose()

        text = soup.get_text(separator="\n")

        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        clean_text = "\n".join(chunk for chunk in chunks if chunk)

        if len(clean_text) > 4000:
            return clean_text[:3000] + "\n...\n" + clean_text[-1000:]
        return clean_text

    def extract_tracking_regex(self, text: str) -> list[str]:
        """Regex infaillibles pour les numéros de suivi."""
        patterns = [
            r"\b(1Z[0-9A-Z]{16})\b",
            r"\b(6A[0-9]{11})\b",
            r"\b([0-9]{13,15})\b",
            r"\b([A-Z]{2}[0-9]{9}[A-Z]{2})\b",
            r"\b([0-9]{8,12})\b",
        ]
        found = set()
        for p in patterns:
            matches = re.findall(p, text)
            for m in matches:
                if len(m) > 6:
                    found.add(m)
        return list(found)

    def process(self, raw_body: str, subject: str = "", sender: str = "") -> dict:
        """Pipeline principal : Nettoyage -> Regex -> NLP"""

        clean_body = self.clean_html(raw_body)
        full_text = f"{subject}\n{sender}\n{clean_body}"

        tracking_numbers = self.extract_tracking_regex(full_text)

        try:
            lang = detect(full_text[:1000])
        except LangDetectException:
            lang = "fr"

        nlp = self.nlp_en if lang == "en" else self.nlp_fr
        doc = nlp(full_text[:3000])

        # ✅ UTILISER LE MODÈLE CARRIER CUSTOM
        carrier = None
        if self.carrier_model:
            try:
                doc_carrier = self.carrier_model(full_text[:3000])
                if doc_carrier.cats:
                    carrier_label = max(doc_carrier.cats, key=doc_carrier.cats.get)
                    carrier_score = doc_carrier.cats[carrier_label]
                    if carrier_score > 0.5:
                        carrier = {"label": carrier_label, "confidence": round(carrier_score, 2)}
            except Exception as e:
                print(f"⚠️  Carrier model error: {e}")

        entities = []
        for ent in doc.ents:
            if ent.label_ in ["ORG", "GPE", "DATE", "MONEY"]:
                entities.append({
                    "text": ent.text,
                    "label": ent.label_,
                    "confidence": 0.95,
                })

        return {
            "trackingNumbers": tracking_numbers,
            "pickupAddress": None,
            "deliveryAddress": None,
            "personNames": [],
            "withdrawalCodes": [],
            "orderNumbers": [],
            "productNames": [],
            "prices": [],
            "dates": [],
            "carrier": carrier,
            "shipmentType": None,
            "marketplace": None,
            "emailType": None,
            "entities": entities,
            "language": lang,
            "raw_text_snippet": clean_body[:100],
        }