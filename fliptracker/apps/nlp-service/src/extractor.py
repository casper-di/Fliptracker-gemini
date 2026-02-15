import spacy
from spacy.matcher import Matcher
import re
from bs4 import BeautifulSoup
from pathlib import Path

class HybridExtractor:
    def __init__(self):
        print("⚡ Loading models...")
        
        # Load spaCy models
        try:
            self.nlp_fr = spacy.load("fr_core_news_sm", disable=["parser", "lemmatizer"])
            self.nlp_en = spacy.load("en_core_web_sm", disable=["parser", "lemmatizer"])
            print("   ✅ spaCy models loaded")
        except Exception as e:
            print(f"   ❌ Failed to load spaCy models: {e}")
            raise
        
        # Create matchers
        try:
            self.matcher_fr = self._create_address_matcher(self.nlp_fr)
            self.matcher_en = self._create_address_matcher(self.nlp_en)
            print("   ✅ Address matchers created")
        except Exception as e:
            print(f"   ❌ Failed to create matchers: {e}")
            raise
        
        # Load carrier model with DEBUG
        self.carrier_model = None
        self._load_carrier_model()
        
        print("✅ All models initialized!\n")
    
    def _load_carrier_model(self):
        """Load carrier model from multiple possible locations"""
        
        # Try multiple paths
        possible_paths = [
            Path("/app/trained_models/models-final/carrier"),
            Path("/app/trained_models/ner_model/model-best"),
            Path("/app/trained_models/carrier"),
            Path("models-final/carrier"),
        ]
        
        carrier_path = None
        
        # Find the first existing path
        for path in possible_paths:
            if path.exists():
                carrier_path = path
                print(f"   📂 Found carrier model at: {path}")
                break
        
        if not carrier_path:
            print(f"   ❌ Carrier model not found in any expected location")
            print(f"   📂 Checked paths:")
            for path in possible_paths:
                print(f"      - {path}")
            
            print(f"   📂 /app/trained_models/ contents:")
            parent = Path("/app/trained_models")
            if parent.exists():
                try:
                    for item in parent.iterdir():
                        print(f"      - {item.name}")
                        if item.is_dir():
                            for subitem in item.iterdir():
                                print(f"         - {subitem.name}")
                except Exception as e:
                    print(f"      Error listing: {e}")
            else:
                print(f"      /app/trained_models does not exist")
            
            self.carrier_model = None
            return
        
        # Try to load the model
        try:
            print(f"   📂 Loading model from: {carrier_path}")
            self.carrier_model = spacy.load(str(carrier_path))
            print("   ✅ Carrier model loaded successfully!")
        except Exception as e:
            print(f"   ❌ Failed to load carrier model: {e}")
            print(f"   📂 Files in model directory:")
            try:
                for item in carrier_path.iterdir():
                    print(f"      - {item.name}")
            except Exception as e2:
                print(f"      Error listing: {e2}")
            self.carrier_model = None
    
    def _create_address_matcher(self, nlp):
        """Create address pattern matcher for French and English"""
        matcher = Matcher(nlp.vocab)
        
        patterns = [
            # ========================================
            # FRENCH PATTERNS
            # ========================================
            # Pattern 1: Numéro + RUE/AVENUE + CODE POSTAL + VILLE
            [
                {"IS_DIGIT": True, "OP": "?"},
                {"LOWER": {"IN": ["rue", "avenue", "boulevard", "allée", "place", "chemin", "quai", "impasse", "passage", "square"]}},
                {"IS_ALPHA": True, "OP": "*"},
                {"IS_DIGIT": True, "OP": "*"},
                {"ORTH": ",", "OP": "?"},
                {"IS_DIGIT": True, "LENGTH": 5},
                {"IS_ALPHA": True, "OP": "*"}
            ],
            # Pattern 2: CODE POSTAL + VILLE (French)
            [
                {"IS_DIGIT": True, "LENGTH": 5},
                {"IS_ALPHA": True, "OP": "+"}
            ],
            
            # ========================================
            # ENGLISH PATTERNS
            # ========================================
            # Pattern 3: Numéro + STREET/ROAD/etc + CODE + CITY
            [
                {"IS_DIGIT": True, "OP": "?"},
                {"LOWER": {"IN": ["street", "road", "avenue", "boulevard", "place", "way", "drive", "lane", "court", "circle", "park"]}},
                {"IS_ALPHA": True, "OP": "*"},
                {"ORTH": ",", "OP": "?"},
                {"IS_DIGIT": True, "LENGTH": 5},
                {"IS_ALPHA": True, "OP": "+"}
            ],
            # Pattern 4: USA Postal Code (5 digits) + CITY
            [
                {"IS_DIGIT": True, "LENGTH": 5},
                {"IS_ALPHA": True, "OP": "+"}
            ]
        ]
        
        matcher.add("ADDRESS", patterns)
        return matcher
    
    def _extract_addresses(self, text, matcher, nlp):
        """Extract addresses from text"""
        
        # ✅ CHANGE 1: Use 100% of content (was 0.80)
        content_limit = int(len(text) * 1.0)
        main_content = text[:content_limit]
        
        doc = nlp(main_content[:3000])
        matches = matcher(doc)
        
        addresses = []
        
        if matches:
            # Get all candidate addresses
            best_matches = []
            for match_id, start, end in matches:
                addr_text = doc[start:end].text.strip()
                if len(addr_text) > 5:
                    best_matches.append((start, end, addr_text))
            
            # Remove duplicates (keep longest)
            seen = set()
            for start, end, addr_text in sorted(best_matches, key=lambda x: -(x[1]-x[0])):
                is_duplicate = False
                
                for s, e, a in seen:
                    if addr_text in a or a in addr_text:
                        is_duplicate = True
                        break
                
                if not is_duplicate:
                    addresses.append(addr_text)
                    seen.add((start, end, addr_text))
        
        return addresses
    
    def _extract_carrier(self, text):
        """Extract carrier from text using NER model"""
        if not self.carrier_model:
            return None
        
        try:
            doc = self.carrier_model(text[:3000])
            
            for ent in doc.ents:
                if ent.label_ == "ORG":
                    return {
                        "label": ent.text,
                        "confidence": 0.99
                    }
        except Exception as e:
            print(f"   ❌ Error extracting carrier: {e}")
        
        return None
    
    def _extract_tracking(self, text):
        """Extract tracking numbers from text"""
        
        # ✅ CHANGE 3: Added Amazon format
        patterns = [
            r'\b([0-9]{8,15})\b',  # 8-15 digits
            r'\b([A-Z]{2}[0-9]{9}[A-Z]{2})\b',  # International format
            r'\b(1Z[0-9A-Z]{16})\b',  # UPS format
            r'\b([0-9]{3}-[0-9]{7}-[0-9]{7})\b',  # Amazon format: 123-4567890-1234567
        ]
        
        tracking = set()
        for pattern in patterns:
            matches = re.findall(pattern, text)
            tracking.update(matches)
        
        return list(tracking)
    
    def process(self, raw_body: str, subject: str = "", sender: str = "") -> dict:
        """Main extraction pipeline"""
        
        # Clean HTML
        soup = BeautifulSoup(raw_body, "html.parser")
        for tag in soup(["script", "style"]):
            tag.decompose()
        text = soup.get_text()
        
        # Detect language
        try:
            from langdetect import detect
            lang = detect(text[:1000])
        except:
            lang = "fr"
        
        # Select NLP and matcher based on language
        nlp = self.nlp_en if lang == "en" else self.nlp_fr
        matcher = self.matcher_en if lang == "en" else self.matcher_fr
        
        # Extract all entities
        addresses = self._extract_addresses(text, matcher, nlp)
        carrier = self._extract_carrier(text)
        tracking = self._extract_tracking(text)
        
        # Return results
        return {
            "trackingNumbers": tracking,
            "pickupAddress": addresses[0] if addresses else None,
            "deliveryAddress": addresses[1] if len(addresses) > 1 else None,
            "carrier": carrier,
            "language": lang,
        }