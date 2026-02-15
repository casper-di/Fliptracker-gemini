"""
Train spaCy NER model with ADDRESS, SHOP_NAME, TRACKING labels
"""
import spacy
from spacy.training import Example, offsets_to_biluo_tags
import json
from pathlib import Path
import random


def load_training_data(data_dir: str):
    """Load annotated data and filter aligned entities"""
    data_path = Path(data_dir) / "spacy_train.json"
    
    if not data_path.exists():
        print(f"❌ {data_path} not found!")
        return []
    
    with open(data_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    nlp = spacy.blank("fr")
    training_data = []
    aligned = 0
    misaligned = 0
    
    for item in data:
        if isinstance(item, list) and len(item) == 2:
            text = item[0]
            annotations = item[1]
            
            if text and isinstance(annotations, dict):
                entities = annotations.get("entities", [])
                
                if entities:
                    # Check alignment
                    doc = nlp.make_doc(text)
                    tags = offsets_to_biluo_tags(doc, entities)
                    
                    if '-' not in tags:
                        training_data.append((text, {"entities": entities}))
                        aligned += 1
                    else:
                        misaligned += 1
    
    print(f"   ✅ Aligned: {aligned}")
    print(f"   ⏭️  Misaligned: {misaligned}")
    
    return training_data


def train_ner_model(epochs: int = 30):
    """Train NER model with ADDRESS, SHOP_NAME, TRACKING"""
    
    print("🚀 Loading training data...")
    train_data = load_training_data("data/annotated")
    
    if not train_data:
        print("❌ No training data!")
        return
    
    print(f"✅ Loaded {len(train_data)} examples\n")
    
    # Create model
    print("🔧 Creating blank model...")
    nlp = spacy.blank("fr")
    ner = nlp.add_pipe("ner", last=True)
    
    # Add labels
    labels = {"ADDRESS", "SHOP_NAME", "TRACKING"}
    for label in labels:
        ner.add_label(label)
    
    print(f"📝 Labels: {sorted(labels)}\n")
    
    # Initialize
    examples = []
    for text, annotations in train_data[:50]:
        try:
            doc = nlp.make_doc(text)
            example = Example.from_dict(doc, annotations)
            examples.append(example)
        except:
            continue
    
    if not examples:
        print("❌ Could not create examples!")
        return
    
    nlp.initialize(lambda: examples)
    
    print(f"🎓 Training for {epochs} epochs...\n")
    
    # Train
    best_loss = float('inf')
    
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
        
        if loss < best_loss:
            best_loss = loss
        
        if (epoch + 1) % 5 == 0:
            print(f"Epoch {epoch+1:2d}/{epochs} | Loss: {loss:.6f}")
    
    # Save
    print(f"\n💾 Saving model...")
    model_dir = Path("models/ner_full/model-best")
    model_dir.mkdir(parents=True, exist_ok=True)
    nlp.to_disk(str(model_dir))
    
    print(f"✅ Model saved to {model_dir}")
    
    # Size
    model_size = sum(f.stat().st_size for f in model_dir.rglob('*') if f.is_file()) / (1024*1024)
    print(f"📊 Model size: {model_size:.2f} MB")
    print(f"📊 Best loss: {best_loss:.6f}\n")
    
    print(f"✨ Training complete!")


if __name__ == "__main__":
    train_ner_model(epochs=30)