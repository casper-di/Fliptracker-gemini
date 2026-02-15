"""
FlipTracker NLP — Auto-annotation Pipeline
Extrait les entités directement du texte avec regex
"""
import json
import re
import random
from pathlib import Path
from typing import Optional
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
    text = "\n".join(line for line in lines if line)
    return text


def find_tracking_numbers(text: str) -> list:
    """Extract tracking numbers using regex."""
    patterns = [
        r'\b([0-9]{8,15})\b',  # 8-15 digit numbers
        r'\b([A-Z]{2}[0-9]{9}[A-Z]{2})\b',  # Standard international
        r'\b(1Z[0-9A-Z]{16})\b',  # UPS
        r'\b(6A[0-9]{11})\b',  # Colissimo
    ]
    
    found = set()
    for pattern in patterns:
        for match in re.finditer(pattern, text):
            tracking = match.group(1)
            if len(tracking) > 6:
                found.add((match.start(1), match.end(1), 'TRACKING', tracking))
    
    return list(found)


def find_addresses(text: str) -> list:
    """Extract addresses using postal code patterns."""
    addresses = []
    
    # Find postal codes (French: 5 digits)
    for match in re.finditer(r'\d{5}', text):
        postal = match.group()
        # Expand around postal code
        start = max(0, match.start() - 150)
        end = min(len(text), match.end() + 50)
        
        # Trim to line boundaries
        while start > 0 and text[start-1] not in '\n':
            start -= 1
        while end < len(text) and text[end] not in '\n':
            end += 1
        
        address_text = text[start:end].strip()
        if len(address_text) > 15 and postal in address_text:
            addresses.append((start, end, 'ADDRESS', address_text))
    
    # Remove duplicates
    addresses = list(set(addresses))
    return addresses


def find_organizations(text: str) -> list:
    """Extract organization names."""
    orgs = []
    patterns = [
        ('CHRONOPOST', r'\bCHRONOPOST\b'),
        ('COLISSIMO', r'\bCOLISSIMO\b'),
        ('DHL', r'\bDHL\b'),
        ('UPS', r'\bUPS\b'),
        ('FEDEX', r'\bFEDEX\b'),
        ('MONDIAL RELAY', r'\bMONDIAL\s+RELAY\b'),
        ('RELAIS COLIS', r'\bRELAIS\s+COLIS\b'),
        ('LA POSTE', r'\bLA\s+POSTE\b'),
        ('AMAZON', r'\bAMAZON\b'),
        ('VINTED', r'\bVINTED\b'),
    ]
    
    for org_name, pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            orgs.append((match.start(), match.end(), 'ORG', org_name))
    
    return orgs


def find_dates(text: str) -> list:
    """Extract dates."""
    dates = []
    patterns = [
        r'\d{1,2}/\d{1,2}/\d{4}',  # DD/MM/YYYY
        r'\d{1,2}-\d{1,2}-\d{4}',  # DD-MM-YYYY
        r'\b(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{1,2}\b',  # Month names
    ]
    
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            dates.append((match.start(), match.end(), 'DATE', match.group()))
    
    return dates


def annotate_sample(sample: dict) -> Optional[dict]:
    """Convert a training sample to spaCy NER format."""
    body = sample.get("body", "")
    if not body or len(body) < 20:
        return None
    
    text = strip_html(body)
    if len(text) > 3000:
        text = text[:3000]
    
    # Extract all entities
    entities = []
    
    tracking_nums = find_tracking_numbers(text)
    entities.extend([(s, e, l) for s, e, l, _ in tracking_nums])
    
    addresses = find_addresses(text)
    entities.extend([(s, e, l) for s, e, l, _ in addresses])
    
    orgs = find_organizations(text)
    entities.extend([(s, e, l) for s, e, l, _ in orgs])
    
    dates = find_dates(text)
    entities.extend([(s, e, l) for s, e, l, _ in dates])
    
    # Remove duplicates and overlaps
    entities = list(set(entities))
    entities.sort(key=lambda x: x[0])
    
    # Remove overlapping
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
        print("❌ training_samples.json not found. Run export_data.py first.")
        return
    
    print("📂 Loading training samples...")
    with open(samples_path, "r", encoding="utf-8") as f:
        samples = json.load(f)
    print(f"   Loaded {len(samples)} samples")
    
    # Annotate
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