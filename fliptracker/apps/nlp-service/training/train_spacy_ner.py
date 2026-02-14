import spacy
from spacy.training import Example
import json
from pathlib import Path
import argparse
import random

def load_training_data(data_dir: str):
    """Charge les données annotées au format spaCy JSON"""
    train_data = []
    
    data_path = Path(data_dir)
    
    # Chercher spacy_train.json (créé par prepare_data.py)
    spacy_file = data_path / "spacy_train.json"
    
    if not spacy_file.exists():
        print(f"❌ {spacy_file} not found!")
        return []
    
    print(f"   Reading {spacy_file}...")
    
    with open(spacy_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # data est une liste: [[text, {"entities": [...]}], ...]
    # (JSON convertit les tuples en listes)
    
    for item in data:
        # item est une liste [text, {"entities": [...]}]
        if isinstance(item, list) and len(item) == 2:
            text = item[0]
            annotations = item[1]
            
            if text and isinstance(annotations, dict):
                entities = annotations.get("entities", [])
                if entities:
                    train_data.append((text, {"entities": entities}))
    
    return train_data


def train_ner_model(epochs: int = 20):
    """Entraîne un modèle spaCy NER custom"""
    
    print("🚀 Loading training data...")
    train_data = load_training_data("data/annotated")
    
    if not train_data:
        print("❌ No training data found!")
        print("   Make sure prepare_data.py ran successfully first")
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
        for start, end, label in annotations.get("entities", []):
            labels.add(label)
    
    if not labels:
        print("❌ No labels found in training data!")
        return
    
    for label in labels:
        ner.add_label(label)
    
    print(f"📝 Labels: {sorted(labels)}")
    
    # Initialiser
    nlp.initialize(lambda: [(nlp.make_doc(t), Example.from_dict(nlp.make_doc(t), a)) 
                            for t, a in train_data[:10]])
    
    print(f"\n🎓 Training for {epochs} epochs...")
    
    # Entraîner
    for epoch in range(epochs):
        random.shuffle(train_data)
        losses = {}
        examples = []
        
        for text, annotations in train_data:
            try:
                doc = nlp.make_doc(text)
                example = Example.from_dict(doc, annotations)
                examples.append(example)
            except Exception as e:
                continue
        
        # Update
        nlp.update(examples, drop=0.5, sgd=nlp.create_optimizer(), losses=losses)
        
        loss_value = losses.get('ner', 0)
        print(f"Epoch {epoch+1}/{epochs} - Loss: {loss_value:.4f}")
    
    # Sauvegarder le modèle
    print("\n💾 Saving model...")
    model_dir = Path("models/ner_model/model-best")
    model_dir.parent.mkdir(parents=True, exist_ok=True)
    nlp.to_disk(str(model_dir))
    
    print(f"✅ Model saved to {model_dir}")
    
    # Vérifier la taille
    model_size = sum(f.stat().st_size for f in model_dir.rglob('*') if f.is_file()) / (1024*1024)
    print(f"📊 Model size: {model_size:.2f} MB")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=20)
    args = parser.parse_args()
    
    train_ner_model(args.epochs)