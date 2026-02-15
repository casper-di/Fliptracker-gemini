import spacy
from pathlib import Path

print("🔧 Creating pattern-based model...")

nlp = spacy.blank("fr")

# Only use entity_ruler, no NER needed
ruler = nlp.add_pipe("entity_ruler", last=True)

patterns = [
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
]

ruler.add_patterns(patterns)

model_dir = Path("models/ner_model/model-best")
model_dir.mkdir(parents=True, exist_ok=True)
nlp.to_disk(str(model_dir))

print(f"✅ Model saved!")
print(f"✅ Patterns: {len(patterns)}")