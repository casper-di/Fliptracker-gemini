import spacy
from pathlib import Path

print("🔧 Creating pattern-based model...")

nlp = spacy.blank("fr")
ruler = nlp.add_pipe("entity_ruler", last=True)

patterns = [
    # Organizations
    {"label": "ORG", "pattern": "CHRONOPOST"},
    {"label": "ORG", "pattern": "COLISSIMO"},
    {"label": "ORG", "pattern": "DHL"},
    {"label": "ORG", "pattern": "UPS"},
    {"label": "ORG", "pattern": "FEDEX"},
    {"label": "ORG", "pattern": "AMAZON"},
    {"label": "ORG", "pattern": "VINTED"},
    {"label": "ORG", "pattern": [{"LOWER": "mondial"}, {"LOWER": "relay"}]},
    {"label": "ORG", "pattern": [{"LOWER": "relais"}, {"LOWER": "colis"}]},
    {"label": "ORG", "pattern": [{"LOWER": "la"}, {"LOWER": "poste"}]},
    
    # Tracking numbers (8-15 digits)
    {"label": "TRACKING", "pattern": [{"IS_DIGIT": True, "LENGTH": {">=": 8}}]},
    
    # Postal codes (5 digits)
    {"label": "ADDRESS", "pattern": [{"IS_DIGIT": True, "LENGTH": 5}]},
    
    # Dates
    {"label": "DATE", "pattern": [{"IS_DIGIT": True}, {"ORTH": "/"}, {"IS_DIGIT": True}]},
    {"label": "DATE", "pattern": [{"IS_DIGIT": True}, {"ORTH": "-"}, {"IS_DIGIT": True}]},
]

ruler.add_patterns(patterns)

model_dir = Path("models/ner_model/model-best")
model_dir.mkdir(parents=True, exist_ok=True)
nlp.to_disk(str(model_dir))

print(f"✅ Model saved!")
print(f"✅ Patterns: {len(patterns)}")