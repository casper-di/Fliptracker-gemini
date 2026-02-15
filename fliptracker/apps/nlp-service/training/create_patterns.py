import json
from pathlib import Path

patterns = {
    "TRACKING": [
        {"label": "TRACKING", "pattern": [{"IS_DIGIT": True, "LENGTH": {">=": 8, "<=": 15}}]},
    ],
    "ORG": [
        {"label": "ORG", "pattern": "CHRONOPOST"},
        {"label": "ORG", "pattern": "COLISSIMO"},
        {"label": "ORG", "pattern": "DHL"},
        {"label": "ORG", "pattern": "UPS"},
        {"label": "ORG", "pattern": "FEDEX"},
        {"label": "ORG", "pattern": [{"LOWER": "mondial"}, {"LOWER": "relay"}]},
        {"label": "ORG", "pattern": [{"LOWER": "relais"}, {"LOWER": "colis"}]},
        {"label": "ORG", "pattern": [{"LOWER": "la"}, {"LOWER": "poste"}]},
        {"label": "ORG", "pattern": "AMAZON"},
        {"label": "ORG", "pattern": "VINTED"},
    ],
}

output_dir = Path("models/ner_model/model-best")
output_dir.mkdir(parents=True, exist_ok=True)

with open(output_dir / "patterns.json", "w") as f:
    json.dump(patterns, f)

print("✅ Patterns created!")