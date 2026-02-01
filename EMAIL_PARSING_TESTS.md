# 🧪 Guide de Test - Parsing Intelligent des Emails

## Test Rapide en Console

### 1. Test du CarrierDetector

```typescript
// Dans la console Node.js ou test Jest
import { CarrierDetectorService } from './carriers/carrier-detector.service';

const detector = new CarrierDetectorService();

// Test Colissimo
detector.detectCarrier({
  from: 'noreply@colissimo.fr',
  subject: 'Votre colis est disponible',
  body: 'Retirez votre colis'
});
// ✅ Résultat attendu: 'colissimo'

// Test DHL
detector.detectCarrier({
  from: 'dhl.com',
  subject: 'Shipment notification',
  body: 'DHL Express delivery'
});
// ✅ Résultat attendu: 'dhl'

// Test UPS
detector.detectCarrier({
  from: 'ups.com',
  subject: 'Package on the way',
  body: 'Tracking 1Z9999W99999999999'
});
// ✅ Résultat attendu: 'ups'
```

### 2. Test des Parsers Spécialisés

#### Test Colissimo Parser

```typescript
import { ColissimoParserService } from './carriers/colissimo-parser.service';

const parser = new ColissimoParserService();

const email = {
  subject: 'Votre colis est disponible',
  from: 'noreply@colissimo.fr',
  body: `
    Bonjour Dupont Jean,
    
    Votre colis avec le numéro de suivi 6A12345678901 est disponible
    en point retrait.
    
    Code de retrait : ABC123
    
    Adresse : Bureau de Poste - 123 Rue de la Paix, 75001 Paris
    
    Disponible jusqu'au 15/02/2026
  `,
  receivedAt: new Date()
};

const result = parser.parse(email);

console.log(result);
/* ✅ Résultat attendu:
{
  trackingNumber: '6A12345678901',
  carrier: 'colissimo',
  withdrawalCode: 'ABC123',
  recipientName: 'Dupont Jean',
  pickupAddress: 'Bureau de Poste - 123 Rue de la Paix, 75001',
  pickupDeadline: Date('2026-02-15'),
  productName: 'Colissimo Point Retrait'
}
*/
```

#### Test DHL Parser

```typescript
import { DHLParserService } from './carriers/dhl-parser.service';

const parser = new DHLParserService();

const email = {
  subject: 'DHL Shipment Notification',
  from: 'dhl.com',
  body: `
    Dear John Smith,
    
    Your DHL Express shipment is on the way.
    
    Tracking number: 1234567890
    From: Amazon Warehouse
    Estimated delivery: 15/02/2026
  `,
  receivedAt: new Date()
};

const result = parser.parse(email);

console.log(result);
/* ✅ Résultat attendu:
{
  trackingNumber: '1234567890',
  carrier: 'dhl',
  recipientName: 'John Smith',
  senderName: 'Amazon Warehouse',
  productName: 'DHL Express'
}
*/
```

#### Test UPS Parser

```typescript
import { UPSParserService } from './carriers/ups-parser.service';

const parser = new UPSParserService();

const email = {
  subject: 'UPS Package Delivery',
  from: 'ups.com',
  body: `
    Hello Jane Doe,
    
    Tracking: 1Z9999W99999999999
    
    Delivery by: Monday, February 17, 2026
    From: Seller Store
    Reference: ORD-12345
  `,
  receivedAt: new Date()
};

const result = parser.parse(email);

console.log(result);
/* ✅ Résultat attendu:
{
  trackingNumber: '1Z9999W99999999999',
  carrier: 'ups',
  recipientName: 'Jane Doe',
  senderName: 'Seller Store',
  orderNumber: 'ORD-12345',
  productName: 'UPS'
}
*/
```

### 3. Test Tracking Number Extractor (ML)

```typescript
import { TrackingNumberExtractorService } from './tracking-number-extractor.service';

const extractor = new TrackingNumberExtractorService();

// Test avec texte contenant tracking UPS
const text1 = `
  Your order has been shipped with tracking number 1Z9999W99999999999.
  Expected delivery in 3-5 business days.
