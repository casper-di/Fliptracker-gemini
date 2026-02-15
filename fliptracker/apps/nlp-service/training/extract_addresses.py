import spacy
from spacy.matcher import Matcher
import re

nlp = spacy.load("fr_core_news_sm")
matcher = Matcher(nlp.vocab)

# Patterns pour les adresses
patterns = [
    # "1 RUE DIDEROT, 69600 OULLINS"
    [
        {"IS_DIGIT": True, "OP": "?"},
        {"LOWER": {"IN": ["rue", "avenue", "boulevard", "allée", "place", "chemin", "quai", "impasse", "passage", "square"]}},
        {"IS_ALPHA": True, "OP": "*"},
        {"IS_DIGIT": True, "OP": "*"},
        {"ORTH": ",", "OP": "?"},
        {"IS_DIGIT": True, "LENGTH": 5},
        {"IS_ALPHA": True, "OP": "*"}
    ],
    # Juste code postal + ville
    [
        {"IS_DIGIT": True, "LENGTH": 5},
        {"IS_ALPHA": True, "OP": "+"}
    ]
]

matcher.add("ADDRESS", patterns)

# Test
test_texts = [
    "Livraison à 1 RUE DIDEROT, 69600 OULLINS",
    "Pickup at LYON, 69000",
    "42 AVENUE DE FRANCE, 75013 PARIS",
    "Point relais à 69600"
]

print("🧪 Testing address extraction:\n")

for text in test_texts:
    doc = nlp(text)
    matches = matcher(doc)
    
    print(f"📧 {text}")
    
    if matches:
        for match_id, start, end in matches:
            span = doc[start:end]
            print(f"  ✅ ADDRESS: {span.text}")
    else:
        print(f"  ⚠️  No address found")
    print()