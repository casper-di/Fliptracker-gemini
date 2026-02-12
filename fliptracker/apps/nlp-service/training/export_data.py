"""
FlipTracker NLP Service — Data Export from Firestore

Exports raw emails from Firestore for training the NER model.
Matches each raw email with its parsed result (if any) for weak labeling.

Usage:
    python training/export_data.py
"""
import json
import os
import sys
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

load_dotenv()

# ── Firebase setup ──────────────────────────────────────────────────
def init_firebase():
    """Initialize Firebase with service account credentials."""
    # Try env var first
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
    else:
        # Build from individual env vars
        project_id = os.getenv("FIREBASE_PROJECT_ID", "fliptracker-52632")
        client_email = os.getenv("FIREBASE_CLIENT_EMAIL",
                                 "firebase-adminsdk-fbsvc@fliptracker-52632.iam.gserviceaccount.com")
        private_key = os.getenv("FIREBASE_PRIVATE_KEY", "")
        if not private_key:
            print("ERROR: Set FIREBASE_PRIVATE_KEY or GOOGLE_APPLICATION_CREDENTIALS")
            sys.exit(1)
        cred = credentials.Certificate({
            "type": "service_account",
            "project_id": project_id,
            "client_email": client_email,
            "private_key": private_key.replace("\\n", "\n"),
            "token_uri": "https://oauth2.googleapis.com/token",
        })
    
    firebase_admin.initialize_app(cred)
    return firestore.client()


def export_collection(db, collection_name: str) -> list[dict]:
    """Export all documents from a Firestore collection."""
    docs = db.collection(collection_name).stream()
    results = []
    for doc in docs:
        data = doc.to_dict()
        data["_id"] = doc.id
        # Convert Firestore timestamps to ISO strings
        for key, value in data.items():
            if hasattr(value, "isoformat"):
                data[key] = value.isoformat()
        results.append(data)
    return results


def build_training_samples(raw_emails: list[dict], parsed_emails: list[dict],
                           parcels: list[dict]) -> list[dict]:
    """
    Match raw emails with their parsed results and parcel data
    to create weakly-labeled training samples.
    """
    # Index parsed emails by rawEmailId
    parsed_by_raw = {}
    for pe in parsed_emails:
        raw_id = pe.get("rawEmailId")
        if raw_id:
            parsed_by_raw[raw_id] = pe

    # Index parcels by trackingNumber
    parcels_by_tracking = {}
    for p in parcels:
        tn = p.get("trackingNumber")
        if tn:
            parcels_by_tracking[tn] = p

    samples = []
    for raw in raw_emails:
        raw_id = raw.get("_id") or raw.get("id")
        sample = {
            "id": raw_id,
            "subject": raw.get("subject", ""),
            "from": raw.get("from", ""),
            "body": raw.get("rawBody", ""),
            "receivedAt": raw.get("receivedAt"),
            # Labels (from parsed/parcel data)
            "labels": {
                "trackingNumber": None,
                "carrier": None,
                "type": None,
                "marketplace": None,
                "pickupAddress": None,
                "recipientName": None,
                "senderName": None,
                "withdrawalCode": None,
                "orderNumber": None,
                "productName": None,
                "estimatedValue": None,
                "currency": None,
                "isTrackingEmail": None,
            },
        }

        # Merge parsed email data
        parsed = parsed_by_raw.get(raw_id, {})
        if parsed:
            sample["labels"]["trackingNumber"] = parsed.get("trackingNumber")
            sample["labels"]["carrier"] = parsed.get("carrier")
            sample["labels"]["type"] = parsed.get("type")
            sample["labels"]["marketplace"] = parsed.get("marketplace")
            sample["labels"]["emailType"] = parsed.get("emailType")
            sample["labels"]["pickupAddress"] = parsed.get("pickupAddress")
            sample["labels"]["recipientName"] = parsed.get("recipientName")
            sample["labels"]["senderName"] = parsed.get("senderName")
            sample["labels"]["withdrawalCode"] = parsed.get("withdrawalCode")
            sample["labels"]["orderNumber"] = parsed.get("orderNumber")
            sample["labels"]["productName"] = parsed.get("productName")
            sample["labels"]["isTrackingEmail"] = True

            # Also pull from parcel
            tracking = parsed.get("trackingNumber")
            if tracking and tracking in parcels_by_tracking:
                parcel = parcels_by_tracking[tracking]
                if not sample["labels"]["carrier"]:
                    sample["labels"]["carrier"] = parcel.get("carrier")
                if not sample["labels"]["type"]:
                    sample["labels"]["type"] = parcel.get("type")
                if not sample["labels"]["marketplace"]:
                    sample["labels"]["marketplace"] = parcel.get("marketplace")
                if not sample["labels"]["pickupAddress"]:
                    sample["labels"]["pickupAddress"] = parcel.get("pickupAddress")
                if not sample["labels"]["estimatedValue"]:
                    sample["labels"]["estimatedValue"] = parcel.get("estimatedValue")
                if not sample["labels"]["currency"]:
                    sample["labels"]["currency"] = parcel.get("currency")
        else:
            # Raw email with no parsed result → likely non-tracking
            sample["labels"]["isTrackingEmail"] = False

        samples.append(sample)

    return samples


