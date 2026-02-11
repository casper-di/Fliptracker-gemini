const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: 'fliptracker-52632',
    clientEmail: 'firebase-adminsdk-fbsvc@fliptracker-52632.iam.gserviceaccount.com',
    privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC4L9I+zVIF86Fe\nkDIdAq9b+AjYsOIz/OuBuqick1+17Tw6m6luUpcNBOV2nKp7ZuBj+SRKL/P0j3E7\nuWU96tvErSaplF5uorw+JtbZbuq1PaOHSumcMRFIX9wuquphLArOuUenhs1sN3X6\nG8aDWsBS4uO/54xnaG9B8REknLtmXWlC0zFbbvsePy4mdPXRDLThF7sob/W5aVyJ\naaSpOBi3Crky6XvfajZJ0YuRUYU878TqTiTVP8T2rhHbDfcrFuE91AIfixDQ2Ls2\nEFkMRT7WAV+u6qwV/cIbOPKLdNUF151qIMXJI1RLxqEs38WKf6xFxopJAtLvt5O6\nvSKpiwNnAgMBAAECggEAQpLGY3zDEPOmeA+WjXXS/GMCj5AfsrrQROu61h1OkutU\nwbpR21Zu0n3akqy90iy1Hm2G+Gmsu9C9FOFF/sNM/CG5v8GpAERB1hUjwyOcIjZN\nTTF+jr4NiSNc6mFMpiLNJTtC8wJ+bYb+VZCEiCXdLhhkSZDf5uCQlj0T/S/JbI3o\ncY61ljrZe+7BgxUkZfDmbruSbns2nP9HKxykwOnwdzB6n86kF7VllhW0uqAYE9hB\nH8Rr14Bsin+52RB/TBvTtwnq1EstZPWjKmCXBQhYXRkRJy9QvbjZT5TMf6KgEGWQ\nB+E1WuEqK/0M8zxEMtJyBgmySuK2wef3UTSwPb3hgQKBgQD5F3ITDGDOFRRcm6X6\nL+7HPzRwgjS31TjndCT2ClK9el30c3Fzzb/PaiFXb9OhxzaYqBOmNNv6enTrwv7t\n7RNofL5AucYY0mZCIoLHv4CFE8FlOZY6WSgniGdYJey49+kS66gelNwt9w4qenrh\n0XHWGX1L7rXysIYmT9Eoc346qQKBgQC9S4z2I6YrwIphpYnSnYPQae2nZVPTuDSP\n8gn6pJ3BPpEVJm0CYXMZMpCz6T4NyAbuRMMlA67g7rum/kTlI8iCfjFQrTRk15hX\nAxXlRoznAOp9sp99cP6CMBrf8mFLJBcr2dffW3WFz3+Qi2ODKPHFp4izG2RJwuGd\nN0N03iSnjwKBgHHtplBODgzUGV8OFckrmUPqhbqb4y7dyEwclDcwm41sZYLENnTn\n+z4L5boPPLW23yLNZUdUz/RthAK9Skpab9EPlRkXnyKFQR4omLZxwX+cfI0m3K5N\nTw9d1R69IdusEB+GR3vNTDN91y3YnVGhsTZirCtJwFCDKqhlQ14EDQ0ZAoGARKsJ\ngajA+RIpoO6KJqsZTBuBKL5rQFyMRMOKty/MQnPN8Zw04y4ysKtVLs6nwhwT149+\nMwk5AUPZMuT+XRkz/ZKFlTyfyw0iqD3oTXngV1RPvDV2Ae1hhhypQyAMB1QaS8AE\nvXPSGC6Dmg3WlZfezNLPlhmTseZOLdgEUnrbVSUCgYAISnevEK4MNNkHVpfuAcK1\nwffJ2YQYInhrIvU/UMfHLz63Nhru64oXvPbBqyVQv2bx8VfIKxvPJXA6VA846kai\nrIYwfBSbkS3expPj/DIISepjjSwMUH45iNhWT/er01l5Y4ZjhVSILCTgkIWurbuq\ngQacjYb+yAp0Xx5u+q8EDQ==\n-----END PRIVATE KEY-----\n'
  })
});
const db = admin.firestore();

