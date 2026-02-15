import spacy

print("\n🧪 Testing model...\n")

nlp = spacy.load("models/ner_model/model-best")

test_texts = [
    "DHL package 12345 ready at OULLINS, 1 RUE DIDEROT, 69600",
    "Your CHRONOPOST tracking XW297981644TS is on the way",
    "COLISSIMO delivery to AMAZON customer",
    "Relais Colis point available for pickup",
    "La Poste has your order"
]

for text in test_texts:
    doc = nlp(text)
    print(f"📧 {text[:50]}...")
    
    if doc.ents:
        for ent in doc.ents:
            print(f"  ✅ {ent.label_:10s} | {ent.text}")
    else:
        print(f"  ⚠️  No entities found")
    print()

print("✨ Test complete!")