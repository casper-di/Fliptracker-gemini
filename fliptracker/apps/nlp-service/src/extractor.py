"""
FlipTracker NLP — Entity Extractor

Loads trained models and performs inference on email text.
Extracts structured data: tracking numbers, addresses, names, carriers, etc.
"""
import json
import re
from typing import Optional
from pathlib import Path
from dataclasses import dataclass, field, asdict

import spacy
from bs4 import BeautifulSoup


@dataclass
class ExtractedEntity:
    """A single extracted entity."""
    text: str
    label: str
    start: int
    end: int
    confidence: float = 1.0


@dataclass
class ClassificationResult:
    """A classification prediction."""
    label: str
    confidence: float


@dataclass
class ExtractionResult:
    """Complete extraction result for an email."""
    # NER entities
    tracking_numbers: list[str] = field(default_factory=list)
    pickup_address: Optional[str] = None
    delivery_address: Optional[str] = None
    person_names: list[str] = field(default_factory=list)
    withdrawal_codes: list[str] = field(default_factory=list)
    order_numbers: list[str] = field(default_factory=list)
    product_names: list[str] = field(default_factory=list)
    prices: list[str] = field(default_factory=list)
    dates: list[str] = field(default_factory=list)
    
    # Classification
    carrier: Optional[ClassificationResult] = None
    shipment_type: Optional[ClassificationResult] = None
    marketplace: Optional[ClassificationResult] = None
    
    # Raw entities for debugging
    entities: list[ExtractedEntity] = field(default_factory=list)
    
    def to_dict(self) -> dict:
        result = {
            "trackingNumbers": self.tracking_numbers,
            "pickupAddress": self.pickup_address,
            "deliveryAddress": self.delivery_address,
            "personNames": self.person_names,
            "withdrawalCodes": self.withdrawal_codes,
            "orderNumbers": self.order_numbers,
            "productNames": self.product_names,
            "prices": self.prices,
            "dates": self.dates,
            "carrier": {"label": self.carrier.label, "confidence": self.carrier.confidence} if self.carrier else None,
            "shipmentType": {"label": self.shipment_type.label, "confidence": self.shipment_type.confidence} if self.shipment_type else None,
            "marketplace": {"label": self.marketplace.label, "confidence": self.marketplace.confidence} if self.marketplace else None,
            "entities": [asdict(e) for e in self.entities],
        }
        return result


