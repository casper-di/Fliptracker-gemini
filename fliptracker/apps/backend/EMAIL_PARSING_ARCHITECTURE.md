# 🎯 Architecture de Parsing Email (Simplifiée)

## 📋 Résumé

Suppression complète d'Ollama/NLP. Utilisation d'une approche progressive :
1. **Regex** pour parsing immédiat (gratuit, rapide)
2. **DeepSeek API** pour les cas complexes uniquement (économique)
3. **QR Code extraction** seulement si le tracking existe déjà

## 🏗️ Architecture

### Phase 1 : Détection (isTrackingEmail)
```
Email reçu → EmailTrackingDetectorService
            → Détecte si c'est un email de tracking (keywords regex)
            → Retourne: true/false
```

### Phase 2 : Parsing Regex
```
Si isTrackingEmail=true → HybridEmailParsingService
                        → EmailParsingService (parsers regex par carrier)
                        → Extraction: tracking, carrier, QR code, etc.
                        → Calcul completeness score (0-100%)
```

### Phase 3 : Décision intelligente
```
Si completeness < 70% ET tracking number trouvé:
    → Vérifier si tracking existe dans DB (ParcelsService)
    
    Si tracking N'existe PAS:
        → Logger dans UnparsedEmail collection
        → Status: 'pending' (pour traitement DeepSeek futur)
        → Ne PAS créer de parcel
    
    Si tracking EXISTE:
        → Mettre à jour le parcel avec nouvelles infos
        → Extraire QR code image si présent
```

## 🗄️ Nouvelle Collection Firestore

### `unparsedEmails`
Stocke les emails de tracking qui nécessitent DeepSeek :

```typescript
{
  id: string;
  userId: string;
  messageId: string;
  provider: 'gmail' | 'outlook';
  subject: string;
  from: string;
  body: string; // Full HTML body pour DeepSeek
  receivedAt: Date;
  trackingNumber?: string; // Si trouvé par regex
  carrier?: string;
  completenessScore: number; // 0-100%
  isTrackingEmail: boolean;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}
```

## 💰 Économie de coûts

### Avant (Ollama hébergé)
- Serveur GPU/CPU dédié : **25-50$/mois**
- Toujours en marche même si peu d'emails

### Après (DeepSeek API)
- Paiement à l'usage uniquement
- ~0.0005$/email analysé
- 1000 emails complexes/mois = **0.50$/mois**

**Économie : ~50-100x moins cher !**

## 🔄 Flux de traitement

```mermaid
Email reçu
    ↓
[Détection tracking?]
    ↓ oui
[Parsing regex]
    ↓
[Completeness >= 70%?]
    ↓ oui                      ↓ non
[Créer parcel]         [Tracking trouvé?]
                           ↓ oui         ↓ non
                    [Existe dans DB?]   [Logger pour DeepSeek]
                      ↓ oui    ↓ non
                  [Update]  [Logger pour DeepSeek]
```

## 🚀 Prochaines étapes (DeepSeek)

1. **Créer service DeepSeek** (futur)
   - Endpoint API pour traiter les `unparsedEmails`
   - Utiliser DeepSeek Chat API
   - Parser les emails complexes

2. **Traitement batch**
   - Cron job quotidien
   - Traiter tous les `pending` unparsedEmails
   - Créer les parcels manquants

3. **QR Code extraction**
   - Utiliser `jsQR` library
   - Extraire images de HTML emails
   - Décoder QR codes automatiquement
   - Sauvegarder l'image en base64

## 🔧 Variables d'environnement

```bash
# .env
DEEPSEEK_API_KEY=sk-ef9c0ebfeb1d48d89e15e11b77461f43
```

## 📁 Fichiers modifiés

### Supprimés
- ❌ `modules/nlp/` (tout le dossier)

### Créés
- ✅ `domain/entities/unparsed-email.entity.ts`
- ✅ `domain/repositories/unparsed-email.repository.ts`
- ✅ `infrastructure/repositories/firestore-unparsed-email.repository.ts`
- ✅ `modules/email-services/unparsed-emails.service.ts`

### Modifiés
- 🔄 `modules/email-services/hybrid-email-parsing.service.ts`
- 🔄 `modules/email-services/email-sync.orchestrator.ts`
- 🔄 `modules/email-services/email-services.module.ts`

## ✅ État actuel

- ✅ Ollama supprimé
- ✅ Parsing regex fonctionnel
- ✅ Détection tracking emails
- ✅ Logging emails incomplets
- ✅ Vérification DB avant logging
- ⏳ Service DeepSeek (à implémenter)
- ⏳ QR code extraction (à implémenter)
