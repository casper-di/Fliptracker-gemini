import spacy
from spacy.training import Example
import json
from pathlib import Path
import random

def load_address_data():
    """Charge les données d'adresses du fichier spacy_train.json"""
    data_path = Path("data/annotated/spacy_train.json")
    
    if not data_path.exists():
        print(f"❌ {data_path} not found!")
        return []
    
    with open(data_path, 'r', encoding='utf-8') as f:
        items = json.load(f)
    
    training_data = []
    
    # Format: [[text, {"entities": [(start, end, label), ...]}], ...]
    for item in items:
        if isinstance(item, list) and len(item) == 2:
            text = item[0]
            annotations = item[1]
            
            if isinstance(annotations, dict):
                all_entities = annotations.get("entities", [])
                
                # Garder UNIQUEMENT les adresses
                address_entities = [
                    (s, e, "ADDRESS") for s, e, label in all_entities 
                    if label == "ADDRESS" and s < e
                ]
                
                if address_entities and text:
                    training_data.append((text, {"entities": address_entities}))
    
    return training_data


def train_address_ner(epochs: int = 30):
    print("🚀 Loading address training data...")
    train_data = load_address_data()
    
    if not train_data:
        print("❌ No address data found!")
        print("   No addresses in training set or format issue")
        return
    
    print(f"✅ Loaded {len(train_data)} examples with addresses")
    
    # Create model
    nlp = spacy.blank("fr")
    ner = nlp.add_pipe("ner", last=True)
    ner.add_label("ADDRESS")
    
    # Initialize
    examples = []
    for text, annotations in train_data[:50]:
        try:
            doc = nlp.make_doc(text)
            example = Example.from_dict(doc, annotations)
            examples.append(example)
        except Exception as e:
            continue
    
    if not examples:
        print("❌ Could not create examples!")
        return
    
    nlp.initialize(lambda: examples)
    
    print(f"\n🎓 Training for {epochs} epochs...\n")
    
    # Train
    for epoch in range(epochs):
        random.shuffle(train_data)
        losses = {}
        epoch_examples = []
        
        for text, annotations in train_data:
            try:
                doc = nlp.make_doc(text)
                example = Example.from_dict(doc, annotations)
                epoch_examples.append(example)
            except:
                continue
        
        nlp.update(epoch_examples, drop=0.5, sgd=nlp.create_optimizer(), losses=losses)
        loss = losses.get('ner', 0)
        
        if (epoch + 1) % 5 == 0:
            print(f"Epoch {epoch+1:2d}/{epochs} | Loss: {loss:.6f}")
    
    # Save
    print(f"\n💾 Saving model...")
    model_dir = Path("models/address_ner/model-best")
    model_dir.mkdir(parents=True, exist_ok=True)
    nlp.to_disk(str(model_dir))
    
    print(f"✅ Address NER model saved!")


if __name__ == "__main__":
    train_address_ner(epochs=30)