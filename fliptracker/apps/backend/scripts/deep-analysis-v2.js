/**
 * Get raw emails for reported parcels to understand what went wrong
 */
const admin = require('firebase-admin');

const projectId = 'fliptracker-52632';
const clientEmail = 'firebase-adminsdk-fbsvc@fliptracker-52632.iam.gserviceaccount.com';
const privateKey = ('-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC4L9I+zVIF86Fe\nkDIdAq9b+AjYsOIz/OuBuqick1+17Tw6m6luUpcNBOV2nKp7ZuBj+SRKL/P0j3E7\nuWU96tvErSaplF5uorw+JtbZbuq1PaOHSumcMRFIX9wuquphLArOuUenhs1sN3X6\nG8aDWsBS4uO/54xnaG9B8REknLtmXWlC0zFbbvsePy4mdPXRDLThF7sob/W5aVyJ\naaSpOBi3Crky6XvfajZJ0YuRUYU878TqTiTVP8T2rhHbDfcrFuE91AIfixDQ2Ls2\nEFkMRT7WAV+u6qwV/cIbOPKLdNUF151qIMXJI1RLxqEs38WKf6xFxopJAtLvt5O6\nvSKpiwNnAgMBAAECggEAQpLGY3zDEPOmeA+WjXXS/GMCj5AfsrrQROu61h1OkutU\nwbpR21Zu0n3akqy90iy1Hm2G+Gmsu9C9FOFF/sNM/CG5v8GpAERB1hUjwyOcIjZN\nTTF+jr4NiSNc6mFMpiLNJTtC8wJ+bYb+VZCEiCXdLhhkSZDf5uCQlj0T/S/JbI3o\ncY61ljrZe+7BgxUkZfDmbruSbns2nP9HKxykwOnwdzB6n86kF7VllhW0uqAYE9hB\nH8Rr14Bsin+52RB/TBvTtwnq1EstZPWjKmCXBQhYXRkRJy9QvbjZT5TMf6KgEGWQ\nB+E1WuEqK/0M8zxEMtJyBgmySuK2wef3UTSwPb3hgQKBgQD5F3ITDGDOFRRcm6X6\nL+7HPzRwgjS31TjndCT2ClK9el30c3Fzzb/PaiFXb9OhxzaYqBOmNNv6enTrwv7t\n7RNofL5AucYY0mZCIoLHv4CFE8FlOZY6WSgniGdYJey49+kS66gelNwt9w4qenrh\n0XHWGX1L7rXysIYmT9Eoc346qQKBgQC9S4z2I6YrwIphpYnSnYPQae2nZVPTuDSP\n8gn6pJ3BPpEVJm0CYXMZMpCz6T4NyAbuRMMlA67g7rum/kTlI8iCfjFQrTRk15hX\nAxXlRoznAOp9sp99cP6CMBrf8mFLJBcr2dffW3WFz3+Qi2ODKPHFp4izG2RJwuGd\nN0N03iSnjwKBgHHtplBODgzUGV8OFckrmUPqhbqb4y7dyEwclDcwm41sZYLENnTn\n+z4L5boPPLW23yLNZUdUz/RthAK9Skpab9EPlRkXnyKFQR4omLZxwX+cfI0m3K5N\nTw9d1R69IdusEB+GR3vNTDN91y3YnVGhsTZirCtJwFCDKqhlQ14EDQ0ZAoGARKsJ\ngajA+RIpoO6KJqsZTBuBKL5rQFyMRMOKty/MQnPN8Zw04y4ysKtVLs6nwhwT149+\nMwk5AUPZMuT+XRkz/ZKFlTyfyw0iqD3oTXngV1RPvDV2Ae1hhhypQyAMB1QaS8AE\nvXPSGC6Dmg3WlZfezNLPlhmTseZOLdgEUnrbVSUCgYAISnevEK4MNNkHVpfuAcK1\nwffJ2YQYInhrIvU/UMfHLz63Nhru64oXvPbBqyVQv2bx8VfIKxvPJXA6VA846kai\nrIYwfBSbkS3expPj/DIISepjjSwMUH45iNhWT/er01l5Y4ZjhVSILCTgkIWurbuq\ngQacjYb+yAp0Xx5u+q8EDQ==\n-----END PRIVATE KEY-----\n' || '').replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
});
const db = admin.firestore();

