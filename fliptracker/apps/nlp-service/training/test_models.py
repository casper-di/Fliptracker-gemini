import spacy

print("\n🧪 Testing models...\n")

# Test carrier model
print("=" * 50)
print("CARRIER MODEL")
print("=" * 50)
nlp_carrier = spacy.load("models/ner_model/model-best")

texts = [
    "DHL package 12345",
    "Chronopost tracking",
    "La Poste delivery"
]

for text in texts:
    doc = nlp_carrier(text)
    print(f"{text}")
    for ent in doc.ents:
        print(f"  ✅ {ent.label_}: {ent.text}")

# Test address model
print("\n" + "=" * 50)
print("ADDRESS NER MODEL")
print("=" * 50)
nlp_address = spacy.load("models/address_ner/model-best")

address_texts = [
    "Livraison à 1 RUE DIDEROT, 69600 OULLINS",
    "Pickup at 42 AVENUE DE FRANCE, 75013 PARIS",
    "Colis disponible à LYON, 69000"
]

for text in address_texts:
    doc = nlp_address(text)
    print(f"{text}")
    for ent in doc.ents:
        print(f"  ✅ {ent.label_}: {ent.text}")

print("\n✨ Test complete!")