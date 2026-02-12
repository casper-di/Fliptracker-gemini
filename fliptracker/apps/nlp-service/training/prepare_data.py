"""
FlipTracker NLP — Auto-annotation Pipeline

Takes weakly-labeled training samples and produces:
1. BIO-tagged NER annotations (for spaCy training)
2. Classification labels (carrier, type, marketplace)

Uses regex patterns to locate entities in the stripped text,
then aligns them with tokenized positions.

Usage:
    python training/prepare_data.py
"""
import json
import re
import random
from pathlib import Path
from typing import Optional

from bs4 import BeautifulSoup


# ── HTML stripping ──────────────────────────────────────────────────
def strip_html(html: str) -> str:
    """Convert HTML to clean text preserving structure."""
    if not html:
        return ""
    soup = BeautifulSoup(html, "lxml")
    # Remove script/style
    for tag in soup(["script", "style"]):
        tag.decompose()
    # Get text with newlines for block elements
    text = soup.get_text(separator="\n")
    # Normalize whitespace
    lines = [line.strip() for line in text.splitlines()]
    text = "\n".join(line for line in lines if line)
    return text


# ── Entity alignment ──────────────────────────────────────────────
def find_entity_spans(text: str, entity_value: str, label: str) -> list[tuple[int, int, str]]:
    """Find all occurrences of entity_value in text, return (start, end, label) spans."""
    if not entity_value or not text:
        return []
    spans = []
    # Try exact match first
    start = 0
    value_clean = entity_value.strip()
    while True:
        idx = text.find(value_clean, start)
        if idx == -1:
            break
        spans.append((idx, idx + len(value_clean), label))
        start = idx + 1
        break  # Only take first match
    
    # If no exact match, try case-insensitive
    if not spans:
        text_lower = text.lower()
        value_lower = value_clean.lower()
        idx = text_lower.find(value_lower)
        if idx != -1:
            spans.append((idx, idx + len(value_clean), label))
    
    return spans


def find_tracking_spans(text: str, tracking: str) -> list[tuple[int, int, str]]:
    """Find tracking number in text with fuzzy matching."""
    if not tracking:
        return []
    # Direct search
    spans = find_entity_spans(text, tracking, "TRACKING")
    if spans:
        return spans
    # Try regex escape
    pattern = re.escape(tracking)
    m = re.search(pattern, text, re.IGNORECASE)
    if m:
        return [(m.start(), m.end(), "TRACKING")]
    return []


def find_address_spans(text: str, address: str) -> list[tuple[int, int, str]]:
    """Find address in text — addresses can span multiple lines."""
    if not address:
        return []
    # Try full address
    spans = find_entity_spans(text, address, "ADDRESS")
    if spans:
        return spans
    
    # Try finding the postal code part (most unique)
    postal_match = re.search(r"\d{5}", address)
    if postal_match:
        postal = postal_match.group()
        # Find postal code in text, then expand to surrounding address-like text
        for m in re.finditer(re.escape(postal), text):
            # Take 100 chars before and 50 after the postal code
            start = max(0, m.start() - 100)
            end = min(len(text), m.end() + 50)
            # Trim to line boundaries
            while start > 0 and text[start] not in "\n.":
                start -= 1
            if text[start] in "\n.":
                start += 1
            while end < len(text) and text[end] not in "\n.":
                end += 1
            candidate = text[start:end].strip()
            if len(candidate) >= 15:
                return [(start, start + len(candidate), "ADDRESS")]
    return []


# ── Build NER annotations ────────────────────────────────────────
def annotate_sample(sample: dict) -> Optional[dict]:
    """
    Convert a training sample to spaCy NER format.
    Returns: {"text": str, "entities": [(start, end, label), ...], "cats": {...}}
    """
    body = sample.get("body", "")
    if not body:
        return None
    
    text = strip_html(body)
    if len(text) < 20:
        return None
    
    # Truncate very long texts (CamemBERT max 512 tokens ≈ 2000 chars)
    if len(text) > 3000:
        text = text[:3000]
    
    labels = sample.get("labels", {})
    entities = []
    
    # Find each entity in the text
    tracking = labels.get("trackingNumber")
    if tracking:
        entities.extend(find_tracking_spans(text, tracking))
    
    address = labels.get("pickupAddress")
    if address:
        entities.extend(find_address_spans(text, address))
    
    recipient = labels.get("recipientName")
    if recipient:
        entities.extend(find_entity_spans(text, recipient, "PERSON"))
    
    sender = labels.get("senderName")
    if sender:
        entities.extend(find_entity_spans(text, sender, "PERSON"))
    
    withdrawal = labels.get("withdrawalCode")
    if withdrawal:
        entities.extend(find_entity_spans(text, withdrawal, "WITHDRAWAL_CODE"))
    
    order = labels.get("orderNumber")
    if order:
        entities.extend(find_entity_spans(text, order, "ORDER"))
    
    product = labels.get("productName")
    if product and len(product) > 3:
        entities.extend(find_entity_spans(text, product, "PRODUCT"))
    
    # Find prices in text
    price = labels.get("estimatedValue")
    if price:
        price_str = str(price)
        price_patterns = [
            rf"({re.escape(price_str)}\s*[€$£])",
            rf"([€$£]\s*{re.escape(price_str)})",
            rf"({re.escape(price_str)}\s*EUR)",
        ]
        for pp in price_patterns:
            m = re.search(pp, text)
            if m:
                entities.append((m.start(), m.end(), "PRICE"))
                break

    # Remove overlapping entities (keep longest)
    entities = resolve_overlaps(entities)
    
    # Classification labels
    cats = {
        "carrier": labels.get("carrier", "other"),
        "type": labels.get("type", "unknown"),
        "marketplace": labels.get("marketplace") or "none",
        "email_type": labels.get("emailType", "unknown"),
        "is_tracking": labels.get("isTrackingEmail", False),
    }
    
    return {
        "text": text,
        "entities": entities,
        "cats": cats,
        "meta": {
            "id": sample.get("id"),
            "subject": sample.get("subject"),
            "from": sample.get("from"),
        },
    }


