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
        
        # Create matchers (fallback)
        try:
            self.matcher_fr = self._create_address_matcher(self.nlp_fr)
            self.matcher_en = self._create_address_matcher(self.nlp_en)
            print("   ✅ Address matchers created")
        except Exception as e:
            print(f"   ❌ Failed to create matchers: {e}")
            raise
        
        # Load NER model
        self.ner_model = None
        self._load_ner_model()
        
        print("✅ All models initialized!\n")
    
    def _load_ner_model(self):
        """Load full NER model (ADDRESS, SHOP_NAME, TRACKING)"""
        
        possible_paths = [
            Path("/app/trained_models/models-final/ner_full"),
            Path("/app/trained_models/ner_full/model-best"),
            Path("models-final/ner_full"),
        ]
        
        ner_path = None
        for path in possible_paths:
            if path.exists():
                ner_path = path
                print(f"   📂 Found NER model at: {path}")
                break
        
        if not ner_path:
            print(f"   ⚠️  NER model not found")
            self.ner_model = None
            return
        
        try:
            self.ner_model = spacy.load(str(ner_path))
            print("   ✅ NER model loaded!")
        except Exception as e:
            print(f"   ❌ Failed to load NER model: {e}")
            self.ner_model = None
    
    def _create_address_matcher(self, nlp):
        """Create address pattern matcher for French and English"""
        matcher = Matcher(nlp.vocab)
        
        patterns = [
            # FRENCH PATTERNS
            [
                {"IS_DIGIT": True, "OP": "?"},
                {"LOWER": {"IN": ["rue", "avenue", "boulevard", "allée", "place", "chemin", "quai", "impasse", "passage", "square"]}},
                {"IS_ALPHA": True, "OP": "*"},
                {"IS_DIGIT": True, "OP": "*"},
                {"ORTH": ",", "OP": "?"},
                {"IS_DIGIT": True, "LENGTH": 5},
                {"IS_ALPHA": True, "OP": "*"}
            ],
            [
                {"IS_DIGIT": True, "LENGTH": 5},
                {"IS_ALPHA": True, "OP": "+"}
            ],
            
            # ENGLISH PATTERNS
            [
                {"IS_DIGIT": True, "OP": "?"},
                {"LOWER": {"IN": ["street", "road", "avenue", "boulevard", "place", "way", "drive", "lane", "court", "circle", "park"]}},
                {"IS_ALPHA": True, "OP": "*"},
                {"ORTH": ",", "OP": "?"},
                {"IS_DIGIT": True, "LENGTH": 5},
                {"IS_ALPHA": True, "OP": "+"}
            ],
            [
                {"IS_DIGIT": True, "LENGTH": 5},
                {"IS_ALPHA": True, "OP": "+"}
            ]
        ]
        
        matcher.add("ADDRESS", patterns)
        return matcher
    
    def _extract_addresses(self, text, matcher, nlp):
        """Extract addresses from text (fallback)"""
        
        content_limit = int(len(text) * 1.0)
        main_content = text[:content_limit]
        
        doc = nlp(main_content[:3000])
        matches = matcher(doc)
        
        addresses = []
        
        if matches:
            best_matches = []
            for match_id, start, end in matches:
                addr_text = doc[start:end].text.strip()
                if len(addr_text) > 5:
                    best_matches.append((start, end, addr_text))
            
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
    
    def _extract_tracking(self, text):
        """Extract tracking numbers from text"""
        
        patterns = [
            r'\b([0-9]{8,15})\b',
            r'\b([A-Z]{2}[0-9]{9}[A-Z]{2})\b',
            r'\b(1Z[0-9A-Z]{16})\b',
            r'\b([0-9]{3}-[0-9]{7}-[0-9]{7})\b',
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
        
        # Extract with NER model
        addresses = []
        shop_name = None
        
        if self.ner_model:
            doc = self.ner_model(text[:3000])
            
            # Extract ADDRESS entities
            for ent in doc.ents:
                if ent.label_ == "ADDRESS":
                    addr = ent.text.strip()
                    if len(addr) > 5 and addr not in addresses:
                        addresses.append(addr)
                
                # Extract first SHOP_NAME
                elif ent.label_ == "SHOP_NAME" and not shop_name:
                    shop_name = ent.text.strip()
        
        # Fallback: use matcher if NER not available
        if not addresses and self.ner_model is None:
            nlp = self.nlp_en if lang == "en" else self.nlp_fr
            matcher = self.matcher_en if lang == "en" else self.matcher_fr
            addresses = self._extract_addresses(text, matcher, nlp)
        
        # Extract tracking
        tracking = self._extract_tracking(text)
        
        return {
            "trackingNumbers": tracking,
            "pickupAddress": addresses[0] if addresses else None,
            "deliveryAddress": addresses[1] if len(addresses) > 1 else None,
            "shopName": shop_name,
            "language": lang,
        }