import os
import json
import base64
import firebase_admin
from firebase_admin import credentials, firestore
from bs4 import BeautifulSoup
from datetime import datetime

# 1. Décodage du secret Base64
base64_creds = os.getenv("FIREBASE_SERVICE_ACCOUNT_BASE64")
if not base64_creds:
    raise ValueError("❌ Secret FIREBASE_SERVICE_ACCOUNT_BASE64 manquant.")

creds_json = json.loads(base64.b64decode(base64_creds).decode('utf-8'))

# 2. Initialisation
if not firebase_admin._apps:
    cred = credentials.Certificate(creds_json)
    firebase_admin.initialize_app(cred)

db = firestore.client()

def clean_content(html_content):
    if not html_content: return ""
    try:
        soup = BeautifulSoup(html_content, "html.parser")
        for s in soup(["script", "style", "head", "title", "meta", "header", "footer"]):
            s.decompose()
        
        text = soup.get_text(separator=' ')
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        full_text = "\n".join(lines)
        
        # Filtre anti-bruit
        stop_keywords = ["Chronopost SAS", "©", "Siège social", "RCS Paris", "Prière de ne pas répondre"]
        for word in stop_keywords:
            if word in full_text:
                full_text = full_text.split(word)[0]
        
        return full_text.strip()
    except Exception:
        return ""

def run_export():
    print("🔎 Recherche dans 'rawEmails'...")
    # On récupère 500 documents
    docs = db.collection('rawEmails').limit(500).get()

    filename = f"data_to_label_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jsonl"
    
    with open(filename, 'w', encoding='utf-8') as f:
        count = 0
        for doc in docs:
            data = doc.to_dict()
            raw_html = data.get('rawBody', '')
            clean_text = clean_content(raw_html)
            
            if clean_text:
                # Structure JSONL standard pour spaCy / Doccano / Prodigy
                record = {
                    "id": doc.id,
                    "text": clean_text,
                    "label": [] # À remplir pendant l'annotation
                }
                f.write(json.dumps(record, ensure_ascii=False) + "\n")
                count += 1
            
    print(f"🚀 Succès ! {count} lignes exportées dans {filename}")

if __name__ == "__main__":
    run_export()