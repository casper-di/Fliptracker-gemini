import os
import json
import base64
import firebase_admin
from firebase_admin import credentials, firestore
from bs4 import BeautifulSoup
from datetime import datetime

# 1. Configuration Firebase (via variable d'environnement GitHub Secrets)
base64_creds = os.getenv("FIREBASE_SERVICE_ACCOUNT_BASE64")
if not base64_creds:
    raise ValueError("❌ Erreur : Le secret FIREBASE_SERVICE_ACCOUNT_BASE64 est vide ou manquant.")

creds_json = json.loads(base64.b64decode(base64_creds).decode('utf-8'))

if not firebase_admin._apps:
    cred = credentials.Certificate(creds_json)
    firebase_admin.initialize_app(cred)

db = firestore.client()

def clean_content(html_content):
    """
    Nettoie le HTML et transforme le texte en une seule ligne propre 
    sans sauts de ligne (\n) ni espaces multiples.
    """
    if not html_content: 
        return ""
    try:
        soup = BeautifulSoup(html_content, "html.parser")
        
        # Supprimer les balises bruyantes
        for s in soup(["script", "style", "head", "title", "meta", "header", "footer"]):
            s.decompose()
        
        # Extraire le texte avec un espace comme séparateur
        raw_text = soup.get_text(separator=' ')
        
        # --- LA MAGIE DE LA FIABILITÉ ---
        # .split() découpe sur TOUS les types d'espaces (\n, \t, \xa0, espaces multiples)
        # " ".join() regroupe tout avec UN SEUL espace standard.
        clean_text = " ".join(raw_text.split())
        
        # Nettoyage des mentions légales (optionnel)
        stop_keywords = ["Chronopost SAS", "©", "Siège social", "RCS Paris"]
        for word in stop_keywords:
            if word in clean_text:
                clean_text = clean_text.split(word)[0]
        
        return clean_text.strip()
    except Exception as e:
        print(f"⚠️ Erreur nettoyage : {e}")
        return ""

def run_export():
    print("🔎 Connexion à Firestore et récupération des données...")
    
    # On limite à 500 pour ton lot d'entraînement
    docs = db.collection('rawEmails').limit(500).get()

    # Nom du fichier avec horodatage
    filename = f"data_to_label_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jsonl"
    
    count = 0
    with open(filename, 'w', encoding='utf-8') as f:
        for doc in docs:
            data = doc.to_dict()
            raw_html = data.get('rawBody', '')
            
            # Nettoyage linéaire
            clean_text = clean_content(raw_html)
            
            if clean_text and len(clean_text) > 20: # On évite les mails vides/trop courts
                # Structure JSONL optimisée pour l'annotation
                record = {
                    "id": doc.id,
                    "text": clean_text,
                    "label": []  # À remplir via script de matching ou outil web
                }
                f.write(json.dumps(record, ensure_ascii=False) + "\n")
                count += 1
            
    print(f"---")
    print(f"🚀 SUCCÈS : {count} documents exportés.")
    print(f"📂 Fichier généré : {filename}")
    print(f"💡 Note : Le texte est maintenant linéaire, parfait pour l'annotation !")

if __name__ == "__main__":
    run_export()