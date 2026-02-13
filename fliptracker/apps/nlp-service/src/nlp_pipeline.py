import spacy
from spacy.pipeline import EntityRuler

def load_nlp(lang: str):
    if lang == "fr":
        nlp = spacy.load("fr_core_news_lg")
    elif lang == "en":
        nlp = spacy.load("en_core_web_lg")
    else:
        nlp = spacy.load("fr_core_news_lg")  # fallback

    ruler = EntityRuler(nlp, overwrite_ents=True)
    patterns = [
        {"label": "CARRIER", "pattern": "Mondial Relay"},
        {"label": "CARRIER", "pattern": "Relais Colis"},
        {"label": "CARRIER", "pattern": "La Poste"},
        {"label": "CARRIER", "pattern": "UPS"},
        {"label": "CARRIER", "pattern": "DHL"},
        # Ajoute d'autres transporteurs ici
    ]
    ruler.add_patterns(patterns)
    nlp.add_pipe(ruler, before="ner")
    return nlp
