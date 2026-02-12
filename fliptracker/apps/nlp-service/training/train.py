"""
FlipTracker NLP — Model Training

Trains two models:
1. NER model (spaCy + CamemBERT) for entity extraction
2. Classification model (CamemBERT fine-tuned) for carrier/type/marketplace

Usage:
    python training/train.py                    # Train both
    python training/train.py --ner-only         # NER only
    python training/train.py --classifier-only  # Classifiers only
"""
import json
import sys
import argparse
from pathlib import Path

import spacy
from spacy.tokens import DocBin
from spacy.training import Example
from spacy.util import minibatch, compounding


# ── NER Training with spaCy + CamemBERT ─────────────────────────
def create_spacy_docbin(data: list[dict], nlp, output_path: Path):
    """Convert annotated data to spaCy DocBin format."""
    db = DocBin()
    skipped = 0
    for item in data:
        text = item["text"]
        entities = item["entities"]
        doc = nlp.make_doc(text)
        ents = []
        for start, end, label in entities:
            span = doc.char_span(start, end, label=label, alignment_mode="contract")
            if span is not None:
                ents.append(span)
            else:
                skipped += 1
        # Resolve overlaps
        try:
            doc.ents = ents
            db.add(doc)
        except ValueError:
            # Overlapping entities — filter
            filtered = []
            occupied = set()
            for ent in sorted(ents, key=lambda e: -(e.end - e.start)):
                token_range = set(range(ent.start, ent.end))
                if not token_range & occupied:
                    filtered.append(ent)
                    occupied |= token_range
            doc.ents = filtered
            db.add(doc)
    
    db.to_disk(output_path)
    print(f"   💾 Saved {len(data)} docs to {output_path} (skipped {skipped} misaligned spans)")


def train_ner(data_dir: Path, output_dir: Path, epochs: int = 30):
    """Train spaCy NER model with CamemBERT transformer."""
    print("\n" + "="*60)
    print("🧠 Training NER Model (spaCy + CamemBERT)")
    print("="*60)
    
    train_path = data_dir / "annotated" / "train.json"
    val_path = data_dir / "annotated" / "val.json"
    
    with open(train_path, "r", encoding="utf-8") as f:
        train_data = json.load(f)
    with open(val_path, "r", encoding="utf-8") as f:
        val_data = json.load(f)
    
    # Filter samples that have at least one entity
    train_with_ents = [d for d in train_data if d["entities"]]
    val_with_ents = [d for d in val_data if d["entities"]]
    
    print(f"   Train samples with entities: {len(train_with_ents)}/{len(train_data)}")
    print(f"   Val samples with entities: {len(val_with_ents)}/{len(val_data)}")
    
    if len(train_with_ents) < 10:
        print("   ⚠️  Very few training samples with entities. Results may be poor.")
        print("   Consider using LLM-assisted annotation to create more labeled data.")
    
    # Create spaCy config
    entity_labels = set()
    for d in train_with_ents:
        for _, _, label in d["entities"]:
            entity_labels.add(label)
    print(f"   Entity labels: {entity_labels}")
    
    # Check if we can use transformer backbone
    use_transformer = True
    try:
        import spacy_transformers  # noqa
    except ImportError:
        print("   ⚠️  spacy-transformers not installed. Using CPU model instead.")
        use_transformer = False
    
    if use_transformer:
        # Create model with CamemBERT transformer
        config_str = """
[system]
gpu_allocator = null

[nlp]
lang = "fr"
pipeline = ["transformer", "ner"]

[components]

[components.transformer]
factory = "transformer"

[components.transformer.model]
@architectures = "spacy-transformers.TransformerModel.v3"
name = "camembert-base"
tokenizer_config = {"use_fast": true}

[components.transformer.model.get_spans]
@span_getters = "spacy-transformers.strided_spans.v1"
window = 128
stride = 96

[components.ner]
factory = "ner"

[components.ner.model]
@architectures = "spacy.TransitionBasedParser.v2"
state_type = "ner"
extra_state_tokens = false
hidden_width = 64
maxout_pieces = 2
use_upper = true
nO = null

[components.ner.model.tok2vec]
@architectures = "spacy-transformers.TransformerListener.v1"
grad_factor = 1.0

[components.ner.model.tok2vec.pooling]
@layers = "reduce_mean.v1"

[training]
accumulate_gradient = 3
patience = 1600
max_epochs = """ + str(epochs) + """
max_steps = 20000
eval_frequency = 200

[training.optimizer]
@optimizers = "Adam.v1"
beta1 = 0.9
beta2 = 0.999
L2_decay = 0.01
L2 = 0.0
grad_clip = 1.0

[training.optimizer.learn_rate]
@schedules = "warmup_linear.v1"
warmup_steps = 250
total_steps = 20000
initial_rate = 5e-5

[training.batcher]
@batchers = "spacy.batch_by_padded.v1"
discard_oversize = true
get_length = null
size = 2000
buffer = 256
"""
        config_path = output_dir / "ner_config.cfg"
        config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(config_path, "w") as f:
            f.write(config_str)
        print(f"   📄 Config saved to {config_path}")
        
        # Create DocBin files
        nlp = spacy.blank("fr")
        docbin_dir = data_dir / "spacy_docbin"
        docbin_dir.mkdir(parents=True, exist_ok=True)
        
        print("   📦 Creating DocBin files...")
        create_spacy_docbin(train_with_ents, nlp, docbin_dir / "train.spacy")
        create_spacy_docbin(val_with_ents, nlp, docbin_dir / "val.spacy")
        
        print(f"\n   🚀 To train the NER model, run:")
        print(f"      python -m spacy train {config_path} \\")
        print(f"        --output {output_dir / 'ner_model'} \\")
        print(f"        --paths.train {docbin_dir / 'train.spacy'} \\")
        print(f"        --paths.dev {docbin_dir / 'val.spacy'} \\")
        print(f"        --gpu-id 0  # or -1 for CPU")
    
    else:
        # Fallback: train without transformer (faster, less accurate)
        print("\n   📦 Training basic spaCy NER (no transformer)...")
        nlp = spacy.blank("fr")
        ner = nlp.add_pipe("ner")
        
        for label in entity_labels:
            ner.add_label(label)
        
        # Prepare training data
        examples = []
        for item in train_with_ents:
            doc = nlp.make_doc(item["text"])
            entities = {"entities": item["entities"]}
            try:
                example = Example.from_dict(doc, entities)
                examples.append(example)
            except Exception:
                continue
        
        print(f"   Training on {len(examples)} examples for {epochs} epochs...")
        
        optimizer = nlp.begin_training()
        for epoch in range(epochs):
            losses = {}
            batches = minibatch(examples, size=compounding(4.0, 32.0, 1.001))
            for batch in batches:
                nlp.update(batch, sgd=optimizer, losses=losses)
            if epoch % 5 == 0:
                print(f"   Epoch {epoch}: loss={losses.get('ner', 0):.4f}")
        
        # Save
        model_path = output_dir / "ner_model" / "model-best"
        model_path.mkdir(parents=True, exist_ok=True)
        nlp.to_disk(model_path)
        print(f"   ✅ NER model saved to {model_path}")