async function analyze() {
  // Get all users first
  const usersSnap = await db.collection('users').get();
  const userIds = usersSnap.docs.map(d => d.id);
  console.log(`Found ${userIds.length} users`);

  // Collect all raw emails across all users
  const allRawEmails = {};
  for (const uid of userIds) {
    const rawSnap = await db.collection('users').doc(uid).collection('raw_emails').get();
    rawSnap.forEach(doc => {
      allRawEmails[doc.id] = doc.data();
    });
  }
  console.log(`Total raw emails: ${Object.keys(allRawEmails).length}`);

  // Get all parcels
  const allParcels = [];
  for (const uid of userIds) {
    const parcSnap = await db.collection('users').doc(uid).collection('parcels').get();
    parcSnap.forEach(doc => {
      allParcels.push({ id: doc.id, ...doc.data() });
    });
  }
  console.log(`Total parcels: ${allParcels.length}`);

  // Get reports
  const reportsSnap = await db.collection('parcel_reports').get();
  const reportedParcelIds = new Set();
  reportsSnap.forEach(doc => {
    const d = doc.data();
    reportedParcelIds.add(d.parcelId);
  });
  console.log(`Reported parcels: ${reportedParcelIds.size}`);

  // Analyze each parcel
  console.log(`\n${'='.repeat(120)}`);
  console.log('FULL PARCEL ANALYSIS');
  console.log(`${'='.repeat(120)}`);

  // Group by problem type
  const issues = {
    carrier_other: [],     // carrier=other, should be specific
    type_wrong: [],        // wrong sale/purchase
    no_address: [],        // missing address
    no_marketplace: [],    // missing marketplace
    no_price: [],          // missing price
    bad_tracking: [],      // fake/wrong tracking number
    not_parcel: [],        // not a parcel email at all
    sale_not_detected: [], // is a sale but detected as purchase
  };

  for (const parcel of allParcels) {
    const isReported = reportedParcelIds.has(parcel.id);
    const raw = allRawEmails[parcel.sourceEmailId];
    
    if (!raw) continue;

    const subject = (raw.subject || '').toLowerCase();
    const from = (raw.from || '').toLowerCase();
    const body = raw.rawBody || '';
    const bodyLower = body.toLowerCase();
    const isPlainText = (body.match(/<[a-z][^>]*>/gi) || []).length < 5;
    const isForwarded = /message transféré|forwarded message/i.test(body);
    
    // Strip HTML for text analysis
    const text = body
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ').trim().toLowerCase();

    const info = {
      id: parcel.id,
      tracking: parcel.trackingNumber,
      carrier: parcel.carrier,
      type: parcel.type,
      marketplace: parcel.marketplace,
      title: parcel.title,
      price: parcel.itemPrice,
      address: parcel.pickupAddress?.substring(0, 80),
      code: parcel.withdrawalCode,
      qr: parcel.qrCode ? 'YES' : 'NO',
      reported: isReported ? '🚨' : '',
      subject: (raw.subject || '').substring(0, 80),
      from: (raw.from || '').substring(0, 50),
      isPlainText,
      isForwarded,
    };

    // Detect issues
    
    // 1. Carrier=other but has real carrier keywords
    if (parcel.carrier === 'other') {
      const detectedCarrier = 
        /chronopost/i.test(text) ? 'chronopost' :
        /mondial.relay/i.test(text) ? 'mondial_relay' :
        /colissimo/i.test(text) ? 'colissimo' :
        /vinted.?go/i.test(text) ? 'vinted_go' :
        /dhl/i.test(text) ? 'dhl' :
        /ups/i.test(text) ? 'ups' :
        null;
      if (detectedCarrier) {
        issues.carrier_other.push({ ...info, shouldBe: detectedCarrier });
      }
    }

    // 2. Sale emails detected as purchase
    const hasSalePatterns = /tu as déposé|vous avez déposé|a été déposé|drop.off|bordereau|étiquette d'expédition|label created|prêt à être expédié/i.test(text);
    const hasBuyerRetrieved = /l'acheteur a récupéré|a bien été récupéré par|buyer.*collected|récupéré par l'acheteur/i.test(text);
    if ((hasSalePatterns || hasBuyerRetrieved) && parcel.type === 'purchase') {
      issues.type_wrong.push({ ...info, reason: hasBuyerRetrieved ? 'BUYER_RETRIEVED (seller notification)' : 'SALE_KEYWORDS' });
    }

    // 3. Not a real parcel
    const isNotification = /satisfait|trustpilot|review|avis|feedback|note.*expérience/i.test(subject + text);
    const isPromo = /offre|promotion|solde|réduction|coupon|newsletter/i.test(subject);
    const isBankCard = /carte.*bancaire|carte.*crédit|visa|mastercard|paiement/i.test(subject + text) && !/tracking|colis|suivi/i.test(subject);
    const isRandom = !parcel.trackingNumber || /^[0-9]{1,5}$/.test(parcel.trackingNumber);
    
    if (isNotification || isPromo || isBankCard) {
      issues.not_parcel.push({ ...info, reason: isNotification ? 'REVIEW/FEEDBACK' : isPromo ? 'PROMO' : 'BANK/OTHER' });
    }

    // Print each parcel
    const marker = isReported ? '🚨' : '  ';
    console.log(`${marker} [${(parcel.carrier||'?').padEnd(12)}] ${(parcel.trackingNumber||'N/A').padEnd(22)} type=${(parcel.type||'?').padEnd(8)} mkt=${(parcel.marketplace||'-').padEnd(10)} price=${String(parcel.itemPrice||'-').padEnd(6)} code=${(parcel.withdrawalCode||'-').padEnd(8)} qr=${parcel.qrCode?'Y':'N'} addr=${parcel.pickupAddress?'Y':'N'}`);
    console.log(`   📧 subj="${(raw.subject||'').substring(0,80)}" from="${(raw.from||'').substring(0,50)}" fwd=${isForwarded} plain=${isPlainText}`);
  }

  // Print issue summaries
  console.log(`\n${'='.repeat(120)}`);
  console.log('ISSUE CATEGORIES');
  console.log(`${'='.repeat(120)}`);

  console.log(`\n--- CARRIER=OTHER (should be specific) [${issues.carrier_other.length}] ---`);
  for (const i of issues.carrier_other) {
    console.log(`  ${i.reported} ${i.tracking} → should be ${i.shouldBe} | subj="${i.subject}"`);
  }

  console.log(`\n--- TYPE WRONG (sale detected as purchase) [${issues.type_wrong.length}] ---`);
  for (const i of issues.type_wrong) {
    console.log(`  ${i.reported} ${i.tracking} [${i.carrier}] reason=${i.reason} | subj="${i.subject}"`);
  }

  console.log(`\n--- NOT A PARCEL EMAIL [${issues.not_parcel.length}] ---`);
  for (const i of issues.not_parcel) {
    console.log(`  ${i.reported} ${i.tracking} reason=${i.reason} | subj="${i.subject}"`);
  }

  process.exit(0);
}

analyze().catch(e => { console.error(e); process.exit(1); });
