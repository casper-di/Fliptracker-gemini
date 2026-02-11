const fs = require('fs');
const csv = fs.readFileSync(process.argv[2] || 'parcel_reports_2026-02-11T08-31-03.csv', 'utf-8');

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
      else if (c === '\r') { }
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

// Deep analyze specific rows
const rowsToCheck = [0, 1, 6, 11]; // Row 1, 2, 7, 12
for (const idx of rowsToCheck) {
  const d = data[idx];
  if (!d) continue;
  const raw = d.rawEmail || '';
  
  console.log('='.repeat(80));
  console.log('ROW ' + (idx+1) + ' | Carrier: ' + d.carrier + ' | Type: ' + d.parcel_type);
  console.log('Tracking: ' + d.parcel_trackingNumber);
  console.log('WithdrawalCode: "' + (d.parcel_withdrawalCode || '') + '"');
  console.log('Address: "' + (d.parcel_pickupAddress || '').substring(0, 150) + '"');
  console.log('');
  
  // Look for ALL "code" occurrences in raw email
  const codeMatches = [];
  const codeRegex = /code[^<]{0,50}/gi;
  let m;
  while ((m = codeRegex.exec(raw)) !== null) {
    codeMatches.push({ pos: m.index, text: m[0].trim().substring(0, 60) });
  }
  console.log('All "code" occurrences in email:');
  codeMatches.forEach(c => console.log('  pos=' + c.pos + ': "' + c.text + '"'));
  console.log('');
  
  // Look for QR URLs
  const qrRegex = /(?:qr_code|qr|barcode|aztec)[^"'\s]*/gi;
  const qrs = [];
  while ((m = qrRegex.exec(raw)) !== null) {
    qrs.push(m[0].substring(0, 100));
  }
  console.log('QR-related URLs:');
  qrs.forEach(q => console.log('  "' + q + '"'));
  console.log('');
  
  // Look for prices
  const priceRegex = /(\d+[\.,]\d{2})\s*(?:€|EUR|&euro;)/gi;
  const prices = [];
  while ((m = priceRegex.exec(raw)) !== null) {
    prices.push(m[0]);
  }
  console.log('Prices found:');
  prices.forEach(p => console.log('  "' + p + '"'));
  console.log('');
  
  // Look for "Voir sur la carte" etc
  const noiseRegex = /Voir sur la carte|Compl[eé]ter|Modifier la date|Horaires/gi;
  const noise = [];
  while ((m = noiseRegex.exec(raw)) !== null) {
    noise.push({ pos: m.index, text: m[0] });
  }
  console.log('UI noise text found:');
  noise.forEach(n => console.log('  pos=' + n.pos + ': "' + n.text + '"'));
  console.log('');
  
  // Look for Vinted mentions
  if (/vinted/i.test(raw)) {
    console.log('Contains "vinted": YES');
    const vintedContexts = [];
    const vr = /vinted[^<\s]{0,30}/gi;
    while ((m = vr.exec(raw)) !== null) {
      vintedContexts.push(m[0].substring(0, 40));
    }
    console.log('Vinted contexts: ' + vintedContexts.slice(0, 5).join(', '));
  }
  console.log('');
  
  // Extract the text that looks like the greeting / recipient
  const greetings = raw.match(/(?:Bonjour|Cher|Dear|Hello|Hi)\s+[^,<\n]{2,40}/gi) || [];
  console.log('Greetings:', greetings.join('; '));
  
  // Check if it looks forwarded
  const fwdIndicators = raw.match(/(?:transf[eé]r[eé]|forwarded|fwd:|tr:|de la part de|------.*Original|Begin forwarded)/gi) || [];
  console.log('Forward indicators:', fwdIndicators.length > 0 ? fwdIndicators.join('; ') : 'NONE');
  console.log('');
}
