# Fliptracker Security Guidelines for Developers

**Version:** 1.0  
**Last Updated:** January 28, 2026  
**Status:** ⚠️ CRITICAL - Follow before any code commit

---

## Quick Security Checklist

Before committing code, verify:

- [ ] **No secrets in code** - No API keys, passwords, or tokens
- [ ] **No Firestore imports in frontend** - All DB access through backend API
- [ ] **All API endpoints have AuthGuard** - Protect sensitive operations
- [ ] **Data ownership validated** - Check `userId` matches authenticated user
- [ ] **No direct database calls** - Frontend → API → Backend → DB
- [ ] **.env file not committed** - Should be in .gitignore
- [ ] **Sensitive data encrypted** - Refresh tokens, access tokens
- [ ] **HTTPS in production** - Never HTTP
- [ ] **CORS properly configured** - Not `*` in production
- [ ] **Rate limiting enabled** - Prevent brute force attacks

---

## Architecture: Frontend → Backend → Database

```
┌─────────────────────────────────────────────────────────────────┐
│ CORRECT ARCHITECTURE                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Browser (Frontend)  →  API Calls  →  Backend  →  Firestore   │
│  ✅ No DB access        ✅ Secured      ✅ Verifies auth      │
│  ✅ Auth only            ✅ ID tokens    ✅ Checks ownership   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ INCORRECT (DO NOT USE)                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Browser (Frontend)  →  Direct DB Access  →  Firestore        │
│  ❌ SECURITY RISK!       ❌ EXPOSED KEYS!      ❌ NO CONTROL   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Secrets Management

### ✅ CORRECT

```bash
# Use environment variables (not in repo)
echo "VITE_FIREBASE_API_KEY=your-key" > .env.local

# .gitignore prevents accidental commits
# .env
# .env.local
# .env.*.local
```

### ❌ INCORRECT

```typescript
// ❌ NEVER DO THIS
const firebaseConfig = {
  apiKey: "AIzaSyCX1-uVQiSZBbiLDOPQjaNXX67RHgO_6mc",  // ❌ EXPOSED!
  projectId: "fliptracker-52632",
  // ...
};

// ❌ NEVER DO THIS
const secrets = {
  googleClientSecret: "your-secret-here",  // ❌ EXPOSED!
  databasePassword: "password123",  // ❌ EXPOSED!
};
```

### Rules

1. **Never commit secrets to git**
2. **Use .env files locally only**
3. **Use CI/CD secrets management in production**
4. **Rotate keys regularly** (monthly minimum)
5. **Log and audit secret access**

---

## 2. Frontend Security Rules

### ✅ Frontend CAN DO

```typescript
// ✅ Authentication with Firebase Auth
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
const user = await signInWithPopup(auth, googleProvider);

// ✅ Get ID token
const idToken = await user.getIdToken();

// ✅ Call backend API with token
const response = await fetch('/api/parcels', {
  headers: {
    'Authorization': `Bearer ${idToken}`
  }
});

// ✅ Store public Firebase config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,  // ✅ PUBLIC KEY OK
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  // Note: These are PUBLIC values meant for browser
};
```

### ❌ Frontend CANNOT DO

```typescript
// ❌ NEVER: Direct Firestore access
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
const db = getFirestore();
const parcels = await getDocs(query(collection(db, 'parcels'), where('userId', '==', uid)));

// ❌ NEVER: Call Firebase Admin SDK functions
import admin from 'firebase-admin';
admin.firestore().collection('parcels').get();  // ❌ Admin SDK is backend-only

// ❌ NEVER: Store backend service account keys
const serviceAccount = {
  type: "service_account",
  project_id: "fliptracker-52632",
  private_key: "-----BEGIN PRIVATE KEY-----...",  // ❌ EXPOSED!
};

// ❌ NEVER: Make direct database calls
const db = new Database('https://fliptracker.firebaseio.com');
db.ref('parcels').set(data);  // ❌ SECURITY BREACH

// ❌ NEVER: Expose API keys for third-party services
const genai = new GoogleGenAI({ apiKey: process.env.API_KEY });  // ❌ NO!
```

### Key Principle

**Frontend = Read/Auth Only**  
**Backend = Read + Write + Logic**

---

## 3. Backend Security Rules

### ✅ CORRECT Backend Code

```typescript
import { Controller, Get, Post, Delete, Param, UseGuards, Req } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { AuthGuard, AuthenticatedRequest } from '../auth/auth.guard';

