import os
import json
from pathlib import Path
from bs4 import BeautifulSoup

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "training/firebase.json"

from google.cloud import firestore

def export_for_annotation(limit: int = 300):
    """Export rawEmails from Firestore for manual annotation"""
    
    print("\n" + "="*60)
    print("📂 EXPORTING RAWEMALS FROM FIRESTORE")
    print("="*60)
    
    try:
        db = firestore.Client()
        emails = []
        
        # Get rawEmails
        docs = db.collection("rawEmails").limit(limit).stream()
        
        for i, doc in enumerate(docs, 1):
            data = doc.to_dict()
            
            # Extract from rawBody (HTML)
            raw_body = data.get("rawBody", "")
            soup = BeautifulSoup(raw_body, "html.parser")
            for tag in soup(["script", "style"]):
                tag.decompose()
            clean_text = soup.get_text()
            
            # Convert timestamp to string
            created_at = data.get("createdAt", "")
            if created_at:
                created_at = str(created_at)  # Convert DatetimeWithNanoseconds to string
            
            emails.append({
                "id": doc.id,
                "text": clean_text[:3000],
                "from": data.get("from", ""),
                "subject": data.get("subject", ""),
                "createdAt": created_at,
                "provider": data.get("provider", "")
            })
            
            if i % 50 == 0:
                print(f"   ✅ {i} emails exported")
        
        # Save for Label Studio
        output_file = Path("data/emails_for_labeling.jsonl")
        output_file.parent.mkdir(exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            for email in emails:
                # Make sure all values are JSON serializable
                f.write(json.dumps(email, ensure_ascii=False, default=str) + '\n')
        
        print(f"\n✅ Exported {len(emails)} emails")
        print(f"💾 Saved to: {output_file}\n")
        
        return len(emails)
    
    except Exception as e:
        print(f"❌ Export failed: {e}\n")
        import traceback
        traceback.print_exc()
        return 0

if __name__ == "__main__":
    export_for_annotation()