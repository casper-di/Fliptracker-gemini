import spacy
from spacy.matcher import Matcher

nlp = spacy.load("fr_core_news_sm")
matcher = Matcher(nlp.vocab)

patterns = [
    [
        {"IS_DIGIT": True, "OP": "?"},
        {"LOWER": {"IN": ["rue", "avenue", "boulevard", "allée", "place", "chemin", "quai", "impasse", "passage", "square"]}},
        {"IS_ALPHA": True, "OP": "*"},
        {"IS_DIGIT": True, "OP": "*"},
        {"ORTH": ",", "OP": "?"},
        {"IS_DIGIT": True, "LENGTH": 5},
        {"IS_ALPHA": True, "OP": "*"}
    ],
    [
        {"IS_DIGIT": True, "LENGTH": 5},
        {"IS_ALPHA": True, "OP": "+"}
    ]
]

matcher.add("ADDRESS", patterns)

test_texts = [
    "Livraison à 1 RUE DIDEROT, 69600 OULLINS",
    "Pickup LYON, 69000",
    "42 AVENUE DE FRANCE, 75013 PARIS"
]

print("🧪 Testing address extraction:\n")

for text in test_texts:
    doc = nlp(text)
    matches = matcher(doc)
    
    print(f"📧 {text}")
    
    if matches:
        # Garder la PLUS LONGUE
        best_match = max(matches, key=lambda m: m[2] - m[1])
        match_id, start, end = best_match
        span = doc[start:end]
        print(f"  ✅ ADDRESS: {span.text}")
    else:
        print(f"  ⚠️  No address")
    print()

print("✨ Test complete!")