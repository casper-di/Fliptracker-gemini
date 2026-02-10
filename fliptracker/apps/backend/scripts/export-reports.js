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

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

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
  ];

  const rows = [headers.join(',')];

  for (const doc of snapshot.docs) {
    const d = doc.data();
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