def resolve_overlaps(entities: list[tuple[int, int, str]]) -> list[tuple[int, int, str]]:
    """Remove overlapping entities, keeping the longest span."""
    if not entities:
        return []
    # Sort by start position, then by length (descending)
    entities.sort(key=lambda e: (e[0], -(e[1] - e[0])))
    result = []
    last_end = -1
    for start, end, label in entities:
        if start >= last_end:
            result.append((start, end, label))
            last_end = end
    return result


# ── spaCy format conversion ──────────────────────────────────────
def to_spacy_format(annotated: list[dict]) -> list[tuple[str, dict]]:
    """Convert to spaCy training format: [(text, {"entities": [(s,e,l)]})]"""
    result = []
    for item in annotated:
        result.append((item["text"], {"entities": item["entities"]}))
    return result


def to_classification_dataset(annotated: list[dict]) -> dict:
    """Create classification datasets for carrier, type, marketplace, email_type."""
    carrier_data = []
    type_data = []
    marketplace_data = []
    email_type_data = []
    
    for item in annotated:
        text = item["text"][:1000]  # Truncate for classifier
        subject = item.get("meta", {}).get("subject", "")
        from_addr = item.get("meta", {}).get("from", "")
        combined = f"Subject: {subject}\nFrom: {from_addr}\n\n{text}"
        
        cats = item["cats"]
        
        if cats["carrier"] and cats["carrier"] != "other":
            carrier_data.append({"text": combined, "label": cats["carrier"]})
        
        if cats["type"] and cats["type"] != "unknown":
            type_data.append({"text": combined, "label": cats["type"]})
        
        if cats["marketplace"] and cats["marketplace"] != "none":
            marketplace_data.append({"text": combined, "label": cats["marketplace"]})
        
        if cats.get("email_type") and cats["email_type"] != "unknown":
            email_type_data.append({"text": combined, "label": cats["email_type"]})
    
    return {
        "carrier": carrier_data,
        "type": type_data,
        "marketplace": marketplace_data,
        "email_type": email_type_data,
    }


# ── Main ─────────────────────────────────────────────────────────
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
    
    print(f"   Annotated: {len(annotated)}")
    print(f"   Skipped (no body): {skipped}")
    
    # Stats
    entity_counts = {}
    for item in annotated:
        for _, _, label in item["entities"]:
            entity_counts[label] = entity_counts.get(label, 0) + 1
    
    print("\n📊 Entity counts:")
    for label, count in sorted(entity_counts.items(), key=lambda x: -x[1]):
        print(f"   {label}: {count}")
    
    has_entities = sum(1 for item in annotated if item["entities"])
    print(f"\n   Samples with entities: {has_entities}/{len(annotated)}")
    
    # Classification stats
    cls_data = to_classification_dataset(annotated)
    print("\n📊 Classification dataset sizes:")
    for name, data in cls_data.items():
        labels = {}
        for d in data:
            labels[d["label"]] = labels.get(d["label"], 0) + 1
        print(f"   {name}: {len(data)} samples → {labels}")
    
    # Split train/val (80/20)
    random.seed(42)
    random.shuffle(annotated)
    split_idx = int(len(annotated) * 0.8)
    train_data = annotated[:split_idx]
    val_data = annotated[split_idx:]
    
    print(f"\n✂️  Split: {len(train_data)} train / {len(val_data)} val")
    
    # Save
    output_dir = data_dir / "annotated"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    for name, data in [("train", train_data), ("val", val_data), ("all", annotated)]:
        path = output_dir / f"{name}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"   💾 {path}")
    
    # Save classification datasets
    for name, data in cls_data.items():
        path = output_dir / f"cls_{name}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"   💾 {path}")
    
    # Save spaCy format
    spacy_train = to_spacy_format(train_data)
    spacy_val = to_spacy_format(val_data)
    for name, data in [("spacy_train", spacy_train), ("spacy_val", spacy_val)]:
        path = output_dir / f"{name}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"   💾 {path}")
    
    print("\n✅ Annotation complete!")


if __name__ == "__main__":
    main()
