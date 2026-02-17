import os
import json
import base64
import firebase_admin
from firebase_admin import credentials, firestore
from bs4 import BeautifulSoup
import csv
from datetime import datetime

# 1. Décodage du secret Base64
base64_creds = os.getenv("FIREBASE_SERVICE_ACCOUNT_BASE64")

if not base64_creds:
    raise ValueError("❌ La variable FIREBASE_SERVICE_ACCOUNT_BASE64 est vide ou absente.")

# Décodage et conversion en dictionnaire JSON
creds_json = json.loads(base64.b64decode(base64_creds).decode('utf-8'))

# 2. Initialisation Firestore
if not firebase_admin._apps:
    cred = credentials.Certificate(creds_json)
    firebase_admin.initialize_app(cred)

db = firestore.client()

def clean_content(html_content):
    if not html_content: return ""
    try:
        soup = BeautifulSoup(html_content, "html.parser")
        # On décompose les éléments bruyants
        for s in soup(["script", "style", "head", "title", "meta", "header", "footer"]):
            s.decompose()
        
        text = soup.get_text(separator=' ')
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        full_text = "\n".join(lines)
        
        # Filtre anti-bruit (Mentions légales)
        stop_keywords = ["Chronopost SAS", "©", "Siège social", "RCS Paris", "Prière de ne pas répondre"]
        for word in stop_keywords:
            if word in full_text:
                full_text = full_text.split(word)[0]
        
        return full_text.strip()
    except Exception as e:
        return f"ERROR: {str(e)}"

def run_export():
    print("📡 Récupération des données Firestore...")
    docs = db.collection('parcel_reports').order_by('createdAt', direction=firestore.Query.DESCENDING).limit(200).stream()

    filename = f"data_to_annotate_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    with open(filename, mode='w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['id', 'carrier', 'text_to_label'])

        count = 0
        for doc in docs:
            data = doc.to_dict()
            clean_text = clean_content(data.get('rawEmail', ''))
            writer.writerow([doc.id, data.get('carrier', 'None'), clean_text])
            count += 1
            
    print(f"✅ Export réussi : {count} lignes dans {filename}")

if __name__ == "__main__":
    run_export()