import re
from langdetect import detect
from .cleaning import clean_html_content
from .nlp_pipeline import load_nlp


def extract_metadata(email_html: str):
    # Nettoyage
    text = clean_html_content(email_html)
    # Détection langue
    lang = detect(text)
    nlp = load_nlp(lang)
    # Regex tracking
    tracking_patterns = [
        r"[5-9][A-Z][0-9]{11}",  # Colissimo
        r"[A-Z]{2}[0-9]{9}[A-Z]{2}",  # Chronopost
        r"1Z[0-9A-Z]{16}",  # UPS
        r"[0-9]{8,12}",  # Mondial Relay
    ]
    tracking_numbers = []
    for pat in tracking_patterns:
        tracking_numbers += re.findall(pat, text)
    # spaCy extraction (désactive parser/lemmatizer)
    doc = nlp(text, disable=["parser", "lemmatizer"])
    carriers = [ent.text for ent in doc.ents if ent.label_ == "CARRIER"]
    persons = [ent.text for ent in doc.ents if ent.label_ == "PERSON"]
    addresses = [ent.text for ent in doc.ents if ent.label_ == "ADDRESS"]
    # Résultat
    return {
        "tracking_numbers": tracking_numbers,
        "carriers": carriers,
        "persons": persons,
        "addresses": addresses,
        "lang": lang,
    }