@Controller('parcels')
@UseGuards(AuthGuard)  // ✅ PROTECT ALL ROUTES
export class ParcelsController {
  
  @Get()
  async findAll(@Req() req: AuthenticatedRequest) {
    // ✅ Query user's own data only
    return this.parcelsService.findByUserId(req.user.uid);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const parcel = await this.parcelsService.findById(id);
    
    // ✅ CRITICAL: Verify ownership before returning
    if (!parcel || parcel.userId !== req.user.uid) {
      throw new ForbiddenException('Access denied');
    }
    
    return { parcel };
  }

  @Post()
  async create(
    @Body() createDto: CreateParcelDto,
    @Req() req: AuthenticatedRequest,
  ) {
    // ✅ CRITICAL: Always use authenticated user's ID
    return this.parcelsService.create({
      ...createDto,
      userId: req.user.uid,  // ✅ From token, not from request body
    });
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const parcel = await this.parcelsService.findById(id);
    
    // ✅ CRITICAL: Verify ownership before deleting
    if (!parcel || parcel.userId !== req.user.uid) {
      throw new ForbiddenException('Access denied');
    }
    
    await this.parcelsService.delete(id);
    return { success: true };
  }
}
```

### ❌ INCORRECT Backend Code

```typescript
// ❌ NEVER: Skip authentication
@Get(':id')
async findOne(@Param('id') id: string) {
  // ❌ NO AuthGuard - ANYONE can access
  return this.parcelsService.findById(id);
}

// ❌ NEVER: Trust client userId
@Post()
async create(
  @Body() createDto: CreateParcelDto,
) {
  // ❌ User can claim any userId
  return this.parcelsService.create(createDto);
}

// ❌ NEVER: Return without checking ownership
@Get(':id')
async findOne(
  @Param('id') id: string,
  @Req() req: AuthenticatedRequest,
) {
  // ❌ Returning without userId check = data leak
  return this.parcelsService.findById(id);
}

// ❌ NEVER: Allow role escalation
@Patch(':id')
async update(
  @Body() updateDto: UpdateParcelDto,
) {
  // ❌ Attacker can make themselves admin
  return this.parcelsService.update(id, updateDto);
}
```

---

## 4. Firebase Security Rules

### ✅ Correct Rules

```javascript
// Deny everything by default, allow specific cases
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // ✅ Default: Deny all
    match /{document=**} {
      allow read, write: if false;
    }
    
    // ✅ Users: Own data only
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // ✅ Parcels: Own data only
    match /parcels/{parcelId} {
      allow read, write: if 
        request.auth.uid != null &&
        resource.data.userId == request.auth.uid;
    }
  }
}
```

### ❌ Insecure Rules

```javascript
// ❌ NEVER: Allow unauthenticated access
rules_version = '2';
service cloud.firestore {
  match /{document=**} {
    allow read, write: if true;  // ❌ EVERYONE CAN ACCESS
  }
}

// ❌ NEVER: No ownership check
rules_version = '2';
service cloud.firestore {
  match /parcels/{document=**} {
    allow read, write: if request.auth.uid != null;  // ❌ Can read ANYONE's parcels
  }
}

// ❌ NEVER: Trust client-side data
rules_version = '2';
service cloud.firestore {
  match /parcels/{document=**} {
    // ❌ Client claims ownership, no verification
    allow write: if request.resource.data.userId == 'any';
  }
}
```

---

## 5. Data Ownership Validation Pattern

**ALWAYS follow this pattern:**

```typescript
// Step 1: Get authenticated user from token
@Req() req: AuthenticatedRequest

// Step 2: Fetch resource
const resource = await this.service.findById(id);

// Step 3: Verify ownership (CRITICAL)
if (!resource || resource.userId !== req.user.uid) {
  throw new ForbiddenException('Access denied');
}