# ── Classification Training with HuggingFace ────────────────────
def train_classifiers(data_dir: Path, output_dir: Path, epochs: int = 5):
    """Train classification models for carrier, type, marketplace, email_type."""
    print("\n" + "="*60)
    print("🏷️  Training Classification Models")
    print("="*60)
    
    try:
        from transformers import (
            CamembertTokenizer, CamembertForSequenceClassification,
            TrainingArguments, Trainer
        )
        from datasets import Dataset
        import torch
        from sklearn.preprocessing import LabelEncoder
    except ImportError as e:
        print(f"   ❌ Missing dependency: {e}")
        print("   Install: pip install transformers datasets torch scikit-learn")
        return
    
    annotated_dir = data_dir / "annotated"
    
    for task in ["carrier", "type", "marketplace", "email_type"]:
        cls_path = annotated_dir / f"cls_{task}.json"
        if not cls_path.exists():
            print(f"   ⚠️  No data for {task} — skipping")
            continue
        
        with open(cls_path, "r", encoding="utf-8") as f:
            cls_data = json.load(f)
        
        if len(cls_data) < 10:
            print(f"   ⚠️  Too few samples for {task} ({len(cls_data)}) — skipping")
            continue
        
        print(f"\n   📋 Training {task} classifier ({len(cls_data)} samples)...")
        
        # Encode labels
        le = LabelEncoder()
        labels = [d["label"] for d in cls_data]
        encoded_labels = le.fit_transform(labels)
        label_names = le.classes_.tolist()
        print(f"      Labels: {label_names}")
        
        # Tokenize
        tokenizer = CamembertTokenizer.from_pretrained("camembert-base")
        
        def tokenize_fn(examples):
            return tokenizer(
                examples["text"],
                truncation=True,
                padding="max_length",
                max_length=512,
            )
        
        # Create dataset
        dataset = Dataset.from_dict({
            "text": [d["text"] for d in cls_data],
            "label": encoded_labels.tolist(),
        })
        dataset = dataset.map(tokenize_fn, batched=True)
        
        # Split
        split = dataset.train_test_split(test_size=0.2, seed=42)
        
        # Model
        model = CamembertForSequenceClassification.from_pretrained(
            "camembert-base",
            num_labels=len(label_names),
        )
        
        # Training
        task_output = output_dir / f"cls_{task}"
        training_args = TrainingArguments(
            output_dir=str(task_output),
            num_train_epochs=epochs,
            per_device_train_batch_size=8,
            per_device_eval_batch_size=8,
            warmup_steps=50,
            weight_decay=0.01,
            logging_dir=str(task_output / "logs"),
            logging_steps=10,
            eval_strategy="epoch",
            save_strategy="epoch",
            load_best_model_at_end=True,
            metric_for_best_model="eval_loss",
        )
        
        trainer = Trainer(
            model=model,
            args=training_args,
            train_dataset=split["train"],
            eval_dataset=split["test"],
        )
        
        trainer.train()
        
        # Save model + label mapping
        model.save_pretrained(task_output / "model-best")
        tokenizer.save_pretrained(task_output / "model-best")
        
        label_map_path = task_output / "label_map.json"
        with open(label_map_path, "w") as f:
            json.dump({"labels": label_names}, f)
        
        print(f"      ✅ {task} classifier saved to {task_output}")


# ── Main ─────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ner-only", action="store_true")
    parser.add_argument("--classifier-only", action="store_true")
    parser.add_argument("--epochs-ner", type=int, default=30)
    parser.add_argument("--epochs-cls", type=int, default=5)
    args = parser.parse_args()
    
    data_dir = Path(__file__).parent.parent / "data"
    output_dir = Path(__file__).parent.parent / "models"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    if not args.classifier_only:
        train_ner(data_dir, output_dir, epochs=args.epochs_ner)
    
    if not args.ner_only:
        train_classifiers(data_dir, output_dir, epochs=args.epochs_cls)
    
    print("\n" + "="*60)
    print("🎉 Training complete!")
    print("="*60)


if __name__ == "__main__":
    main()