`;

const results1 = extractor.extractTrackingNumbers(text1);
console.log(results1);
/* ✅ Résultat attendu:
[
  {
    trackingNumber: '1Z9999W99999999999',
    carrier: 'ups',
    confidence: 'high'
  }
]
*/

// Test avec texte contenant tracking Colissimo
const text2 = `
  Bonjour, votre colis 6A12345678901 est en cours de livraison.
`;

const results2 = extractor.extractTrackingNumbers(text2);
console.log(results2);
/* ✅ Résultat attendu:
[
  {
    trackingNumber: '6A12345678901',
    carrier: 'colissimo',
    confidence: 'high'
  }
]
*/

// Test extraction du meilleur tracking
const best = extractor.extractBestTrackingNumber(text1);
console.log(best); // ✅ '1Z9999W99999999999'
```

### 4. Test EmailParsingService (Intégration)

```typescript
import { EmailParsingService } from './email-parsing.service';
// + tous les services nécessaires injectés

const emailService = new EmailParsingService(
  carrierDetector,
  vintedGoParser,
  mondialRelayParser,
  chronopostParser,
  colissimoParser,
  dhlParser,
  upsParser,
  fedexParser,
  trackingExtractor
);

// Test email Colissimo complet
const emailColissimo = {
  subject: 'Colissimo - Colis disponible',
  from: 'noreply@colissimo.fr',
  body: `
    Bonjour,
    
    Votre colis 6A98765432109 est prêt pour retrait.
    Code: XYZ789
    
    Point retrait: Relay 456 Av des Champs, 75008 Paris
    Retrait avant le 20/02/2026
  `
};

const parsed = await emailService.parseEmail(emailColissimo);
console.log(parsed);
/* ✅ Résultat attendu:
{
  trackingNumber: '6A98765432109',
  carrier: 'colissimo',
  withdrawalCode: 'XYZ789',
  pickupAddress: 'Relay 456 Av des Champs, 75008',
  pickupDeadline: Date('2026-02-20'),
  productName: 'Colissimo Point Retrait'
}
*/
```

## Test avec Vrais Emails (Firestore)

### Scénario 1 : Email Vinted Go

1. Connecter compte Gmail/Outlook qui reçoit emails Vinted Go
2. Déclencher sync : `POST /api/emails/sync`
3. Vérifier Firestore collection `parsedEmails/{userId}/emails`
4. Valider que parsing contient :
   - ✅ `trackingNumber` (code alphanumérique)
   - ✅ `carrier: 'vinted_go'`
   - ✅ `withdrawalCode` (code retrait)
   - ✅ `pickupAddress`
   - ✅ `pickupDeadline`

### Scénario 2 : Email Colissimo

1. Connecter compte qui reçoit emails Colissimo
2. Sync emails
3. Vérifier parsing :
   - ✅ `trackingNumber` format `6A...` ou `8V...`
   - ✅ `carrier: 'colissimo'`
   - ✅ `withdrawalCode` si point retrait
   - ✅ `recipientName`
   - ✅ `pickupAddress` si disponible

### Scénario 3 : Email Mondial Relay

1. Connecter compte qui reçoit emails Mondial Relay
2. Sync emails
3. Vérifier parsing :
   - ✅ `trackingNumber`
   - ✅ `carrier: 'mondial_relay'`
   - ✅ `withdrawalCode`
   - ✅ `pickupAddress`

### Scénario 4 : Email Inconnu (Fallback ML)

1. Envoyer soi-même un email test avec tracking UPS
2. Sync emails
3. Vérifier que :
   - ✅ Tracking détecté par ML même si sender inconnu
   - ✅ Carrier correctement inféré (`'ups'`)

## Commandes de Test

### Compilation

```bash
cd fliptracker/apps/backend
pnpm run build
```

### Lancer Tests Unitaires (si créés)

```bash
pnpm run test
```

### Test Manuel via API

