import spacy
from spacy.training import Example, offsets_to_biluo_tags
import json
from pathlib import Path
import argparse
import random

def load_training_data(data_dir: str):
    train_data = []
    data_path = Path(data_dir)
    spacy_file = data_path / "spacy_train.json"
    
    if not spacy_file.exists():
        return []
    
    with open(spacy_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    for item in data:
        if isinstance(item, list) and len(item) == 2:
            text = item[0]
            annotations = item[1]
            if text and isinstance(annotations, dict):
                entities = annotations.get("entities", [])
                if entities:
                    train_data.append((text, {"entities": entities}))
    
    return train_data


def train_ner_model(epochs: int = 20):
    print("🚀 Loading training data...")
    train_data = load_training_data("data/annotated")
    
    if not train_data:
        print("❌ No training data found!")
        return
    
    print(f"✅ Loaded {len(train_data)} examples")
    
    # Create model
    print("\n🔧 Creating model...")
    nlp = spacy.blank("fr")
    ner = nlp.add_pipe("ner", last=True)
    
    # Get labels
    labels = set()
    for text, annotations in train_data:
        for start, end, label in annotations.get("entities", []):
            labels.add(label)
    
    for label in labels:
        ner.add_label(label)
    
    print(f"📝 Labels: {sorted(labels)}")
    
    # Filter to ONLY aligned entities
    print("\n🔍 Filtering aligned entities...")
    aligned_data = []
    skipped = 0
    
    for text, annotations in train_data:
        doc = nlp.make_doc(text)
        aligned_entities = []
        
        for start, end, label in annotations.get("entities", []):
            # Check if entity aligns
            tags = offsets_to_biluo_tags(doc, [(start, end, label)])
            if '-' not in tags:  # No misaligned markers
                aligned_entities.append((start, end, label))
        
        if aligned_entities:
            aligned_data.append((text, {"entities": aligned_entities}))
        else:
            skipped += 1
    
    print(f"   ✅ {len(aligned_data)} aligned")
    print(f"   ⏭️  {skipped} skipped (misaligned)")
    
    if not aligned_data:
        print("❌ No aligned data!")
        return
    
    # Initialize
    examples = []
    for text, annotations in aligned_data[:50]:
        try:
            doc = nlp.make_doc(text)
            example = Example.from_dict(doc, annotations)
            examples.append(example)
        except:
            continue
    
    nlp.initialize(lambda: examples)
    
    print(f"\n🎓 Training for {epochs} epochs...\n")
    
    # Train
    for epoch in range(epochs):
        random.shuffle(aligned_data)
        losses = {}
        epoch_examples = []
        
        for text, annotations in aligned_data:
            try:
                doc = nlp.make_doc(text)
                example = Example.from_dict(doc, annotations)
                epoch_examples.append(example)
            except:
                continue
        
        nlp.update(epoch_examples, drop=0.5, sgd=nlp.create_optimizer(), losses=losses)
        loss = losses.get('ner', 0)
        print(f"Epoch {epoch+1:2d}/{epochs} | Loss: {loss:.6f}")
    
    # Save
    print(f"\n💾 Saving...")
    model_dir = Path("models/ner_model/model-best")
    model_dir.mkdir(parents=True, exist_ok=True)
    nlp.to_disk(str(model_dir))
    
    print(f"✅ Saved!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=20)
    args = parser.parse_args()
    train_ner_model(args.epochs)