def main():
    print("🔄 Initializing Firebase...")
    db = init_firebase()

    data_dir = Path(__file__).parent.parent / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    # Export collections
    print("📥 Exporting rawEmails...")
    raw_emails = export_collection(db, "rawEmails")
    print(f"   ✅ {len(raw_emails)} raw emails")

    print("📥 Exporting parsedEmails...")
    parsed_emails = export_collection(db, "parsedEmails")
    print(f"   ✅ {len(parsed_emails)} parsed emails")

    print("📥 Exporting parcels...")
    parcels = export_collection(db, "parcels")
    print(f"   ✅ {len(parcels)} parcels")

    # Save raw exports
    for name, data in [("rawEmails", raw_emails), ("parsedEmails", parsed_emails), ("parcels", parcels)]:
        path = data_dir / f"{name}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
        print(f"   💾 Saved {path}")

    # Build training samples
    print("\n🏗️  Building training samples...")
    samples = build_training_samples(raw_emails, parsed_emails, parcels)

    tracking_count = sum(1 for s in samples if s["labels"]["isTrackingEmail"])
    non_tracking_count = sum(1 for s in samples if not s["labels"]["isTrackingEmail"])
    has_tracking_num = sum(1 for s in samples if s["labels"]["trackingNumber"])
    has_address = sum(1 for s in samples if s["labels"]["pickupAddress"])
    has_marketplace = sum(1 for s in samples if s["labels"]["marketplace"])

    print(f"   Total samples: {len(samples)}")
    print(f"   Tracking emails: {tracking_count}")
    print(f"   Non-tracking emails: {non_tracking_count}")
    print(f"   With tracking number: {has_tracking_num}")
    print(f"   With address: {has_address}")
    print(f"   With marketplace: {has_marketplace}")

    # Save training data
    path = data_dir / "training_samples.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(samples, f, ensure_ascii=False, indent=2, default=str)
    print(f"\n💾 Training data saved to: {path}")

    # Carrier distribution
    carriers = {}
    for s in samples:
        c = s["labels"]["carrier"] or "none"
        carriers[c] = carriers.get(c, 0) + 1
    print("\n📊 Carrier distribution:")
    for c, count in sorted(carriers.items(), key=lambda x: -x[1]):
        print(f"   {c}: {count}")

    # Type distribution
    types = {}
    for s in samples:
        t = s["labels"]["type"] or "none"
        types[t] = types.get(t, 0) + 1
    print("\n📊 Type distribution:")
    for t, count in sorted(types.items(), key=lambda x: -x[1]):
        print(f"   {t}: {count}")


if __name__ == "__main__":
    main()