class EmailExtractor:
    """
    Main extraction engine. Loads NER + classification models
    and processes email text into structured data.
    """
    
    def __init__(
        self,
        ner_model_path: str,
        cls_carrier_path: Optional[str] = None,
        cls_type_path: Optional[str] = None,
        cls_marketplace_path: Optional[str] = None,
    ):
        # Load NER model
        ner_path = Path(ner_model_path)
        if ner_path.exists():
            print(f"Loading NER model from {ner_path}...")
            self.nlp = spacy.load(ner_path)
            print(f"   NER labels: {self.nlp.get_pipe('ner').labels}")
        else:
            print(f"⚠️  NER model not found at {ner_path}. Using blank model.")
            self.nlp = spacy.blank("fr")
        
        # Load classification models
        self.cls_carrier = None
        self.cls_type = None
        self.cls_marketplace = None
        
        self._load_classifier("carrier", cls_carrier_path)
        self._load_classifier("type", cls_type_path)
        self._load_classifier("marketplace", cls_marketplace_path)
    
    def _load_classifier(self, name: str, model_path: Optional[str]):
        """Load a HuggingFace classification model."""
        if not model_path:
            return
        
        path = Path(model_path)
        label_map_path = path.parent / "label_map.json"
        
        if not path.exists():
            print(f"⚠️  {name} classifier not found at {path}")
            return
        
        try:
            from transformers import CamembertTokenizer, CamembertForSequenceClassification
            import torch
            
            tokenizer = CamembertTokenizer.from_pretrained(str(path))
            model = CamembertForSequenceClassification.from_pretrained(str(path))
            model.eval()
            
            labels = []
            if label_map_path.exists():
                with open(label_map_path, "r") as f:
                    labels = json.load(f)["labels"]
            
            setattr(self, f"cls_{name}", {
                "tokenizer": tokenizer,
                "model": model,
                "labels": labels,
            })
            print(f"   ✅ {name} classifier loaded ({len(labels)} labels)")
        except Exception as e:
            print(f"   ❌ Failed to load {name} classifier: {e}")
    
    def strip_html(self, text: str) -> str:
        """Remove HTML tags, preserving meaningful whitespace."""
        if "<" in text and ">" in text:
            soup = BeautifulSoup(text, "html.parser")
            # Replace block elements with newlines
            for tag in soup.find_all(["br", "p", "div", "tr", "li", "h1", "h2", "h3", "h4", "td"]):
                tag.insert_before("\n")
            text = soup.get_text()
        
        # Normalize whitespace
        text = re.sub(r'\n\s*\n', '\n', text)
        text = re.sub(r'[ \t]+', ' ', text)
        return text.strip()
    
    def extract(self, email_body: str, email_subject: str = "", sender: str = "") -> ExtractionResult:
        """
        Extract structured information from an email.
        
        Args:
            email_body: Raw email body (HTML or plain text)
            email_subject: Email subject line
            sender: Sender email address
            
        Returns:
            ExtractionResult with all extracted fields
        """
        result = ExtractionResult()
        
        # Clean text
        clean_text = self.strip_html(email_body)
        
        # Combine subject + body for full context
        full_text = f"{email_subject}\n{clean_text}" if email_subject else clean_text
        
        # Truncate if too long (CamemBERT max ~512 tokens ≈ ~2000 chars)
        # NER can handle longer text via strided spans
        ner_text = full_text[:10000]
        cls_text = full_text[:2000]
        
        # ── NER Extraction ──
        doc = self.nlp(ner_text)
        
        for ent in doc.ents:
            entity = ExtractedEntity(
                text=ent.text.strip(),
                label=ent.label_,
                start=ent.start_char,
                end=ent.end_char,
            )
            result.entities.append(entity)
            
            if ent.label_ == "TRACKING":
                cleaned = self._clean_tracking(ent.text)
                if cleaned and cleaned not in result.tracking_numbers:
                    result.tracking_numbers.append(cleaned)
            elif ent.label_ == "ADDRESS":
                addr = ent.text.strip()
                if not result.pickup_address:
                    result.pickup_address = addr
                elif not result.delivery_address:
                    result.delivery_address = addr
            elif ent.label_ == "PERSON":
                name = ent.text.strip()
                if name not in result.person_names:
                    result.person_names.append(name)
            elif ent.label_ == "WITHDRAWAL_CODE":
                code = ent.text.strip()
                if code not in result.withdrawal_codes:
                    result.withdrawal_codes.append(code)
            elif ent.label_ == "ORDER":
                order = ent.text.strip()
                if order not in result.order_numbers:
                    result.order_numbers.append(order)
            elif ent.label_ == "PRODUCT":
                product = ent.text.strip()
                if product not in result.product_names:
                    result.product_names.append(product)
            elif ent.label_ == "PRICE":
                result.prices.append(ent.text.strip())
            elif ent.label_ == "DATE":
                result.dates.append(ent.text.strip())
        
        # ── Fallback: Regex extraction for tracking if NER found none ──
        if not result.tracking_numbers:
            result.tracking_numbers = self._regex_tracking_fallback(clean_text)
        
        # ── Classification ──
        result.carrier = self._classify("carrier", cls_text)
        result.shipment_type = self._classify("type", cls_text)
        result.marketplace = self._classify("marketplace", cls_text)
        
        # ── Sender-based carrier hint ──
        if sender and (not result.carrier or result.carrier.confidence < 0.5):
            carrier_hint = self._carrier_from_sender(sender)
            if carrier_hint:
                result.carrier = ClassificationResult(label=carrier_hint, confidence=0.9)
        
        return result
    
    def _clean_tracking(self, raw: str) -> Optional[str]:
        """Clean extracted tracking number."""
        # Strip common prefixes
        cleaned = re.sub(
            r'^(?:n°?\s*(?:de\s*)?(?:suivi|colis|commande)\s*:?\s*|'
            r'suivi\s*:?\s*|colis\s*:?\s*|tracking\s*:?\s*)',
            '', raw, flags=re.IGNORECASE
        ).strip()
        
        # Remove spaces and dashes
        cleaned = re.sub(r'[\s\-]', '', cleaned)
        
        # Validate: must be alphanumeric, 6-40 chars
        if re.match(r'^[A-Za-z0-9]{6,40}$', cleaned):
            return cleaned.upper()
        return None
    
    def _regex_tracking_fallback(self, text: str) -> list[str]:
        """Fallback regex extraction for tracking numbers."""
        patterns = [
            r'\b([A-Z]{2}\d{9}[A-Z]{2})\b',         # International postal (e.g., CB123456789FR)
            r'\b(\d{4}\s?\d{4}\s?\d{4}\s?\d{1,4})\b', # Colissimo 13-16 digits
            r'\b([A-Z]{2}\d{11,13})\b',                # PP-format
            r'\b(\d{20,22})\b',                         # Mondial Relay / Chronopost
            r'\b(JD\d{18})\b',                          # MR / JD
            r'\b(1Z[A-Z0-9]{16})\b',                    # UPS
            r'\b(\d{12,15})\b',                          # FedEx / DHL
        ]
        found = []
        for pattern in patterns:
            for match in re.finditer(pattern, text):
                num = re.sub(r'\s', '', match.group(1)).upper()
                if num not in found:
                    found.append(num)
        return found[:3]  # Max 3 tracking numbers
    
    def _classify(self, task: str, text: str) -> Optional[ClassificationResult]:
        """Run classification model on text."""
        classifier = getattr(self, f"cls_{task}", None)
        if not classifier:
            return None
        
        try:
            import torch
            
            tokenizer = classifier["tokenizer"]
            model = classifier["model"]
            labels = classifier["labels"]
            
            inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
            with torch.no_grad():
                outputs = model(**inputs)
                probs = torch.softmax(outputs.logits, dim=-1)
                pred_idx = probs.argmax(-1).item()
                confidence = probs[0][pred_idx].item()
            
            if pred_idx < len(labels):
                return ClassificationResult(label=labels[pred_idx], confidence=confidence)
        except Exception as e:
            print(f"Classification error ({task}): {e}")
        
        return None
    
    def _carrier_from_sender(self, sender: str) -> Optional[str]:
        """Detect carrier from sender email address."""
        sender_lower = sender.lower()
        carrier_map = {
            "colissimo": "colissimo",
            "laposte": "colissimo",
            "chronopost": "chronopost",
            "mondialrelay": "mondial_relay",
            "mondial-relay": "mondial_relay",
            "dhl": "dhl",
            "ups": "ups",
            "fedex": "fedex",
            "dpd": "dpd",
            "gls": "gls",
            "amazon": "amazon_logistics",
            "relais-colis": "relais_colis",
            "vinted": "vinted_go",
        }
        for key, carrier in carrier_map.items():
            if key in sender_lower:
                return carrier
        return None
