#!/usr/bin/env node

/**
 * Export parcel_reports from Firestore to CSV
 * Usage: npm run export:reports
 * 
 * Reads FIREBASE_* env vars from .env or environment.
 * Outputs: parcel_reports_<timestamp>.csv
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load .env if present
try {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
} catch (_) {}

const projectId = 'fliptracker-52632';
const clientEmail = 'firebase-adminsdk-fbsvc@fliptracker-52632.iam.gserviceaccount.com';
const privateKey = ('-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC4L9I+zVIF86Fe\nkDIdAq9b+AjYsOIz/OuBuqick1+17Tw6m6luUpcNBOV2nKp7ZuBj+SRKL/P0j3E7\nuWU96tvErSaplF5uorw+JtbZbuq1PaOHSumcMRFIX9wuquphLArOuUenhs1sN3X6\nG8aDWsBS4uO/54xnaG9B8REknLtmXWlC0zFbbvsePy4mdPXRDLThF7sob/W5aVyJ\naaSpOBi3Crky6XvfajZJ0YuRUYU878TqTiTVP8T2rhHbDfcrFuE91AIfixDQ2Ls2\nEFkMRT7WAV+u6qwV/cIbOPKLdNUF151qIMXJI1RLxqEs38WKf6xFxopJAtLvt5O6\nvSKpiwNnAgMBAAECggEAQpLGY3zDEPOmeA+WjXXS/GMCj5AfsrrQROu61h1OkutU\nwbpR21Zu0n3akqy90iy1Hm2G+Gmsu9C9FOFF/sNM/CG5v8GpAERB1hUjwyOcIjZN\nTTF+jr4NiSNc6mFMpiLNJTtC8wJ+bYb+VZCEiCXdLhhkSZDf5uCQlj0T/S/JbI3o\ncY61ljrZe+7BgxUkZfDmbruSbns2nP9HKxykwOnwdzB6n86kF7VllhW0uqAYE9hB\nH8Rr14Bsin+52RB/TBvTtwnq1EstZPWjKmCXBQhYXRkRJy9QvbjZT5TMf6KgEGWQ\nB+E1WuEqK/0M8zxEMtJyBgmySuK2wef3UTSwPb3hgQKBgQD5F3ITDGDOFRRcm6X6\nL+7HPzRwgjS31TjndCT2ClK9el30c3Fzzb/PaiFXb9OhxzaYqBOmNNv6enTrwv7t\n7RNofL5AucYY0mZCIoLHv4CFE8FlOZY6WSgniGdYJey49+kS66gelNwt9w4qenrh\n0XHWGX1L7rXysIYmT9Eoc346qQKBgQC9S4z2I6YrwIphpYnSnYPQae2nZVPTuDSP\n8gn6pJ3BPpEVJm0CYXMZMpCz6T4NyAbuRMMlA67g7rum/kTlI8iCfjFQrTRk15hX\nAxXlRoznAOp9sp99cP6CMBrf8mFLJBcr2dffW3WFz3+Qi2ODKPHFp4izG2RJwuGd\nN0N03iSnjwKBgHHtplBODgzUGV8OFckrmUPqhbqb4y7dyEwclDcwm41sZYLENnTn\n+z4L5boPPLW23yLNZUdUz/RthAK9Skpab9EPlRkXnyKFQR4omLZxwX+cfI0m3K5N\nTw9d1R69IdusEB+GR3vNTDN91y3YnVGhsTZirCtJwFCDKqhlQ14EDQ0ZAoGARKsJ\ngajA+RIpoO6KJqsZTBuBKL5rQFyMRMOKty/MQnPN8Zw04y4ysKtVLs6nwhwT149+\nMwk5AUPZMuT+XRkz/ZKFlTyfyw0iqD3oTXngV1RPvDV2Ae1hhhypQyAMB1QaS8AE\nvXPSGC6Dmg3WlZfezNLPlhmTseZOLdgEUnrbVSUCgYAISnevEK4MNNkHVpfuAcK1\nwffJ2YQYInhrIvU/UMfHLz63Nhru64oXvPbBqyVQv2bx8VfIKxvPJXA6VA846kai\nrIYwfBSbkS3expPj/DIISepjjSwMUH45iNhWT/er01l5Y4ZjhVSILCTgkIWurbuq\ngQacjYb+yAp0Xx5u+q8EDQ==\n-----END PRIVATE KEY-----\n' || '').replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
});

const db = admin.firestore();

function escapeCsv(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

async function main() {
  console.log('📦 Fetching parcel_reports from Firestore...');

  const snapshot = await db.collection('parcel_reports').orderBy('createdAt', 'desc').get();

  if (snapshot.empty) {
    console.log('⚠️  No reports found.');
    process.exit(0);
  }

  console.log(`✅ Found ${snapshot.size} report(s)`);

  const headers = [
    'id',
    'userId',
    'parcelId',
    'trackingNumber',
    'carrier',
    'status',
    'reason',
    'sourceEmailId',
    'resolved',
    'createdAt',
    'updatedAt',
    'rawEmail',
    // Colonnes du parcel - Informations de base
    'parcel_trackingNumber',
    'parcel_carrier',
    'parcel_status',
    'parcel_type',
    'parcel_sourceEmailId',
    'parcel_provider',
    'parcel_title',
    'parcel_price',
    'parcel_currency',
    // Classification email
    'parcel_lastEmailType',
    'parcel_sourceType',
    'parcel_sourceName',
    // Métadonnées enrichies
    'parcel_productName',
    'parcel_productDescription',
    'parcel_recipientName',
    'parcel_recipientEmail',
    'parcel_senderName',
    'parcel_senderEmail',
    'parcel_pickupAddress',
    'parcel_destinationAddress',
    'parcel_pickupDeadline',
    'parcel_estimatedDelivery',
    'parcel_orderNumber',
    'parcel_withdrawalCode',
    'parcel_qrCode',
    'parcel_marketplace',
    'parcel_itemPrice',
    'parcel_labelUrl',
    // Rapports
    'parcel_reported',
    'parcel_reportedAt',
    'parcel_reportReason',
    // Dates
    'parcel_createdAt',
    'parcel_updatedAt',
  ];

  const rows = [headers.join(',')];

  for (const doc of snapshot.docs) {
    const d = doc.data();
    
    // Récupérer les données du parcel associé
    let parcelData = {};
    if (d.parcelId) {
      try {
        const parcelDoc = await db.collection('parcels').doc(d.parcelId).get();
        if (parcelDoc.exists) {
          parcelData = parcelDoc.data();
          console.log(`✓ Parcel ${d.parcelId} trouvé`);
        } else {
          console.log(`⚠️  Parcel ${d.parcelId} non trouvé`);
        }
      } catch (err) {
        console.error(`❌ Erreur récupération parcel ${d.parcelId}:`, err.message);
      }
    }
    
    const row = [
      escapeCsv(doc.id),
      escapeCsv(d.userId),
      escapeCsv(d.parcelId),
      escapeCsv(d.trackingNumber),
      escapeCsv(d.carrier),
      escapeCsv(d.status),
      escapeCsv(d.reason),
      escapeCsv(d.sourceEmailId),
      escapeCsv(d.resolved),
      escapeCsv(d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt),
      escapeCsv(d.updatedAt?.toDate ? d.updatedAt.toDate().toISOString() : d.updatedAt),
      escapeCsv(d.rawEmail),
      // Données du parcel - Informations de base
      escapeCsv(parcelData.trackingNumber || ''),
      escapeCsv(parcelData.carrier || ''),
      escapeCsv(parcelData.status || ''),
      escapeCsv(parcelData.type || ''),
      escapeCsv(parcelData.sourceEmailId || ''),
      escapeCsv(parcelData.provider || ''),
      escapeCsv(parcelData.title || ''),
      escapeCsv(parcelData.price || ''),
      escapeCsv(parcelData.currency || ''),
      // Classification email
      escapeCsv(parcelData.lastEmailType || ''),
      escapeCsv(parcelData.sourceType || ''),
      escapeCsv(parcelData.sourceName || ''),
      // Métadonnées enrichies
      escapeCsv(parcelData.productName || ''),
      escapeCsv(parcelData.productDescription || ''),
      escapeCsv(parcelData.recipientName || ''),
      escapeCsv(parcelData.recipientEmail || ''),
      escapeCsv(parcelData.senderName || ''),
      escapeCsv(parcelData.senderEmail || ''),
      escapeCsv(parcelData.pickupAddress || ''),
      escapeCsv(parcelData.destinationAddress || ''),
      escapeCsv(parcelData.pickupDeadline?.toDate ? parcelData.pickupDeadline.toDate().toISOString() : parcelData.pickupDeadline || ''),
      escapeCsv(parcelData.estimatedDelivery?.toDate ? parcelData.estimatedDelivery.toDate().toISOString() : parcelData.estimatedDelivery || ''),
      escapeCsv(parcelData.orderNumber || ''),
      escapeCsv(parcelData.withdrawalCode || ''),
      escapeCsv(parcelData.qrCode || ''),
      escapeCsv(parcelData.marketplace || ''),
      escapeCsv(parcelData.itemPrice || ''),
      escapeCsv(parcelData.labelUrl || ''),
      // Rapports
      escapeCsv(parcelData.reported || ''),
      escapeCsv(parcelData.reportedAt?.toDate ? parcelData.reportedAt.toDate().toISOString() : parcelData.reportedAt || ''),
      escapeCsv(parcelData.reportReason || ''),
      // Dates
      escapeCsv(parcelData.createdAt?.toDate ? parcelData.createdAt.toDate().toISOString() : parcelData.createdAt || ''),
      escapeCsv(parcelData.updatedAt?.toDate ? parcelData.updatedAt.toDate().toISOString() : parcelData.updatedAt || ''),
    ];
    rows.push(row.join(','));
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `parcel_reports_${timestamp}.csv`;
  const outPath = path.resolve(__dirname, '..', filename);

  fs.writeFileSync(outPath, rows.join('\n'), 'utf-8');
  console.log(`📄 Exported to ${outPath}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Export failed:', err);
  process.exit(1);
});
