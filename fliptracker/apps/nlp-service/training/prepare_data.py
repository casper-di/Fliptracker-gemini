import json
import re
import random
from pathlib import Path
from bs4 import BeautifulSoup


def strip_html(html: str) -> str:
    if not html:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    lines = [line.strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def extract_entities(text: str) -> list:
    """Extract entities with CORRECT position alignment"""
    entities = []
    
    # TRACKING: Numbers 8-15 digits
    for match in re.finditer(r'\b([0-9]{8,15})\b', text):
        entities.append((match.start(1), match.end(1), 'TRACKING'))
    
    # ORG: Known companies (case insensitive)
    for match in re.finditer(r'\b(CHRONOPOST|COLISSIMO|DHL|UPS|FEDEX|AMAZON|VINTED|LA\s+POSTE|MONDIAL\s+RELAY|RELAIS\s+COLIS)\b', text, re.IGNORECASE):
        entities.append((match.start(), match.end(), 'ORG'))
    
    # ADDRESS: Postal code + context
    for match in re.finditer(r'\d{5}', text):
        start = max(0, match.start() - 100)
        end = min(len(text), match.end() + 30)
        addr_text = text[start:end]
        if len(addr_text) > 10:
            entities.append((start, end, 'ADDRESS'))
    
    # DATE: DD/MM/YYYY or month names
    for match in re.finditer(r'\d{1,2}[/-]\d{1,2}[/-]\d{4}|\b(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{1,2}\b', text, re.IGNORECASE):
        entities.append((match.start(), match.end(), 'DATE'))
    
    # Remove overlaps
    entities = list(set(entities))
    entities.sort(key=lambda x: x[0])
    
    final = []
    last_end = -1
    for start, end, label in entities:
        if start >= last_end and start < end:
            final.append((start, end, label))
            last_end = end
    
    return final


def annotate_sample(sample: dict):
    body = sample.get("body", "")
    if not body or len(body) < 20:
        return None
    
    text = strip_html(body)
    if len(text) > 3000:
        text = text[:3000]
    
    entities = extract_entities(text)
    
    if not entities:
        return None
    
    return {
        "text": text,
        "entities": entities
    }


def main():
    data_dir = Path(__file__).parent.parent / "data"
    samples_path = data_dir / "training_samples.json"
    
    if not samples_path.exists():
        print("❌ training_samples.json not found")
        return
    
    print("📂 Loading...")
    with open(samples_path, "r", encoding="utf-8") as f:
        samples = json.load(f)
    
    print(f"   Loaded {len(samples)} samples")
    
    print("\n🏷️  Annotating...")
    annotated = []
    for sample in samples:
        result = annotate_sample(sample)
        if result:
            annotated.append(result)
    
    print(f"   ✅ {len(annotated)} annotated")
    
    if not annotated:
        print("❌ No data!")
        return
    
    # Split
    random.seed(42)
    random.shuffle(annotated)
    split = int(len(annotated) * 0.8)
    train = annotated[:split]
    val = annotated[split:]
    
    print(f"   ✂️  {len(train)} train / {len(val)} val")
    
    # Save
    output_dir = data_dir / "annotated"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    spacy_train = [(item["text"], {"entities": item["entities"]}) for item in train]
    spacy_val = [(item["text"], {"entities": item["entities"]}) for item in val]
    
    for name, data in [("spacy_train", spacy_train), ("spacy_val", spacy_val)]:
        path = output_dir / f"{name}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        print(f"   💾 {path}")
    
    print("\n✅ Done!")


if __name__ == "__main__":
    main()