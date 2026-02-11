const fs = require('fs');
const csv = fs.readFileSync(process.argv[2] || 'parcel_reports_2026-02-11T08-21-10.csv', 'utf-8');

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i+1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
      else if (c === '\r') { /* skip */ }
      else { field += c; }
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const rows = parseCSV(csv);
const headers = rows[0];
const data = rows.slice(1).filter(r => r.length > 5).map(r => {
  const obj = {};
  headers.forEach((h, i) => obj[h] = r[i] || '');
  return obj;
});

console.log('Total rows:', data.length);
console.log('Headers:', headers.join(', '));
console.log('');

// Print a summary of each row first
data.forEach((d, idx) => {
  console.log('--- ROW ' + (idx+1) + ' ---');
  console.log('  carrier:', d.carrier);
  console.log('  type:', d.parcel_type);
  console.log('  status:', d.parcel_status);
  console.log('  tracking:', d.parcel_trackingNumber);
  console.log('  title:', d.parcel_title);
  console.log('  withdrawalCode:', d.parcel_withdrawalCode || 'EMPTY');
  console.log('  qrCode:', (d.parcel_qrCode || 'EMPTY').substring(0, 80));
  console.log('  pickupAddress:', (d.parcel_pickupAddress || 'EMPTY').substring(0, 120));
  console.log('  pickupDeadline:', d.parcel_pickupDeadline || 'EMPTY');
  console.log('  estimatedDelivery:', d.parcel_estimatedDelivery || 'EMPTY');
  console.log('  itemPrice:', d.parcel_itemPrice || 'EMPTY');
  console.log('  currency:', d.parcel_currency || 'EMPTY');
  console.log('  marketplace:', d.parcel_marketplace || 'EMPTY');
  console.log('  recipientName:', d.parcel_recipientName || 'EMPTY');
  console.log('  senderName:', d.parcel_senderName || 'EMPTY');
  console.log('  lastEmailType:', d.parcel_lastEmailType || 'EMPTY');
  console.log('  productName:', d.parcel_productName || 'EMPTY');
  console.log('  orderNumber:', d.parcel_orderNumber || 'EMPTY');
  console.log('');
});

console.log('\n\n========== DEEP ANALYSIS ==========\n');

