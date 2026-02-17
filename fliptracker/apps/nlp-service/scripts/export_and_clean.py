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
    raise ValueError("❌ Secret FIREBASE_SERVICE_ACCOUNT_BASE64 manquant.")

creds_json = json.loads(base64.b64decode(base64_creds).decode('utf-8'))

# 2. Initialisation
if not firebase_admin._apps:
    print(f"📡 Connexion au projet : {creds_json.get('project_id')}")
    cred = credentials.Certificate(creds_json)
    firebase_admin.initialize_app(cred)

db = firestore.client()

def clean_content(html_content):
    if not html_content: return ""
    try:
        # Utilisation de html.parser (standard)
        soup = BeautifulSoup(html_content, "html.parser")
        
        # On dégage le gras inutile
        for s in soup(["script", "style", "head", "title", "meta", "header", "footer"]):
            s.decompose()
        
        text = soup.get_text(separator=' ')
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        full_text = "\n".join(lines)
        
        # Filtre anti-bruit ciblé Chronopost / Pickup / Bruit légal
        stop_keywords = ["Chronopost SAS", "©", "Siège social", "RCS Paris", "Prière de ne pas répondre"]
        for word in stop_keywords:
            if word in full_text:
                full_text = full_text.split(word)[0]
        
        return full_text.strip()
    except Exception as e:
        return f"ERROR_CLEANING: {str(e)}"

def run_export():
    print("🔎 Recherche dans la collection 'rawEmails'...")
    
    # On utilise .get() sans orderBy pour éviter les problèmes d'index
    # On récupère les 100 derniers emails
    docs = db.collection('rawEmails').limit(1000).get()

    filename = f"emails_to_label_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    with open(filename, mode='w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['doc_id', 'text_to_label'])

        count = 0
        for doc in docs:
            data = doc.to_dict()
            # On cherche le champ 'rawBody'
            raw_html = data.get('rawBody', '')
            
            if raw_html:
                clean_text = clean_content(raw_html)
                writer.writerow([doc.id, clean_text])
                count += 1
                if count % 10 == 0:
                    print(f"✅ {count} emails traités...")
            
    if count == 0:
        print("⚠️ Aucun contenu trouvé dans le champ 'rawBody'. Vérifie les noms de champs !")
    else:
        print(f"🚀 Succès ! {count} emails exportés dans {filename}")

if __name__ == "__main__":
    run_export()