# Email Sync Pipeline - Testing Guide

This guide helps you verify the complete email sync pipeline implementation with parsing, QR code extraction, and deduplication.

## Architecture Overview

The email sync pipeline consists of:

1. **EmailFetchService** - Fetches emails from Gmail/Outlook providers
2. **EmailTrackingDetectorService** - Detects if email contains tracking information (30+ keywords)
3. **EmailParsingService** - Extracts tracking numbers, QR codes, withdrawal codes, article IDs, marketplace info
4. **EmailSyncOrchestrator** - Main orchestration service with smart sync limits (100 initial, 20 maintenance)
5. **Firestore Repositories** - Persists RawEmail, ParsedEmail, EmailSyncEvent with deduplication

## Smart Sync Logic

### Initial Sync (first time)
- Fetches 100 emails
- Parses ALL emails for tracking info
- Stores parsed results with deduplication by tracking number

### Maintenance Syncs (after first)
- Fetches 20 emails (incremental)
- Only parses emails with tracking keywords (smart filtering)
- Updates existing parsed emails if tracking number already exists

## Testing Steps

### 1. Manual Sync Trigger

#### Endpoint
```
POST /api/emails/sync
Authorization: Bearer <firebase_jwt_token>
```

#### Expected Response
```json
{
  "success": true,
  "queuedAt": "2026-01-31T10:00:00.000Z"
}
```

#### Frontend Action
1. Navigate to "Email Connections" tab
2. Click "Sync Emails" button (triggers POST /emails/sync)
3. Should see "started" status immediately

### 2. Check Sync Status

#### Endpoint
```
GET /api/emails/sync/status
Authorization: Bearer <firebase_jwt_token>
```

#### Expected Response (during sync)
```json
{
  "status": "syncing",
  "startedAt": "2026-01-31T10:00:00.000Z",
  "finishedAt": null,
  "error": null,
  "lastUpdate": "2026-01-31T10:00:05.123Z"
}
```

#### Expected Response (after sync)
```json
{
  "status": "idle",
  "startedAt": "2026-01-31T10:00:00.000Z",
  "finishedAt": "2026-01-31T10:00:15.000Z",
  "error": null,
  "lastUpdate": "2026-01-31T10:00:20.000Z"
}
```

### 3. Verify Firestore Collections

#### RawEmail Collection
Expected documents in `rawEmails/{userId}`:
```json
{
  "messageId": "18376e6c9a7b2c4e",
  "provider": "gmail",
  "subject": "Your DHL shipment is on the way",
  "from": "noreply@dhl.com",
  "receivedAt": "2026-01-30T14:30:00Z",
  "rawBody": "...",
  "status": "parsed",
  "createdAt": "2026-01-31T10:00:05Z"
}
```

#### ParsedEmail Collection
Expected documents in `parsedEmails/{userId}`:
```json
{
  "trackingNumber": "1Z999AA10123456784",
  "carrier": "ups",
  "qrCode": "QR1234567890ABCD",
  "withdrawalCode": "CODE123456",
  "articleId": "ASIN1234567890",
  "marketplace": "amazon",
  "status": "pending_shipment_lookup",
  "rawEmailId": "raw_email_doc_id",
  "userId": "firebase_user_id",
  "createdAt": "2026-01-31T10:00:10Z"
}
```

#### EmailSyncEvent Collection
Expected documents in `emailSyncEvents/{userId}`:
```json
{
  "syncId": "sync_001",
  "userId": "firebase_user_id",
  "eventType": "SYNC_COMPLETED",
  "status": "completed",
  "data": {
    "totalEmails": 100,
    "parsedEmails": 25,
    "trackingEmails": 20
  },
  "createdAt": "2026-01-31T10:00:15Z"
}
```

### 4. Test Deduplication

#### Same Email - Should Not Duplicate RawEmail
```bash
# Trigger sync twice with same account
curl -X POST http://localhost:3001/api/emails/sync \
  -H "Authorization: Bearer $TOKEN"

# Wait 5 seconds

curl -X POST http://localhost:3001/api/emails/sync \
  -H "Authorization: Bearer $TOKEN"

# Check Firestore: should have same messageIds, not duplicates
```

#### Same Tracking - Should Update ParsedEmail
```bash
# If email parsing extracts same tracking number twice:
# First: Creates ParsedEmail with trackingNumber="1Z123"
# Second: Updates same ParsedEmail with new extraction data
# Result: 1 document, not 2
```

### 5. Test Tracking Detection

#### Keywords Detected (30+ tracking-related terms)
- English: tracking, shipment, delivered, package, courier, label, waybill, AWB
- French: colis, suivi, expédition, livré, retrait, envoi, numéro, code de retrait
- Carriers: DHL, UPS, FedEx, LaPoste, Amazon, eBay, AliExpress

#### Example Emails That Should Parse
```
Subject: "Your DHL shipment 1Z999AA10123456784 is out for delivery"
Body: "QR Code: QR1234567890ABCD"
Result: trackingNumber="1Z999AA10123456784", carrier="dhl", qrCode="QR1234567890ABCD"

Subject: "Retrait colis - Code de retrait: CODE123456"
Body: "Votre colis peut être retiré au point relais"
Result: withdrawalCode="CODE123456", carrier="laposte"
```

