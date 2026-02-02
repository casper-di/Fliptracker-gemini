# 🎯 Architecture de Parsing Email (Simplifiée)

## 📋 Résumé

Approche hybride : Regex pour parsing rapide, DeepSeek API pour cas complexes **en temps réel**.

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

### Phase 3 : DeepSeek Enhancement (Temps Réel)
```
Si completeness < 70%:
    → Log info pour identifier l'email
    → TODO: Appeler DeepSeek API directement
    → Recevoir résultat enrichi
    → Créer parcel avec données complètes

Si completeness >= 70%:
    → Créer parcel directement avec données regex
```

## 🔄 Flux de traitement

```
Email reçu
    ↓
[Détection tracking?]
    ↓ oui
[Parsing regex]
    ↓
[Completeness >= 70%?]
    ↓ oui                          ↓ non
[Créer parcel]              [Appel DeepSeek API]
                                   ↓
                            [Créer parcel enrichi]
```

## 💰 Économie de coûts

### Ollama hébergé (abandonné)
- Serveur GPU/CPU dédié : **25-50$/mois**
- Toujours en marche même si peu d'emails

### DeepSeek API (actuel)
- Paiement à l'usage uniquement
- ~0.0005$/email analysé
- Seulement pour emails incomplets (< 70%)
- 1000 emails complexes/mois = **0.50$/mois**

**Économie : ~50-100x moins cher !**

## 🎯 Prochaines étapes

1. **Implémenter service DeepSeek**
   - Créer `DeepSeekService` avec client API
   - Formatter prompt pour parsing email
   - Parser réponse JSON de DeepSeek

2. **Intégrer dans le flow**
   - Remplacer le log par appel réel DeepSeek
   - Merger résultat avec parsing regex
   - Créer parcel avec données complètes

3. **QR Code extraction**
   - Utiliser `jsQR` library
   - Extraire images de HTML emails
   - Décoder QR codes automatiquement

## 🔧 Variables d'environnement

```bash
# .env
DEEPSEEK_API_KEY=sk-ef9c0ebfeb1d48d89e15e11b77461f43
```

## 📝 Flow actuel (temporaire)

Quand un email de tracking a completeness < 70% :
```typescript
console.log('🤖 Incomplete parsing - calling DeepSeek...');
console.log('📧 Email to send to DeepSeek:');
console.log('   Subject: ...'); 
console.log('   Partial tracking: ...');
console.log('⏸️ Skipping for now (DeepSeek not yet implemented)');
// TODO: Remplacer par vraie implémentation DeepSeek
```
