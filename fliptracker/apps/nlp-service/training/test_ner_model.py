"""
Test NER model on validation data
Shows extraction results with statistics
"""
import spacy
import json
from pathlib import Path
from collections import Counter


def load_validation_data(data_dir: str):
    """Load validation data"""
    data_path = Path(data_dir) / "spacy_val.json"
    
    if not data_path.exists():
        print(f"❌ {data_path} not found!")
        return []
    
    with open(data_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    validation_data = []
    for item in data:
        if isinstance(item, list) and len(item) == 2:
            text = item[0]
            annotations = item[1]
            if text and isinstance(annotations, dict):
                validation_data.append((text, annotations.get("entities", [])))
    
    return validation_data


def extract_entities_from_text(nlp, text):
    """Extract entities using the model"""
    doc = nlp(text[:3000])
    return [(ent.text, ent.label_) for ent in doc.ents]


def test_ner_model(model_path: str = "models/ner_full/model-best"):
    """Test NER model on validation data"""
    
    print("=" * 60)
    print("🧪 TESTING NER MODEL")
    print("=" * 60)
    
    # Load model
    print(f"\n📂 Loading model from {model_path}...")
    try:
        nlp = spacy.load(model_path)
        print("✅ Model loaded!\n")
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        return
    
    # Load validation data
    print("📊 Loading validation data...")
    validation_data = load_validation_data("data/annotated")
    
    if not validation_data:
        print("❌ No validation data!")
        return
    
    print(f"✅ Loaded {len(validation_data)} validation samples\n")
    
    # Test extraction
    print("=" * 60)
    print("🔍 TESTING EXTRACTION")
    print("=" * 60)
    
    results = []
    entity_counts = Counter()
    
    for idx, (text, ground_truth_entities) in enumerate(validation_data[:20], 1):
        # Extract
        predicted = extract_entities_from_text(nlp, text)
        
        # Count entities
        for _, label in predicted:
            entity_counts[label] += 1
        
        # Store result
        results.append({
            "text": text[:80] + "..." if len(text) > 80 else text,
            "predicted": predicted,
            "ground_truth": ground_truth_entities
        })
        
        print(f"\n📧 Sample {idx}:")
        print(f"   Text: {text[:60]}...")
        print(f"   🔷 Predicted: {predicted}")
        print(f"   🔹 Ground truth: {ground_truth_entities}")
        
        # Check matches
        if predicted == ground_truth_entities:
            print(f"   ✅ MATCH!")
        else:
            print(f"   ❌ MISMATCH!")
    
    # Statistics
    print("\n" + "=" * 60)
    print("📊 STATISTICS")
    print("=" * 60)
    
    print(f"\nTotal samples tested: {min(20, len(validation_data))}")
    print(f"\n📝 Entity types found:")
    for label, count in entity_counts.most_common():
        print(f"   {label}: {count}")
    
    # Accuracy
    matches = 0
    for _, (text, ground_truth) in enumerate(validation_data[:20]):
        predicted = extract_entities_from_text(nlp, text)
        if predicted == ground_truth:
            matches += 1
    
    accuracy = (matches / min(20, len(validation_data))) * 100
    print(f"\n✨ Accuracy (exact match): {accuracy:.1f}%")
    
    print("\n" + "=" * 60)
    print("✅ TEST COMPLETE!")
    print("=" * 60)


if __name__ == "__main__":
    test_ner_model()