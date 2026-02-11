/**
 * Deep analysis of parcel reports — identifies ALL problems
 * Reads the CSV export AND the raw emails from Firestore
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const projectId = 'fliptracker-52632';
const clientEmail = 'firebase-adminsdk-fbsvc@fliptracker-52632.iam.gserviceaccount.com';
const privateKey = ('-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC4L9I+zVIF86Fe\nkDIdAq9b+AjYsOIz/OuBuqick1+17Tw6m6luUpcNBOV2nKp7ZuBj+SRKL/P0j3E7\nuWU96tvErSaplF5uorw+JtbZbuq1PaOHSumcMRFIX9wuquphLArOuUenhs1sN3X6\nG8aDWsBS4uO/54xnaG9B8REknLtmXWlC0zFbbvsePy4mdPXRDLThF7sob/W5aVyJ\naaSpOBi3Crky6XvfajZJ0YuRUYU878TqTiTVP8T2rhHbDfcrFuE91AIfixDQ2Ls2\nEFkMRT7WAV+u6qwV/cIbOPKLdNUF151qIMXJI1RLxqEs38WKf6xFxopJAtLvt5O6\nvSKpiwNnAgMBAAECggEAQpLGY3zDEPOmeA+WjXXS/GMCj5AfsrrQROu61h1OkutU\nwbpR21Zu0n3akqy90iy1Hm2G+Gmsu9C9FOFF/sNM/CG5v8GpAERB1hUjwyOcIjZN\nTTF+jr4NiSNc6mFMpiLNJTtC8wJ+bYb+VZCEiCXdLhhkSZDf5uCQlj0T/S/JbI3o\ncY61ljrZe+7BgxUkZfDmbruSbns2nP9HKxykwOnwdzB6n86kF7VllhW0uqAYE9hB\nH8Rr14Bsin+52RB/TBvTtwnq1EstZPWjKmCXBQhYXRkRJy9QvbjZT5TMf6KgEGWQ\nB+E1WuEqK/0M8zxEMtJyBgmySuK2wef3UTSwPb3hgQKBgQD5F3ITDGDOFRRcm6X6\nL+7HPzRwgjS31TjndCT2ClK9el30c3Fzzb/PaiFXb9OhxzaYqBOmNNv6enTrwv7t\n7RNofL5AucYY0mZCIoLHv4CFE8FlOZY6WSgniGdYJey49+kS66gelNwt9w4qenrh\n0XHWGX1L7rXysIYmT9Eoc346qQKBgQC9S4z2I6YrwIphpYnSnYPQae2nZVPTuDSP\n8gn6pJ3BPpEVJm0CYXMZMpCz6T4NyAbuRMMlA67g7rum/kTlI8iCfjFQrTRk15hX\nAxXlRoznAOp9sp99cP6CMBrf8mFLJBcr2dffW3WFz3+Qi2ODKPHFp4izG2RJwuGd\nN0N03iSnjwKBgHHtplBODgzUGV8OFckrmUPqhbqb4y7dyEwclDcwm41sZYLENnTn\n+z4L5boPPLW23yLNZUdUz/RthAK9Skpab9EPlRkXnyKFQR4omLZxwX+cfI0m3K5N\nTw9d1R69IdusEB+GR3vNTDN91y3YnVGhsTZirCtJwFCDKqhlQ14EDQ0ZAoGARKsJ\ngajA+RIpoO6KJqsZTBuBKL5rQFyMRMOKty/MQnPN8Zw04y4ysKtVLs6nwhwT149+\nMwk5AUPZMuT+XRkz/ZKFlTyfyw0iqD3oTXngV1RPvDV2Ae1hhhypQyAMB1QaS8AE\nvXPSGC6Dmg3WlZfezNLPlhmTseZOLdgEUnrbVSUCgYAISnevEK4MNNkHVpfuAcK1\nwffJ2YQYInhrIvU/UMfHLz63Nhru64oXvPbBqyVQv2bx8VfIKxvPJXA6VA846kai\nrIYwfBSbkS3expPj/DIISepjjSwMUH45iNhWT/er01l5Y4ZjhVSILCTgkIWurbuq\ngQacjYb+yAp0Xx5u+q8EDQ==\n-----END PRIVATE KEY-----\n' || '').replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
});
const db = admin.firestore();

async function analyze() {
  // 1. Get all parcel_reports (reported problems)
  const reportsSnap = await db.collection('parcel_reports').get();
  console.log(`\n${'='.repeat(100)}`);
  console.log(`REPORTED PROBLEMS: ${reportsSnap.size} reports`);
  console.log(`${'='.repeat(100)}\n`);

  const reportsByParcel = {};
  reportsSnap.forEach(doc => {
    const d = doc.data();
    if (!reportsByParcel[d.parcelId]) reportsByParcel[d.parcelId] = [];
    reportsByParcel[d.parcelId].push({ id: doc.id, reason: d.reason, status: d.status });
  });

  // 2. Get ALL parcels
  const parcelsSnap = await db.collectionGroup('parcels').get();
  console.log(`TOTAL PARCELS: ${parcelsSnap.size}`);
  
  const parcels = [];
  parcelsSnap.forEach(doc => {
    parcels.push({ id: doc.id, ...doc.data() });
  });

  // 3. Get ALL parsed_emails
  const parsedSnap = await db.collectionGroup('parsed_emails').get();
  console.log(`TOTAL PARSED EMAILS: ${parsedSnap.size}`);
  
  const parsedEmails = [];
  parsedSnap.forEach(doc => {
    parsedEmails.push({ id: doc.id, ...doc.data() });
  });

  // 4. Get ALL raw_emails (just metadata, not full body)  
  const rawSnap = await db.collectionGroup('raw_emails').get();
  console.log(`TOTAL RAW EMAILS: ${rawSnap.size}`);
  
  const rawEmails = [];
  rawSnap.forEach(doc => {
    const d = doc.data();
    rawEmails.push({ 
      id: doc.id, 
      subject: d.subject,
      from: d.from,
      bodyLength: d.rawBody?.length || 0,
      bodyPreview: (d.rawBody || '').substring(0, 300),
      hasForwardHeader: (d.rawBody || '').includes('Message transféré') || (d.rawBody || '').includes('Forwarded message'),
      isPlainText: ((d.rawBody || '').match(/<[a-z][^>]*>/gi) || []).length < 5,
    });
  });

  console.log(`\n${'='.repeat(100)}`);
  console.log('ANALYSIS OF ALL PARCELS');
  console.log(`${'='.repeat(100)}\n`);

  // Categorize problems
  const problems = {
    reported: [],          // User-reported issues
    wrongType: [],         // sale vs purchase wrong
    noAddress: [],         // Missing address
    noTrackingReal: [],    // No real tracking number
    fakeTracking: [],      // Tracking number looks wrong
    wrongCarrier: [],      // Carrier mismatch
    notParcel: [],         // Not a real parcel email
    noMarketplace: [],     // Missing marketplace
    noPrice: [],           // Missing price
    noWithdrawalCode: [],  // Missing withdrawal code when expected
    duplicates: [],        // Same tracking number multiple times
  };

  // Track tracking numbers for duplicate detection
  const trackingCounts = {};
  
  for (const parcel of parcels) {
    const tn = parcel.trackingNumber;
    trackingCounts[tn] = (trackingCounts[tn] || 0) + 1;

    const isReported = !!reportsByParcel[parcel.id];
    const reportReasons = reportsByParcel[parcel.id]?.map(r => r.reason).join(', ') || '';

    // Find the raw email for this parcel
    const rawEmail = rawEmails.find(r => r.id === parcel.sourceEmailId);
    
    const info = {
      id: parcel.id,
      tracking: tn,
      carrier: parcel.carrier,
      type: parcel.type,
      status: parcel.status,
      marketplace: parcel.marketplace,
      title: parcel.title,
      price: parcel.itemPrice,
      address: parcel.pickupAddress?.substring(0, 60),
      withdrawalCode: parcel.withdrawalCode,
      qrCode: parcel.qrCode ? 'YES' : 'NO',
      reported: isReported,
      reportReason: reportReasons,
      emailSubject: rawEmail?.subject?.substring(0, 80) || 'N/A',
      emailFrom: rawEmail?.from?.substring(0, 50) || 'N/A',
      isForwarded: rawEmail?.hasForwardHeader || false,
      isPlainText: rawEmail?.isPlainText || false,
    };

    if (isReported) {
      problems.reported.push(info);
    }

    // Check for non-parcel emails (newsletters, promos, etc.)
    if (rawEmail) {
      const subj = (rawEmail.subject || '').toLowerCase();
      const from = (rawEmail.from || '').toLowerCase();
      const body = rawEmail.bodyPreview.toLowerCase();
      
      // Detect non-tracking emails
      const isNewsletter = /newsletter|promo|offre|solde|réduction|coupon|désabonner|unsubscribe/i.test(subj + body);
      const isReceivedByOther = /a été livré|a été récupéré|a récupéré|retrieved|collected by|récupéré par/i.test(subj + body);
      const isConfirmationNotTracking = /avis|review|trustpilot|feedback|satisfaction|note/i.test(subj) && !tn;
      
      if (isNewsletter) {
        problems.notParcel.push({ ...info, reason: 'NEWSLETTER/PROMO' });
      }
      if (isReceivedByOther) {
        problems.notParcel.push({ ...info, reason: 'RECEIVED_BY_OTHER (buyer got it, you are seller)' });
      }
    }
  }

  // Check duplicates
  for (const [tn, count] of Object.entries(trackingCounts)) {
    if (count > 1) {
      const dupes = parcels.filter(p => p.trackingNumber === tn);
      problems.duplicates.push({
        tracking: tn,
        count,
        parcels: dupes.map(p => ({ id: p.id, carrier: p.carrier, type: p.type, status: p.status })),
      });
    }
  }

  // Print results
  console.log('\n' + '─'.repeat(100));
  console.log('📋 USER-REPORTED PROBLEMS');
  console.log('─'.repeat(100));
  for (const p of problems.reported) {
    console.log(`  ${p.reported ? '🚨' : '  '} [${p.carrier}] ${p.tracking}`);
    console.log(`     Type: ${p.type || 'N/A'} | Market: ${p.marketplace || 'N/A'} | Price: ${p.price || 'N/A'}`);
    console.log(`     Title: ${p.title}`);
    console.log(`     Address: ${p.address || 'NONE'}`);
    console.log(`     Code: ${p.withdrawalCode || 'NONE'} | QR: ${p.qrCode}`);
    console.log(`     Report: ${p.reportReason}`);
    console.log(`     Email: "${p.emailSubject}"`);
    console.log(`     From: ${p.emailFrom} | Forwarded: ${p.isForwarded} | PlainText: ${p.isPlainText}`);
    console.log('');
  }

  console.log('\n' + '─'.repeat(100));
  console.log('🔄 DUPLICATES (same tracking number, multiple parcels)');
  console.log('─'.repeat(100));
  for (const d of problems.duplicates) {
    console.log(`  ${d.tracking}: ${d.count} parcels`);
    for (const p of d.parcels) {
      console.log(`    - ${p.id} [${p.carrier}] type=${p.type} status=${p.status}`);
    }
  }

  console.log('\n' + '─'.repeat(100));
  console.log('🚫 NOT REAL PARCEL EMAILS');
  console.log('─'.repeat(100));
  for (const p of problems.notParcel) {
    console.log(`  ${p.reason}: ${p.tracking} "${p.emailSubject}"`);
  }

  // Summary stats
  console.log('\n' + '='.repeat(100));
  console.log('SUMMARY');
  console.log('='.repeat(100));
  
  const carrierStats = {};
  const typeStats = { sale: 0, purchase: 0, undefined: 0 };
  let withAddress = 0, withCode = 0, withQR = 0, withPrice = 0, withMarketplace = 0;
  
  for (const p of parcels) {
    carrierStats[p.carrier] = (carrierStats[p.carrier] || 0) + 1;
    typeStats[p.type || 'undefined']++;
    if (p.pickupAddress) withAddress++;
    if (p.withdrawalCode) withCode++;
    if (p.qrCode) withQR++;
    if (p.itemPrice) withPrice++;
    if (p.marketplace) withMarketplace++;
  }

  console.log(`\nCarrier distribution:`);
  for (const [c, n] of Object.entries(carrierStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c}: ${n}`);
  }
  
  console.log(`\nType distribution:`);
  for (const [t, n] of Object.entries(typeStats)) {
    console.log(`  ${t}: ${n}`);
  }

  console.log(`\nData completeness (out of ${parcels.length}):`);
  console.log(`  With address: ${withAddress} (${Math.round(withAddress/parcels.length*100)}%)`);
  console.log(`  With withdrawal code: ${withCode} (${Math.round(withCode/parcels.length*100)}%)`);
  console.log(`  With QR code: ${withQR} (${Math.round(withQR/parcels.length*100)}%)`);
  console.log(`  With price: ${withPrice} (${Math.round(withPrice/parcels.length*100)}%)`);
  console.log(`  With marketplace: ${withMarketplace} (${Math.round(withMarketplace/parcels.length*100)}%)`);
  console.log(`  Reported: ${problems.reported.length}`);
  console.log(`  Duplicates: ${problems.duplicates.length} tracking numbers`);

  // DEEP DIVE: For each reported parcel, show the raw email content patterns
  console.log('\n' + '='.repeat(100));
  console.log('DEEP DIVE: RAW EMAIL ANALYSIS FOR REPORTED PARCELS');
  console.log('='.repeat(100));

  for (const report of problems.reported) {
    // Get full raw email body
    const rawDoc = await db.collectionGroup('raw_emails').where('__name__', '>=', '').get();
    // Find by sourceEmailId
    let fullBody = null;
    for (const doc of rawDoc.docs) {
      if (doc.id === report.id) {
        // This is the parcel ID, need the sourceEmailId
        break;
      }
    }

    // Look up the parcel to get sourceEmailId
    const parcel = parcels.find(p => p.id === report.id);
    if (parcel?.sourceEmailId) {
      for (const doc of rawDoc.docs) {
        if (doc.id === parcel.sourceEmailId) {
          fullBody = doc.data().rawBody;
          break;
        }
      }
    }

    if (fullBody) {
      const isPlain = (fullBody.match(/<[a-z][^>]*>/gi) || []).length < 5;
      const stripped = fullBody
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

      console.log(`\n${'─'.repeat(80)}`);
      console.log(`PARCEL: ${report.id} | ${report.tracking} | ${report.carrier}`);
      console.log(`Report reason: ${report.reportReason}`);
      console.log(`Type: ${report.type} | Plain: ${isPlain} | Forwarded: ${report.isForwarded}`);
      console.log(`Subject: "${report.emailSubject}"`);
      console.log(`From: ${report.emailFrom}`);
      console.log(`Body preview (first 500 chars):`);
      console.log(stripped.substring(0, 500));
      
      // Key pattern detection
      const patterns = {
        hasDeposit: /(?:déposé|deposé|dépôt|depot|drop.off)/i.test(stripped),
        hasPickup: /(?:récupér|recuper|retir|retrait|pickup|collect)/i.test(stripped),
        hasDelivered: /(?:livré|livre|delivered|remis)/i.test(stripped),
        hasBuyerRetrieved: /(?:a récupéré|a été récupéré|has been collected|retrieved by buyer)/i.test(stripped),
        hasSaleKeywords: /(?:vendu|achet[eé] par|bordereau|étiquette|label|expédi)/i.test(stripped),
        hasPurchaseKeywords: /(?:code de retrait|récupérer ton|retirer ton|disponible)/i.test(stripped),
        hasVinted: /vinted/i.test(stripped),
        hasChronopost: /chronopost/i.test(stripped),
        hasMondialRelay: /mondial.relay/i.test(stripped),
        hasColissimo: /colissimo/i.test(stripped),
        hasTrackingPattern: /[A-Z]{2}\d{9,}[A-Z]{2}|\d{13,20}/.test(fullBody),
        hasPostalCode: /\d{5}/.test(stripped),
      };
      console.log(`Patterns:`, JSON.stringify(patterns, null, 2));
    }
  }

  // Also list ALL parcels for overview
  console.log('\n' + '='.repeat(100));
  console.log('ALL PARCELS OVERVIEW');
  console.log('='.repeat(100));
  
  for (const p of parcels) {
    const raw = rawEmails.find(r => r.id === p.sourceEmailId);
    const reported = reportsByParcel[p.id] ? '🚨' : '  ';
    console.log(`${reported} [${(p.carrier || 'unknown').padEnd(12)}] ${(p.trackingNumber || 'N/A').padEnd(22)} type=${(p.type || 'N/A').padEnd(8)} status=${(p.status || 'N/A').padEnd(15)} market=${(p.marketplace || 'N/A').padEnd(8)} price=${String(p.itemPrice || 'N/A').padEnd(6)} title="${(p.title || 'N/A').substring(0, 40)}"`);
    if (raw) {
      console.log(`   📧 "${(raw.subject || 'N/A').substring(0, 70)}" from=${(raw.from || 'N/A').substring(0, 40)} fwd=${raw.hasForwardHeader} plain=${raw.isPlainText}`);
    }
  }

  process.exit(0);
}

analyze().catch(e => { console.error(e); process.exit(1); });