### 6. Test QR Code Extraction

#### Pattern 1: "QR Code:" prefix
```
Email body: "Your QR code: QR1234567890ABCD"
Result: qrCode="QR1234567890ABCD"
```

#### Pattern 2: French "Code QR:" prefix
```
Email body: "Code QR: QRABCD1234567890"
Result: qrCode="QRABCD1234567890"
```

### 7. Test Withdrawal Code Extraction (Points Relais)

#### Pattern: "Code de retrait:" or "Pickup code:"
```
Email body: "Code de retrait: PICKUP123456"
Result: withdrawalCode="PICKUP123456"
```

### 8. Monitor Backend Logs

#### Expected Console Output During Sync
```
[EmailSyncOrchestrator] Starting sync for userId: user123
[EmailSyncOrchestrator] Processing gmail account: user@gmail.com
[EmailSyncOrchestrator] Fetching 100 emails (initialSync: true)
[EmailFetchService] Fetching emails from provider: gmail
[EmailSyncOrchestrator] Saved 95 raw emails (5 duplicates skipped)
[EmailSyncOrchestrator] Parsing all 95 emails (initial sync)
[EmailTrackingDetectorService] Detected tracking email: "Your DHL shipment..."
[EmailParsingService] Extracted: trackingNumber=1Z999AA, carrier=dhl, qrCode=QR123
[EmailSyncOrchestrator] Parsed 45 emails, 40 tracking emails found
[EmailSyncOrchestrator] Upserted 40 parsed emails (5 updates, 35 new)
[EmailSyncOrchestrator] Marking initialSyncCompleted=true
[EmailSyncOrchestrator] Sync completed in 12.5 seconds
```

### 9. Test Subsequent Sync (Maintenance)

#### After Initial Sync Completed
```bash
curl -X POST http://localhost:3001/api/emails/sync \
  -H "Authorization: Bearer $TOKEN"
```

#### Expected Behavior
1. Fetches only 20 emails (MAINTENANCE_SYNC_LIMIT)
2. Skips parsing for emails without tracking keywords
3. Skips non-tracking emails entirely
4. Only parses emails detected as tracking-related

#### Console Output
```
[EmailSyncOrchestrator] Maintenance sync for userId: user123
[EmailSyncOrchestrator] Fetching 20 emails (initialSync: false)
[EmailSyncOrchestrator] Parsing only tracking-related emails (maintenance sync)
[EmailTrackingDetectorService] Email 1/20: Not tracking (keywords < 2)
[EmailTrackingDetectorService] Email 2/20: Not tracking
[EmailTrackingDetectorService] Email 3/20: IS tracking
[EmailParsingService] Parsing tracking email...
[EmailSyncOrchestrator] Parsed 2 tracking emails out of 20
```

## Debugging

### Check Raw Emails in Firestore
```javascript
// In Firebase Console > Firestore
db.collection('rawEmails').doc('user123').collection('emails')
  .where('status', '==', 'parsed')
  .get()
```

### Check Parsed Emails
```javascript
db.collection('parsedEmails').doc('user123').collection('emails')
  .where('status', '==', 'pending_shipment_lookup')
  .get()
```

### Check Sync Events
```javascript
db.collection('emailSyncEvents').doc('user123').collection('events')
  .orderBy('createdAt', 'desc')
  .limit(10)
  .get()
```

### Check User Sync Status
```javascript
db.collection('users').doc('user123').get()
// Check: emailSyncStatus, emailSyncStartedAt, emailSyncLastFinishedAt, emailSyncLastError
```

### Check Connected Email Sync Progress
```javascript
db.collection('connectedEmails').doc('user123').collection('emails').get()
// Check: initialSyncCompleted, initialSyncCompletedAt
```

## Known Limitations (MVP)

1. **No Queue Yet** - Sync runs directly on request thread, will block if large email count
2. **No Webhooks** - New emails only detected on manual sync
3. **No Carrier API Integration** - Tracking info stored but not yet looked up
4. **No Shipment Linking** - ParsedEmail created but not linked to Shipment entity yet
5. **Single Pass Parsing** - Only extracts info visible in email body/subject

## Migration to Queue

To add BullMQ queue support later:
1. Wrap `emailSyncOrchestrator.syncEmailsForUser()` call in queue job
2. All services remain unchanged (already isolated)
3. Add retry policy and DLQ handling
4. Services are stateless and reusable

## Success Criteria

✅ First sync: 100 emails fetched and parsed, status updates available
✅ Deduplication: No duplicate rawEmails by messageId, no duplicate tracking numbers
✅ QR Extraction: QR codes extracted and stored in parseEmail
✅ Withdrawal Codes: Points relais codes extracted  
✅ Carrier Detection: DHL/UPS/FedEx/LaPoste recognized and stored
✅ Smart Limits: Second sync only 20 emails, only tracking parsed
✅ Firestore Persistence: All data survives app restart
✅ Status Tracking: User can check sync progress and errors
