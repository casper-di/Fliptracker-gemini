"""
FlipTracker NLP — Model Evaluation

Evaluates trained NER and classification models on held-out data.

Usage:
    python training/evaluate.py
    python training/evaluate.py --ner-only
    python training/evaluate.py --classifier-only
"""
import json
import argparse
from pathlib import Path
from collections import defaultdict

import spacy
from spacy.tokens import DocBin
from spacy.training import Example
from spacy.scorer import Scorer


def evaluate_ner(data_dir: Path, model_dir: Path):
    """Evaluate NER model on validation set."""
    print("\n" + "="*60)
    print("📊 Evaluating NER Model")
    print("="*60)
    
    model_path = model_dir / "ner_model" / "model-best"
    if not model_path.exists():
        print(f"   ❌ No model found at {model_path}")
        return
    
    nlp = spacy.load(model_path)
    
    # Load validation data
    val_path = data_dir / "annotated" / "val.json"
    with open(val_path, "r", encoding="utf-8") as f:
        val_data = json.load(f)
    
    val_with_ents = [d for d in val_data if d["entities"]]
    print(f"   Evaluating on {len(val_with_ents)} samples with entities")
    
    # Create examples
    examples = []
    for item in val_with_ents:
        predicted = nlp.make_doc(item["text"])
        predicted = nlp(item["text"])
        reference = nlp.make_doc(item["text"])
        ents = []
        for start, end, label in item["entities"]:
            span = reference.char_span(start, end, label=label, alignment_mode="contract")
            if span:
                ents.append(span)
        try:
            reference.ents = ents
        except ValueError:
            # Overlapping entities
            filtered = []
            occupied = set()
            for ent in sorted(ents, key=lambda e: -(e.end - e.start)):
                token_range = set(range(ent.start, ent.end))
                if not token_range & occupied:
                    filtered.append(ent)
                    occupied |= token_range
            reference.ents = filtered
        
        examples.append(Example(predicted, reference))
    
    # Score
    scorer = Scorer()
    scores = scorer.score(examples)
    
    # Entity-level metrics
    print("\n   Entity-level metrics:")
    print(f"   {'Label':<20} {'Precision':>10} {'Recall':>10} {'F1':>10}")
    print(f"   {'-'*52}")
    
    ents_per_type = scores.get("ents_per_type", {})
    for label, metrics in sorted(ents_per_type.items()):
        p = metrics.get("p", 0)
        r = metrics.get("r", 0)
        f = metrics.get("f", 0)
        print(f"   {label:<20} {p:>10.2f} {r:>10.2f} {f:>10.2f}")
    
    overall_p = scores.get("ents_p", 0)
    overall_r = scores.get("ents_r", 0)
    overall_f = scores.get("ents_f", 0)
    print(f"   {'-'*52}")
    print(f"   {'OVERALL':<20} {overall_p:>10.2f} {overall_r:>10.2f} {overall_f:>10.2f}")
    
    # Error analysis
    print("\n   Sample predictions vs ground truth:")
    for i, item in enumerate(val_with_ents[:5]):
        doc = nlp(item["text"][:200])
        gold_ents = [(s, e, l) for s, e, l in item["entities"] if s < 200]
        print(f"\n   --- Sample {i+1} ---")
        print(f"   Predicted: {[(ent.text[:30], ent.label_) for ent in doc.ents]}")
        print(f"   Gold:      {[(item['text'][s:e][:30], l) for s, e, l in gold_ents]}")
    
    return scores


def evaluate_classifiers(data_dir: Path, model_dir: Path):
    """Evaluate classification models."""
    print("\n" + "="*60)
    print("📊 Evaluating Classification Models")
    print("="*60)
    
    try:
        from transformers import CamembertTokenizer, CamembertForSequenceClassification
        import torch
    except ImportError:
        print("   ❌ transformers/torch not installed")
        return
    
    annotated_dir = data_dir / "annotated"
    
    for task in ["carrier", "type", "marketplace"]:
        task_dir = model_dir / f"cls_{task}"
        model_path = task_dir / "model-best"
        label_map_path = task_dir / "label_map.json"
        
        if not model_path.exists():
            print(f"\n   ⚠️  No {task} model found — skipping")
            continue
        
        cls_path = annotated_dir / f"cls_{task}.json"
        if not cls_path.exists():
            continue
        
        with open(cls_path, "r", encoding="utf-8") as f:
            cls_data = json.load(f)
        with open(label_map_path, "r") as f:
            label_names = json.load(f)["labels"]
        
        print(f"\n   📋 Evaluating {task} classifier...")
        
        tokenizer = CamembertTokenizer.from_pretrained(str(model_path))
        model = CamembertForSequenceClassification.from_pretrained(str(model_path))
        model.eval()
        
        # Use last 20% as test
        split_idx = int(len(cls_data) * 0.8)
        test_data = cls_data[split_idx:]
        
        correct = 0
        total = 0
        confusion = defaultdict(lambda: defaultdict(int))
        
        for item in test_data:
            text = item["text"][:512]
            label = item["label"]
            
            inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
            with torch.no_grad():
                outputs = model(**inputs)
                pred_idx = outputs.logits.argmax(-1).item()
            
            if pred_idx < len(label_names):
                pred_label = label_names[pred_idx]
            else:
                pred_label = "UNKNOWN"
            
            confusion[label][pred_label] += 1
            if pred_label == label:
                correct += 1
            total += 1
        
        accuracy = correct / total if total > 0 else 0
        print(f"      Accuracy: {accuracy:.2%} ({correct}/{total})")
        
        # Confusion matrix
        print(f"\n      Confusion matrix (rows=gold, cols=predicted):")
        all_labels = sorted(set(
            list(confusion.keys()) + 
            [p for g in confusion.values() for p in g.keys()]
        ))
        
        # Header
        header = f"      {'':>15}"
        for l in all_labels:
            header += f" {l[:8]:>8}"
        print(header)
        
        for gold in all_labels:
            row = f"      {gold[:15]:>15}"
            for pred in all_labels:
                row += f" {confusion[gold][pred]:>8}"
            print(row)
    
    return


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ner-only", action="store_true")
    parser.add_argument("--classifier-only", action="store_true")
    args = parser.parse_args()
    
    data_dir = Path(__file__).parent.parent / "data"
    model_dir = Path(__file__).parent.parent / "models"
    
    if not args.classifier_only:
        evaluate_ner(data_dir, model_dir)
    
    if not args.ner_only:
        evaluate_classifiers(data_dir, model_dir)
    
    print("\n✅ Evaluation complete!")


if __name__ == "__main__":
    main()