```bash
# 1. Démarrer le serveur
pnpm run start:dev

# 2. Trigger sync pour un user
curl -X POST http://localhost:3000/api/emails/sync \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# 3. Vérifier les emails parsés
curl http://localhost:3000/api/emails/parsed \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Vérification Firestore Console

1. Ouvrir Firebase Console
2. Aller dans Firestore Database
3. Naviguer vers `parsedEmails/{userId}/emails`
4. Vérifier chaque document :
   - `trackingNumber` présent
   - `carrier` correct
   - Métadonnées extraites

## Métriques de Succès

### Objectifs

| Métrique | Objectif | Méthode de mesure |
|----------|----------|-------------------|
| **Taux de détection tracking** | >85% | Nb emails avec tracking / Total emails |
| **Précision carrier** | >90% | Nb carrier correct / Total détectés |
| **Extraction métadonnées** | >70% | Nb emails avec ≥5 champs / Total |
| **Faux positifs** | <5% | Nb mauvais tracking / Total détectés |
| **Latence parsing** | <100ms | Temps moyen par email |

### Dashboard de Monitoring

Créer une vue admin pour suivre :
- Total emails parsés
- Distribution par carrier
- Taux de succès par carrier
- Champs les plus/moins extraits
- Erreurs fréquentes

## Cas de Test Critiques

### ✅ Test 1 : Colissimo Standard

**Email** :
```
From: noreply@colissimo.fr
Subject: Votre colis est arrivé
Body: Numéro de suivi: 6A12345678901
```

**Attendu** :
- `trackingNumber: '6A12345678901'`
- `carrier: 'colissimo'`

---

### ✅ Test 2 : DHL Express

**Email** :
```
From: dhl.com
Subject: Shipment update
Body: AWB: 1234567890
```

**Attendu** :
- `trackingNumber: '1234567890'`
- `carrier: 'dhl'`

---

### ✅ Test 3 : UPS 1Z Format

**Email** :
```
From: ups.com
Subject: Package tracking
Body: 1Z9999W99999999999
```

**Attendu** :
- `trackingNumber: '1Z9999W99999999999'`
- `carrier: 'ups'`

---

### ✅ Test 4 : FedEx Ground

**Email** :
```
From: fedex.com
Subject: Delivery notification
Body: Tracking: 123456789012345 (15 digits)
```

**Attendu** :
- `trackingNumber: '123456789012345'`
- `carrier: 'fedex'`

---

### ✅ Test 5 : Email Sans Tracking

**Email** :
```
From: shop@example.com
Subject: Order confirmation
Body: Thank you for your order!
```

**Attendu** :
- `trackingNumber: undefined`
- `carrier: 'other'`

---

### ✅ Test 6 : Multi-Tracking (Premier seulement)

**Email** :
```
Body: 
Colis 1: 6A11111111111
Colis 2: 6A22222222222
```

**Attendu** :
- `trackingNumber: '6A11111111111'` (premier détecté)

---

## Debugging

### Activer les Logs

Dans `email-parsing.service.ts`, les logs sont déjà actifs :

```typescript
console.log(`[EmailParsingService] Detected carrier: ${carrierType}`);
console.log(`[EmailParsingService] Extracted tracking with ML: ${extractedNumber}`);
```

### Vérifier les Patterns

Si un tracking n'est pas détecté, tester manuellement :

```typescript
const text = "Votre colis 6A12345678901 est disponible";
const pattern = /([6-8][AV]\d{11})/g;
const match = text.match(pattern);
console.log(match); // ['6A12345678901']
```

### Tester ts-tracking-number

```typescript
import { findTracking } from 'ts-tracking-number';

const text = "Your tracking: 1Z9999W99999999999";
const results = findTracking(text);
console.log(results);
```

## Résolution de Problèmes

### Problème : Tracking non détecté

**Solutions** :
1. Vérifier le format exact du tracking dans l'email
2. Ajouter le pattern dans le parser spécifique
3. Vérifier que le carrier est bien détecté d'abord
4. Tester avec `TrackingNumberExtractor` directement

### Problème : Mauvais carrier détecté

**Solutions** :
1. Vérifier l'ordre des patterns dans `CarrierDetectorService`
2. Rendre le pattern plus spécifique
3. Ajouter check sur le `body` en plus de `from` et `subject`

### Problème : Métadonnées non extraites

**Solutions** :
1. Logger l'email brut pour voir le format exact
2. Ajuster les regex dans le parser spécifique
3. Tester les patterns regex séparément

---

**Astuce** : Commencer par tester chaque service individuellement avant de tester le flux complet ! 🎯