data.forEach((d, idx) => {
  const raw = d.rawEmail || '';
  const issues = [];
  
  // Check for forwarded emails
  const isForwarded = /transf[eé]r[eé]|forwarded|fwd:|tr\s*:/i.test(d.subject || '') || 
    /de la part de/i.test(raw);
  if (isForwarded) {
    issues.push('FORWARDED_EMAIL: This may be forwarded by brother, should be purchase not sale');
  }
  
  // Check if email contains pickup/retrieval language (= purchase) but parcel typed as sale
  if (d.parcel_type === 'sale') {
    const hasPickupLang = /code de retrait|r[eé]cup[eé]rer votre|votre colis est arriv|disponible.*point relais|retirer.*colis/i.test(raw);
    if (hasPickupLang) {
      issues.push('TYPE_WRONG: Typed as SALE but email talks about picking up/retrieving a parcel (should be PURCHASE)');
    }
  }
  
  // Check withdrawal code
  const rawLower = raw.toLowerCase();
  if (!d.parcel_withdrawalCode) {
    // Look for codes in the raw email
    const codePats = [
      /code suivant\s*:?\s*<[^>]*>([^<]+)</i,
      /code\s+s[eé]curis[eé][\s\S]{0,300}?(\d{4,8})/i,
      /code\s*(?:de\s*)?retrait[\s\S]{0,300}?(\d{4,8})/i,
      /accessCode["\s:]+["']?(\d{4,8})/i,
      /withdrawal.*code[\s\S]{0,100}?(\d{4,8})/i,
      /code.*retrait.*?(\d{4,8})/i,
      /votre code\s*:?\s*(\d{4,8})/i,
    ];
    for (const pat of codePats) {
      const m = raw.match(pat);
      if (m) {
        issues.push('MISSING_WITHDRAWAL_CODE: Found in email: "' + m[1].trim() + '"');
        break;
      }
    }
  }
  if (d.parcel_withdrawalCode === 'Code' || d.parcel_withdrawalCode === 'Retrait') {
    issues.push('BAD_WITHDRAWAL_CODE: Got literal keyword "' + d.parcel_withdrawalCode + '" instead of actual code');
  }
  
  // Check QR code
  if (!d.parcel_qrCode) {
    const qrPats = [
      /qr_codes\/[^"'\s]+/i,
      /barcode\/AztecCode[^"'\s]*/i,
      /src=["']([^"']*qr[^"']*)["']/i,
    ];
    for (const pat of qrPats) {
      const m = raw.match(pat);
      if (m) {
        issues.push('MISSING_QR_CODE: Found QR URL in email');
        break;
      }
    }
  }
  if (d.parcel_qrCode && /logo|vinted-go-logo|favicon|icon/i.test(d.parcel_qrCode)) {
    issues.push('BAD_QR_CODE: Captured logo/icon URL instead of actual QR code');
  }
  
  // Check address
  if (!d.parcel_pickupAddress) {
    const addrPats = [
      /selected_point=[^"]*">([^<]{10,})/i,
      /Point Relais[^<]*<[^>]*>[^<]*<[^>]*>([^<]{10,})/i,
      /adresse.*?:\s*([^<]{10,})/i,
    ];
    for (const pat of addrPats) {
      const m = raw.match(pat);
      if (m) {
        issues.push('MISSING_ADDRESS: Found in email: "' + m[1].trim().substring(0, 80) + '"');
        break;
      }
    }
  }
  if (d.parcel_pickupAddress && d.parcel_pickupAddress.length > 200) {
    issues.push('ADDRESS_TOO_LONG: ' + d.parcel_pickupAddress.length + ' chars');
  }
  if (d.parcel_pickupAddress && /Voir sur la carte|Compl[eé]ter|Modifier la date|vous remercie|Suivre mon colis/i.test(d.parcel_pickupAddress)) {
    issues.push('DIRTY_ADDRESS: Contains UI noise text');
  }
  
  // Check deadline
  if (!d.parcel_pickupDeadline) {
    const dlPats = [
      /retirer avant le[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i,
      /date limite[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i,
      /avant le\s*<[^>]*>\s*(\d{2}\/\d{2}\/\d{4})/i,
    ];
    for (const pat of dlPats) {
      const m = raw.match(pat);
      if (m) {
        issues.push('MISSING_DEADLINE: Found in email: "' + m[1] + '"');
        break;
      }
    }
  }
  
  // Check price
  if (!d.parcel_itemPrice) {
    const pricePats = [
      /(\d+[\.,]\d{2})\s*€/,
      /(\d+[\.,]\d{2})\s*EUR/i,
    ];
    for (const pat of pricePats) {
      const m = raw.match(pat);
      if (m) {
        issues.push('MISSING_PRICE: Found in email: "' + m[1] + ' EUR"');
        break;
      }
    }
  }
  
  // Check marketplace
  if (!d.parcel_marketplace) {
    if (/vinted/i.test(raw)) issues.push('MISSING_MARKETPLACE: Should be "Vinted"');
    else if (/leboncoin/i.test(raw)) issues.push('MISSING_MARKETPLACE: Should be "Leboncoin"');
  }
  
  // Check recipient
  if (!d.parcel_recipientName) {
    const namePats = [
      /Bonjour\s+([A-Z][a-zéèê]+(?:\s+[A-Z][a-zéèê]+)*)/,
      /Cher\s+([A-Z][a-zéèê]+)/,
    ];
    for (const pat of namePats) {
      const m = raw.match(pat);
      if (m) {
        issues.push('MISSING_RECIPIENT: Found in email: "' + m[1] + '"');
        break;
      }
    }
  }
  
  // Check email type
  if (d.parcel_lastEmailType === 'unknown') {
    issues.push('EMAIL_TYPE_UNKNOWN');
  }
  
  // Check tracking mismatch
  const trackingLinks = raw.match(/vintedgo\.com\/[a-z]+\/tracking\/([A-Z0-9]+)/gi) || [];
  const trackingNumbers = [];
  trackingLinks.forEach(l => {
    const m = l.match(/tracking\/([A-Z0-9]+)/i);
    if (m) trackingNumbers.push(m[1]);
  });
  if (trackingNumbers.length > 0 && d.parcel_trackingNumber) {
    if (!trackingNumbers.includes(d.parcel_trackingNumber)) {
      issues.push('TRACKING_MISMATCH: parsed="' + d.parcel_trackingNumber + '" but email has: ' + [...new Set(trackingNumbers)].join(', '));
    }
  }
  
  // Print
  if (issues.length > 0) {
    console.log('=' .repeat(80));
    console.log('ROW ' + (idx+1) + ' | Carrier: ' + d.carrier + ' | Type: ' + d.parcel_type);
    console.log('  Subject: ' + (d.subject || 'N/A').substring(0, 100));
    console.log('  Tracking: ' + (d.parcel_trackingNumber || 'EMPTY'));
    console.log('  ISSUES (' + issues.length + '):');
    issues.forEach(i => console.log('    ❌ ' + i));
    console.log('');
  }
});
