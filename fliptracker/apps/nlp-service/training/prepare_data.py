"""
FlipTracker NLP — Auto-annotation Pipeline v2
Extrait: TRACKING, ADDRESS, SHOP_NAME
Utilise regex intelligent pour détecter les shops
"""
import json
import re
import random
from pathlib import Path
from bs4 import BeautifulSoup


def strip_html(html: str) -> str:
    """Convert HTML to clean text."""
    if not html:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    lines = [line.strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def find_tracking_numbers(text: str) -> list:
    """Extract tracking numbers"""
    patterns = [
        r'\b([0-9]{8,15})\b',
        r'\b([A-Z]{2}[0-9]{9}[A-Z]{2})\b',
        r'\b(1Z[0-9A-Z]{16})\b',
        r'\b([0-9]{3}-[0-9]{7}-[0-9]{7})\b',
    ]
    
    found = set()
    for pattern in patterns:
        for match in re.finditer(pattern, text):
            found.add((match.start(), match.end(), 'TRACKING'))
    
    return list(found)


def find_shop_names(text: str) -> list:
    """
    Extract shop names using intelligent regex patterns
    Detects: Capitalized text BEFORE an address
    Examples: "Monoprix 90 Grande Rue", "N&H Relais 8 RUE DU CENTRE"
    """
    found = set()
    
    # Pattern: Capitalized word(s) + optional &/- + word(s) BEFORE an address
    # Lookahead: (?=\d+\s+(?:rue|avenue|boulevard|road|street|place|chemin))
    # This ensures we only match shop names that are followed by an address pattern
    
    pattern = r'\b([A-Z][A-Za-z&\-\s]*?)\s+(?=\d+\s+(?:rue|avenue|boulevard|place|chemin|quai|impasse|street|road|way|drive|lane|court))'
    
    for match in re.finditer(pattern, text, re.IGNORECASE):
        shop = match.group(1).strip()
        
        # Filter: remove very short or very long strings
        if 3 <= len(shop) <= 50:
            # Filter: avoid common words (articles, prepositions)
            skip_words = {"Le", "La", "Les", "De", "Du", "Et", "Ou", "Au", "Aux", "Un", "Une", "Des", "Pour", "Par", "The", "A", "An"}
            if shop not in skip_words:
                found.add((match.start(), match.end(), 'SHOP_NAME'))
    
    return list(found)


def find_addresses(text: str) -> list:
    """Extract addresses with postal codes"""
    addresses = []
    
    # Pattern 1: Numéro + RUE/AVENUE/STREET + CODE POSTAL
    patterns = [
        r'([0-9]{1,3}\s+(?:rue|avenue|boulevard|allée|place|chemin|quai|impasse|street|road|way|drive|lane),?\s+[0-9]{5})',
    ]
    
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            addresses.append((match.start(), match.end(), 'ADDRESS'))
    
    # Pattern 2: CODE POSTAL + CITY
    for match in re.finditer(r'([0-9]{5}\s+[A-Z][A-Za-z\s\-]+)', text):
        addresses.append((match.start(), match.end(), 'ADDRESS'))
    
    return list(set(addresses))


def annotate_sample(sample: dict) -> dict:
    """Convert a sample to NER format"""
    body = sample.get("body", "")
    if not body or len(body) < 20:
        return None
    
    text = strip_html(body)
    if len(text) > 3000:
        text = text[:3000]
    
    # Extract all entities
    entities = []
    entities.extend(find_tracking_numbers(text))
    entities.extend(find_addresses(text))
    entities.extend(find_shop_names(text))
    
    # Remove duplicates and overlaps
    entities = list(set(entities))
    entities.sort(key=lambda x: x[0])
    
    # Remove overlapping (keep first match)
    final_entities = []
    last_end = -1
    for start, end, label in entities:
        if start >= last_end:
            final_entities.append((start, end, label))
            last_end = end
    
    if not final_entities:
        return None
    
    return {
        "text": text,
        "entities": final_entities,
    }


def main():
    data_dir = Path(__file__).parent.parent / "data"
    samples_path = data_dir / "training_samples.json"
    
    if not samples_path.exists():
        print("❌ training_samples.json not found")
        return
    
    print("📂 Loading training samples...")
    with open(samples_path, "r", encoding="utf-8") as f:
        samples = json.load(f)
    print(f"   Loaded {len(samples)} samples")
    
    print("\n🏷️  Auto-annotating...")
    annotated = []
    skipped = 0
    for sample in samples:
        result = annotate_sample(sample)
        if result:
            annotated.append(result)
        else:
            skipped += 1
    
    print(f"   ✅ Annotated: {len(annotated)}")
    print(f"   ⏭️  Skipped: {skipped}")
    
    if not annotated:
        print("❌ No annotated data!")
        return
    
    # Entity statistics
    from collections import Counter
    entity_counts = Counter()
    for item in annotated:
        for _, _, label in item["entities"]:
            entity_counts[label] += 1
    
    print("\n📊 Entity types found:")
    for label, count in entity_counts.most_common():
        print(f"   {label}: {count}")
    
    # Split train/val
    random.seed(42)
    random.shuffle(annotated)
    split_idx = int(len(annotated) * 0.8)
    train_data = annotated[:split_idx]
    val_data = annotated[split_idx:]
    
    print(f"\n✂️  Split: {len(train_data)} train / {len(val_data)} val")
    
    # Save
    output_dir = data_dir / "annotated"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # spaCy format
    spacy_train = [(item["text"], {"entities": item["entities"]}) for item in train_data]
    spacy_val = [(item["text"], {"entities": item["entities"]}) for item in val_data]
    
    for name, data in [("spacy_train", spacy_train), ("spacy_val", spacy_val)]:
        path = output_dir / f"{name}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"   💾 {path}")
    
    print("\n✅ Annotation complete!")


if __name__ == "__main__":
    main()