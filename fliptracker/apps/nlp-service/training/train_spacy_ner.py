import spacy
from spacy.training import Example
import json
from pathlib import Path
import argparse
import random

def load_training_data(data_dir: str):
    """Charge les données annotées depuis les fichiers JSON"""
    train_data = []
    
    data_path = Path(data_dir)
    for json_file in data_path.glob("*.json"):
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
            if isinstance(data, list):
                for item in data:
                    text = item.get("body", "")
                    entities = item.get("entities", [])
                    
                    if text and entities:
                        ents = []
                        for ent in entities:
                            ents.append({
                                "start": ent.get("start"),
                                "end": ent.get("end"),
                                "label": ent.get("label", "MISC")
                            })
                        
                        if ents:
                            train_data.append((text, {"entities": ents}))
    
    return train_data

def train_ner_model(epochs: int = 20):
    """Entraîne un modèle spaCy NER custom"""
    
    print("🚀 Loading training data...")
    train_data = load_training_data("data/annotated")
    
    if not train_data:
        print("❌ No training data found!")
        return
    
    print(f"✅ Loaded {len(train_data)} training examples")
    
    # Créer un modèle blank
    print("\n🔧 Creating blank spaCy model...")
    nlp = spacy.blank("fr")
    
    # Ajouter le NER pipe
    ner = nlp.add_pipe("ner", last=True)
    
    # Ajouter les labels
    labels = set()
    for text, annotations in train_data:
        for ent in annotations.get("entities", []):
            labels.add(ent["label"])
    
    for label in labels:
        ner.add_label(label)
    
    print(f"📝 Labels: {labels}")
    
    # Initialiser les paramètres
    nlp.initialize(lambda: train_data)
    
    print(f"\n🎓 Training for {epochs} epochs...")
    
    # Entraîner
    for epoch in range(epochs):
        random.shuffle(train_data)
        losses = {}
        
        for text, annotations in train_data:
            example = Example.from_dict(nlp.make_doc(text), annotations)
            nlp.update([example], drop=0.5, sgd=nlp.create_optimizer(), losses=losses)
        
        print(f"Epoch {epoch+1}/{epochs} - Loss: {losses.get('ner', 0):.4f}")
    
    # Sauvegarder le modèle
    print("\n💾 Saving model...")
    model_dir = Path("models/ner_model/model-best")
    model_dir.parent.mkdir(parents=True, exist_ok=True)
    nlp.to_disk(str(model_dir))
    
    print(f"✅ Model saved to {model_dir}")
    
    # Vérifier la taille
    import shutil
    model_size = sum(f.stat().st_size for f in model_dir.rglob('*') if f.is_file()) / (1024*1024)
    print(f"📊 Model size: {model_size:.2f} MB")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=20)
    args = parser.parse_args()
    
    train_ner_model(args.epochs)