(async () => {
  // 1. Load all raw emails  
  const rawSnap = await db.collection('rawEmails').get();
  const rawEmails = rawSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`=== RAW EMAILS: ${rawEmails.length} ===\n`);

  // 2. Load all parsed emails
  const parsedSnap = await db.collection('parsedEmails').get();
  const parsedMap = {};
  parsedSnap.docs.forEach(d => { parsedMap[d.id] = { id: d.id, ...d.data() }; });
  console.log(`=== PARSED EMAILS: ${Object.keys(parsedMap).length} ===\n`);

  // 3. Load all parcels
  const parcelSnap = await db.collection('parcels').get();
  const parcels = parcelSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`=== PARCELS: ${parcels.length} ===\n`);

  // 4. Load reports
  const reportSnap = await db.collection('parcel_reports').get();
  const reports = reportSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`=== REPORTS: ${reports.length} ===\n`);

  // ========== ANALYSIS 1: Categorize raw emails by sender ==========
  console.log('=== RAW EMAIL SENDER ANALYSIS ===');
  const senderDomains = {};
  const emailsByDomain = {};
  for (const raw of rawEmails) {
    const from = (raw.from || '').toLowerCase();
    const domainMatch = from.match(/@([^\s>]+)/);
    const domain = domainMatch ? domainMatch[1] : 'unknown';
    senderDomains[domain] = (senderDomains[domain] || 0) + 1;
    if (!emailsByDomain[domain]) emailsByDomain[domain] = [];
    emailsByDomain[domain].push(raw);
  }
  const sortedDomains = Object.entries(senderDomains).sort((a,b) => b[1] - a[1]);
  for (const [domain, count] of sortedDomains) {
    console.log(`  ${domain}: ${count}`);
  }

  // ========== ANALYSIS 2: Emails that should NOT be parcels ==========
  console.log('\n=== NON-TRACKING EMAILS (should be filtered) ===');
  const nonTrackingPatterns = [
    /avis|review|évaluation|noter|note/i,
    /paiement.*(reçu|effectué|confirmé)|payment.*received/i,
    /bienvenue|welcome/i,
    /newsletter|promotion|offre|promo/i,
    /mot de passe|password|connexion|login/i,
    /facture|invoice|reçu fiscal/i,
    /l'acheteur a récupéré/i,  // buyer picked up (seller notification, no tracking needed)
    /votre vente est terminée/i,  // sale completed
    /a].*évaluation|laissé.*avis/i,  // review left
    /nouveau message|new message/i,
    /offre.*acceptée|offer.*accepted/i,
    /offre.*reçue|offer.*received/i,
  ];
  
  let nonTrackingCount = 0;
  const nonTrackingEmails = [];
  for (const raw of rawEmails) {
    const subject = (raw.subject || '').toLowerCase();
    const body = ((raw.body || raw.textBody || raw.htmlBody || '')).substring(0, 2000).toLowerCase();
    const combined = subject + ' ' + body;
    
    for (const pattern of nonTrackingPatterns) {
      if (pattern.test(combined)) {
        nonTrackingEmails.push({ id: raw.id, from: raw.from, subject: raw.subject, pattern: pattern.toString() });
        nonTrackingCount++;
        break;
      }
    }
  }
  console.log(`Found ${nonTrackingCount} non-tracking emails:`);
  for (const e of nonTrackingEmails.slice(0, 30)) {
    console.log(`  [${e.pattern}] FROM: ${(e.from||'').substring(0, 40)} SUBJ: ${(e.subject||'').substring(0, 80)}`);
  }

  // ========== ANALYSIS 3: Parcels with carrier="other" ==========
  console.log('\n=== PARCELS WITH CARRIER=OTHER (20 expected) ===');
  const otherParcels = parcels.filter(p => p.carrier === 'other');
  for (const p of otherParcels) {
    // Find the raw email that created this parcel
    const rawEmailId = p.rawEmailId || p.emailId || (p.statusHistory && p.statusHistory[0] && p.statusHistory[0].rawEmailId);
    const raw = rawEmails.find(r => r.id === rawEmailId || r.messageId === rawEmailId);
    console.log(`  Parcel ${p.id}:`);
    console.log(`    tracking: ${p.trackingNumber}`);
    console.log(`    type: ${p.shipmentType}`);
    console.log(`    marketplace: ${p.marketplace}`);
    console.log(`    rawEmailId: ${rawEmailId}`);
    if (raw) {
      console.log(`    FROM: ${(raw.from || '').substring(0, 60)}`);
      console.log(`    SUBJ: ${(raw.subject || '').substring(0, 80)}`);
      const body = (raw.body || raw.textBody || raw.htmlBody || '').substring(0, 300);
      console.log(`    BODY-START: ${body.replace(/\n/g, '\\n').substring(0, 200)}`);
    } else {
      console.log(`    (no matching raw email found)`);
    }
    console.log('');
  }

  // ========== ANALYSIS 4: Which raw emails became parcels? ==========
  console.log('\n=== RAW EMAILS → PARCELS MAPPING ===');
  const parcelRawEmailIds = new Set();
  for (const p of parcels) {
    if (p.rawEmailId) parcelRawEmailIds.add(p.rawEmailId);
    if (p.emailId) parcelRawEmailIds.add(p.emailId);
    if (p.statusHistory) {
      for (const sh of p.statusHistory) {
        if (sh.rawEmailId) parcelRawEmailIds.add(sh.rawEmailId);
      }
    }
  }
  // Also check parsedEmails for rawEmailId
  for (const pe of Object.values(parsedMap)) {
    if (pe.rawEmailId) parcelRawEmailIds.add(pe.rawEmailId);
  }
  
  const unmatchedRaw = rawEmails.filter(r => !parcelRawEmailIds.has(r.id) && !parcelRawEmailIds.has(r.messageId));
  console.log(`Raw emails linked to parcels: ${rawEmails.length - unmatchedRaw.length}`);
  console.log(`Raw emails NOT linked to any parcel: ${unmatchedRaw.length}`);

  // ========== ANALYSIS 5: Reported parcels deep dive ==========
  console.log('\n=== REPORTED PARCELS DEEP DIVE ===');
  const reportedParcelIds = reports.map(r => r.parcelId).filter(Boolean);
  for (const report of reports.filter(r => r.parcelId)) {
    const parcel = parcels.find(p => p.id === report.parcelId);
    if (!parcel) { console.log(`  Report ${report.id}: parcel ${report.parcelId} NOT FOUND`); continue; }
    
    // Find raw email
    const rawEmailId = parcel.rawEmailId || parcel.emailId || (parcel.statusHistory && parcel.statusHistory[0] && parcel.statusHistory[0].rawEmailId);
    const raw = rawEmails.find(r => r.id === rawEmailId || r.messageId === rawEmailId);
    
    console.log(`  Report: ${report.id}`);
    console.log(`    Report reason: ${report.reason || report.reportType || 'N/A'}`);
    console.log(`    Report details: ${JSON.stringify(report.details || report.description || '').substring(0, 150)}`);
    console.log(`    Parcel: carrier=${parcel.carrier}, type=${parcel.shipmentType}, tracking=${parcel.trackingNumber}`);
    console.log(`    Parcel: marketplace=${parcel.marketplace}, price=${parcel.itemPrice}`);
    console.log(`    Parcel: address=${(parcel.dropOffAddress || '').substring(0, 80)}`);
    console.log(`    Parcel: withdrawalCode=${parcel.withdrawalCode}, qrCodeUrl=${parcel.qrCodeUrl ? 'YES' : 'NO'}`);
    if (raw) {
      console.log(`    Email FROM: ${(raw.from || '').substring(0, 60)}`);
      console.log(`    Email SUBJ: ${(raw.subject || '').substring(0, 80)}`);
    }
    console.log('');
  }

  // ========== ANALYSIS 6: Marketplace field issues ==========
  console.log('\n=== MARKETPLACE FIELD VALUES ===');
  const marketplaces = {};
  for (const p of parcels) {
    const mp = p.marketplace || 'NULL';
    marketplaces[mp] = (marketplaces[mp] || 0) + 1;
  }
  for (const [mp, count] of Object.entries(marketplaces).sort((a,b) => b[1] - a[1])) {
    console.log(`  "${mp}": ${count}`);
  }

  // ========== ANALYSIS 7: Type detection =========
  console.log('\n=== SHIPMENT TYPE DISTRIBUTION ===');
  const types = {};
  for (const p of parcels) {
    const t = p.shipmentType || 'NULL';
    types[t] = (types[t] || 0) + 1;  
  }
  for (const [t, count] of Object.entries(types).sort((a,b) => b[1] - a[1])) {
    console.log(`  ${t}: ${count}`);
  }

  // Show sale parcels details
  console.log('\n=== SALE PARCELS DETAILS ===');
  const saleParcels = parcels.filter(p => p.shipmentType === 'sale');
  for (const p of saleParcels) {
    console.log(`  ${p.id}: carrier=${p.carrier}, tracking=${p.trackingNumber}, marketplace=${p.marketplace}`);
  }

  // ========== ANALYSIS 8: Sample raw emails from each sender domain ==========
  console.log('\n=== SAMPLE EMAILS BY DOMAIN ===');
  for (const [domain, emails] of Object.entries(emailsByDomain)) {
    console.log(`\n--- ${domain} (${emails.length} emails) ---`);
    for (const e of emails.slice(0, 2)) {
      console.log(`  FROM: ${(e.from || '').substring(0, 60)}`);
      console.log(`  SUBJ: ${(e.subject || '').substring(0, 100)}`);
      const body = (e.body || e.textBody || e.htmlBody || '');
      // Show first 200 chars
      console.log(`  BODY: ${body.replace(/\n/g, '\\n').substring(0, 200)}`);
      console.log('');
    }
  }

  // ========== ANALYSIS 9: Raw email field names ==========
  console.log('\n=== RAW EMAIL FIELD NAMES (sample) ===');
  if (rawEmails.length > 0) {
    console.log('Fields:', Object.keys(rawEmails[0]));
  }

  // ========== ANALYSIS 10: ParsedEmail sample ==========
  console.log('\n=== PARSED EMAIL SAMPLE ===');
  const parsedArr = Object.values(parsedMap);
  if (parsedArr.length > 0) {
    const sample = parsedArr[0];
    console.log('Fields:', Object.keys(sample));
    console.log('Sample:', JSON.stringify(sample, null, 2).substring(0, 500));
  }

  // ========== ANALYSIS 11: Parcel fields sample ==========
  console.log('\n=== PARCEL SAMPLE ===');
  if (parcels.length > 0) {
    console.log('Fields:', Object.keys(parcels[0]));
    console.log('Sample:', JSON.stringify(parcels[0], null, 2).substring(0, 500));
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