// Step 4: Perform operation
return resource;
```

**Apply this to ALL endpoints that:**
- Retrieve data: `GET /resource/:id`
- Update data: `PATCH /resource/:id`, `PUT /resource/:id`
- Delete data: `DELETE /resource/:id`

---

## 6. API Security Headers

### ✅ Correct CORS Configuration

```typescript
// app.module.ts
app.enableCors({
  origin: process.env.FRONTEND_URL,  // ✅ Specific origin
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

### ❌ Insecure CORS

```typescript
// ❌ NEVER IN PRODUCTION
app.enableCors({
  origin: '*',  // ❌ EVERYONE CAN ACCESS
});
```

---

## 7. Token Management

### ✅ Correct Token Usage

```typescript
// Get token with auto-refresh
const idToken = await user.getIdToken(forceRefresh);

// Include in all API calls
const response = await fetch('/api/resource', {
  headers: {
    'Authorization': `Bearer ${idToken}`
  }
});

// Backend verifies token
const decodedToken = await admin.auth().verifyIdToken(token);
```

### ❌ Incorrect Token Usage

```typescript
// ❌ NEVER: Store refresh token in localStorage
localStorage.setItem('refreshToken', refreshToken);

// ❌ NEVER: Send token in URL
fetch(`/api/parcels?token=${idToken}`);

// ❌ NEVER: Log tokens
console.log('Token:', idToken);  // ❌ Exposes to logs

// ❌ NEVER: Trust unverified tokens
const userId = jwt_decode(token).uid;  // ❌ Frontend decode - can be faked
```

---

## 8. Input Validation & SQL Injection Prevention

### ✅ Correct Input Validation

```typescript
import { IsString, IsEmail, IsUUID, MinLength, MaxLength, validate } from 'class-validator';

export class CreateParcelDto {
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  trackingNumber: string;

  @IsString()
  @IsIn(['ups', 'fedex', 'usps', 'dhl'])
  carrier: string;
}

// Use in controller
@Post()
async create(@Body() createDto: CreateParcelDto) {
  // ✅ Automatically validates input
  // Invalid input is rejected before DB query
}
```

### ❌ Incorrect (No Validation)

```typescript
// ❌ NEVER: Accept unvalidated input
@Post()
async create(@Body() data: any) {
  // ❌ attacker can pass malicious data
  return this.parcelsService.create(data);
}
```

---

## 9. Encryption for Sensitive Data

### ✅ Encrypt Sensitive Fields

```typescript
// Encrypt refresh tokens before storing
const encryptedToken = this.encryptionService.encrypt(refreshToken);
await this.repository.save({
  ...connectedEmail,
  refreshToken: encryptedToken,
});

// Decrypt when needed
const decrypted = this.encryptionService.decrypt(stored.refreshToken);
```

### Encryption Implementation

```typescript
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private key: Buffer;
  private algorithm = 'aes-256-gcm';

  constructor(private configService: ConfigService) {
    this.key = Buffer.from(this.configService.get('ENCRYPTION_KEY'), 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}.${authTag.toString('hex')}.${encrypted}`;
  }

  decrypt(ciphertext: string): string {
    const [ivHex, tagHex, encrypted] = ciphertext.split('.');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

---

## 10. Code Review Checklist for Security

When reviewing PRs, check:

- [ ] No hardcoded secrets or API keys
- [ ] All database endpoints have AuthGuard
- [ ] Ownership validation on protected endpoints
- [ ] No direct Firestore imports in frontend
- [ ] Input validation on all user inputs
- [ ] Sensitive data properly encrypted
- [ ] Error messages don't leak system info
- [ ] Rate limiting configured
- [ ] HTTPS/TLS enforced
- [ ] CORS properly configured

---

## Incident Response

**If you accidentally commit secrets:**

1. **Immediately** revoke the exposed credentials
2. **Generate** new credentials
3. **Update** `.env` with new values
4. **Force push** to remove from history (coordinate with team)
5. **Rotate** all related keys (OAuth tokens, API keys, etc.)

**Command to remove from history:**

```bash
git filter-repo --invert-paths --path '.env'
git push -f origin monorepo
```

---

## Resources

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [Firebase Security Best Practices](https://firebase.google.com/docs/firestore/security/start)
- [NestJS Security Guide](https://docs.nestjs.com/security/overview)
- [CWE Top 25](https://cwe.mitre.org/top25/)

---

## Questions?

For security concerns:
1. Create a **private security issue** (not public)
2. Email: security@fliptracker.dev
3. Do NOT commit secret information
4. Do NOT discuss in public PRs

---

**Last Updated:** January 28, 2026  
**Review Cycle:** Every 3 months  
**Next Review:** April 28, 2026
