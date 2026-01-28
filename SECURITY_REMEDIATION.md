# Fliptracker Security Remediation Plan
**Date:** January 28, 2026  
**Priority:** 🔴 **CRITICAL**  
**Issue:** Direct database access patterns and exposed Firebase credentials

---

## Executive Summary

**Security Status: 🔴 HIGH RISK**

The codebase has the following critical security issues:

1. **Exposed Firebase Credentials** in git history
2. **Potential direct database access** vulnerability patterns
3. **Frontend has Firebase SDK** (browser-accessible)
4. **Secrets committed to repository**
5. **Missing API-only access control**

---

## Critical Issues Identified

### 🔴 Issue #1: Firebase Credentials Exposed in .env File

**Location:** `/fliptracker/apps/backend/src/.env`

**Exposed Credentials:**
```
apiKey: "AIzaSyCX1-uVQiSZBbiLDOPQjaNXX67RHgO_6mc"
authDomain: "fliptracker-52632.firebaseapp.com"
projectId: "fliptracker-52632"
storageBucket: "fliptracker-52632.firebasestorage.app"
messagingSenderId: "675025970889"
appId: "1:675025970889:web:186ff8e7f1082cc05ecf18"
```

**Risk Level:** 🔴 CRITICAL

**Exposure Path:**
- Committed to git repository ✅ FOUND
- Visible in git history ✅ VULNERABLE
- Stored in plaintext ✅ VULNERABLE

**Implications:**
- Attackers can identify Firebase project
- Attackers can access Firestore database (if rules are permissive)
- Attackers can impersonate users via Auth
- OWASP: A05:2021 – Broken Access Control

---

### 🔴 Issue #2: Frontend Has Firebase SDK Access

**Location:** `/fliptracker/apps/frontend/services/firebaseService.ts`

**Current State:**
```typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  // ... more credentials
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
```

**Risk Assessment:**
- Frontend can directly call Firebase Auth ✅ ACCEPTABLE
- Frontend could theoretically access Firestore ⚠️ POTENTIAL RISK
- Frontend has browser-accessible credentials ❌ NOT SECURE

**Current Usage:**
- Firebase Auth for login ✅ CORRECT (authentication only)
- No direct Firestore access ✅ GOOD
- All data flows through backend API ✅ GOOD

**But:**
- Credentials are visible in source code
- Credentials are exposed in browser
- Browser JavaScript can be read by attackers

---

### 🟡 Issue #3: Missing API Authorization on Data Operations

**Current State:**
```typescript
// Backend repositories exist ✅
// Services layer exists ✅
// Controllers have AuthGuard ✅
// But: No explicit data ownership validation
```

**Gap:**
While `@UseGuards(AuthGuard)` is present, some endpoints may not validate that the user owns the data they're requesting.

**Example Risk:**
```typescript
// Potential vulnerability if not checking userId
@Get(':id')
async findOne(@Param('id') id: string) {
  // If this doesn't verify the parcel belongs to the user...
  return this.parcelsService.findById(id);  // ⚠️ RISK
}
```

---

## Current Architecture Assessment

### ✅ What's Correctly Implemented

1. **Backend Repository Pattern**
   - Domain layer with interfaces ✅
   - Infrastructure implementations ✅
   - Firestore repositories properly configured ✅

2. **API-First Architecture**
   - Controllers with AuthGuard ✅
   - Services layer with business logic ✅
   - Frontend uses API calls, not direct DB ✅

3. **Authentication**
   - Firebase Auth properly integrated ✅
   - ID tokens retrieved and validated ✅
   - Token refresh mechanism ✅

4. **Authorization**
   - AuthGuard on protected routes ✅
   - User context passed to services ✅

### ❌ What Needs Fixing

1. **Exposed Secrets**
   - Firebase credentials in git ❌
   - .env file not git-ignored ❌
   - Credentials visible in plaintext ❌

2. **Missing Data Ownership Checks**
   - Not all endpoints validate ownership ❌
   - Potential access to other users' data ❌

3. **Frontend SDK Configuration**
   - Browser still has Firebase config ⚠️
   - Could be exploited if rules aren't strict ⚠️

4. **Missing Firestore Security Rules**
   - Need to restrict database access to authenticated users only
   - Need to scope reads/writes to user's own data

---

## Remediation Steps

### Phase 1: Immediate (Critical - Within 24 hours)

#### Step 1.1: Revoke Compromised Credentials

**Action:** Change all exposed Firebase project credentials

```bash
# Navigate to Firebase Console
# Project: fliptracker-52632
# Action: Generate new API keys
# Timeline: 5 minutes
# Impact: May require app restart
```

**Steps:**
1. Go to Firebase Console → Project Settings
2. Service Accounts tab → Generate new private key
3. Update backend `.env` with new key
4. Rotate Firebase authentication tokens
5. Force user re-login

---

#### Step 1.2: Remove Secrets from Git History

**Action:** Remove credentials from repository history

```bash
# Install git-filter-repo if needed
pip install git-filter-repo

# Remove .env file from history
git filter-repo --invert-paths --path '.env'
git filter-repo --invert-paths --path 'fliptracker/apps/backend/src/.env'

# Force push (DANGEROUS - coordinate with team)
git push -f origin monorepo
```

**Risk:** This rewrites git history and requires force-push. Notify all team members.

---

#### Step 1.3: Add .env to .gitignore

**Action:** Prevent future secrets commits

```bash
# Add to root .gitignore
cat >> .gitignore << 'EOF'

# Environment variables (NEVER commit)
.env
.env.local
.env.*.local
fliptracker/apps/backend/src/.env
fliptracker/apps/backend/.env
fliptracker/apps/frontend/.env
fliptracker/apps/frontend/.env.local

# IDE secrets
.vscode/settings.json

# OS files
.DS_Store
Thumbs.db

# Temporary files
*.tmp
*.log
EOF

git add .gitignore
git commit -m "chore: add sensitive files to .gitignore"
```

---

#### Step 1.4: Create Environment Variable Template

**File:** `/fliptracker/.env.example`

```bash
# Backend Configuration
NODE_ENV=development
PORT=3001
FRONTEND_URL=https://improved-space-funicular-wv6xx6x9w5w35jxw-5000.app.github.dev

# Firebase Admin SDK (Backend Only)
# Get from Firebase Console > Project Settings > Service Accounts
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY=your-private-key

# OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://improved-space-funicular-wv6xx6x9w5w35jxw-3001.app.github.dev/api/emails/connect/gmail/callback

MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_REDIRECT_URI=https://improved-space-funicular-wv6xx6x9w5w35jxw-3001.app.github.dev/api/emails/connect/outlook/callback

# Encryption
ENCRYPTION_KEY=your-32-byte-hex-key

# Frontend Configuration (PUBLIC - OK to expose)
VITE_FIREBASE_API_KEY=your-public-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_API_URL=https://improved-space-funicular-wv6xx6x9w5w35jxw-3001.app.github.dev/api
```

**Action:**
```bash
# Create example file
cp fliptracker/apps/backend/src/.env fliptracker/.env.example

# Remove secrets from example
sed -i 's/="[^"]*"$/="your-value"/g' fliptracker/.env.example

# Add to git
git add fliptracker/.env.example
git commit -m "docs: add environment variable template"

# Remove actual .env from git tracking
git rm --cached fliptracker/apps/backend/src/.env
git commit -m "chore: remove .env from tracking"
```

---

### Phase 2: Short-term (High Priority - This Week)

#### Step 2.1: Implement Missing Data Ownership Validations

**Issue:** Some endpoints may not validate data ownership

**Fix for Parcels Controller:**

```typescript
// File: fliptracker/apps/backend/src/modules/parcels/parcels.controller.ts

@Get(':id')
async findOne(
  @Param('id') id: string,
  @Req() req: AuthenticatedRequest,
) {
  const parcel = await this.parcelsService.findById(id);
  
  // ✅ CRITICAL: Verify ownership
  if (!parcel || parcel.userId !== req.user.uid) {
    throw new ForbiddenException('Access denied');
  }
  
  return { parcel };
}

@Patch(':id')
async update(
  @Param('id') id: string,
  @Body() updateDto: UpdateParcelDto,
  @Req() req: AuthenticatedRequest,
) {
  const existing = await this.parcelsService.findById(id);
  
  // ✅ CRITICAL: Verify ownership before update
  if (!existing || existing.userId !== req.user.uid) {
    throw new ForbiddenException('Access denied');
  }
  
  const parcel = await this.parcelsService.update(id, updateDto);
  return { parcel };
}

@Delete(':id')
async delete(
  @Param('id') id: string,
  @Req() req: AuthenticatedRequest,
) {
  const existing = await this.parcelsService.findById(id);
  
  // ✅ CRITICAL: Verify ownership before deletion
  if (!existing || existing.userId !== req.user.uid) {
    throw new ForbiddenException('Access denied');
  }
  
  await this.parcelsService.delete(id);
  return { success: true };
}
```

**Audit Checklist:**
- [ ] ParcelsController - all endpoints check userId
- [ ] ConnectedEmailsController - verify email ownership
- [ ] UsersController - verify user identity

---

#### Step 2.2: Implement Firestore Security Rules

**File:** Create `fliptracker/firestore.rules`

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // ✅ Deny everything by default
    match /{document=**} {
      allow read, write: if false;
    }
    
    // ✅ Users: Only read/write own document
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // ✅ ConnectedEmails: Only user's own emails
    match /connectedEmails/{document=**} {
      allow read, write: if 
        resource.data.userId == request.auth.uid ||
        request.resource.data.userId == request.auth.uid;
    }
    
    // ✅ Parcels: Only user's own parcels
    match /parcels/{document=**} {
      allow read, write: if 
        resource.data.userId == request.auth.uid ||
        request.resource.data.userId == request.auth.uid;
    }
    
    // ✅ Prevent direct backend access from frontend
    // (All reads/writes should go through backend API)
  }
}
```

**Deploy:**
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Set project
firebase use fliptracker-52632

# Deploy rules
firebase deploy --only firestore:rules
```

---

#### Step 2.3: Remove Unused Firebase SDK from Frontend

**Current State:**
- Frontend imports Firebase ✅ (needed for auth)
- Frontend doesn't access Firestore ✅ (correct)
- But frontend SDK can be minimized

**Optimization:**
```typescript
// frontend/services/firebaseService.ts
// Current: imports entire Firebase SDK

// Better: import only Auth
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut, onAuthStateChanged, User } from 'firebase/auth';

// ✅ NO Firestore imports
// ✅ NO Database imports
// ✅ NO Storage imports
```

**Status:** Already compliant ✅

---

### Phase 3: Long-term (Best Practices)

#### Step 3.1: Implement Environment Variable Validation

**File:** `fliptracker/apps/backend/src/config/validate.ts`

```typescript
import { plainToInstance } from 'class-transformer';
import { IsString, IsOptional, ValidateIf, validate } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  NODE_ENV: string;

  @IsString()
  PORT: string;

  @IsString()
  FRONTEND_URL: string;

  @IsString()
  FIREBASE_PROJECT_ID: string;

  @IsString()
  FIREBASE_CLIENT_EMAIL: string;

  @IsString()
  FIREBASE_PRIVATE_KEY: string;

  @IsString()
  GOOGLE_CLIENT_ID: string;

  @IsString()
  GOOGLE_CLIENT_SECRET: string;

  @IsString()
  GOOGLE_REDIRECT_URI: string;

  @IsString()
  MICROSOFT_CLIENT_ID: string;

  @IsString()
  MICROSOFT_CLIENT_SECRET: string;

  @IsString()
  MICROSOFT_REDIRECT_URI: string;

  @IsString()
  ENCRYPTION_KEY: string;
}

export async function validate(config: Record<string, any>) {
  const validatedConfig = plainToInstance(
    EnvironmentVariables,
    config,
    { enableImplicitConversion: true },
  );
  
  const errors = await validate(validatedConfig);
  
  if (errors.length > 0) {
    throw new Error(`Validation failed:\n${errors.toString()}`);
  }
  
  return validatedConfig;
}
```

**Usage in app.module.ts:**
```typescript
import { validate } from './config/validate';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validate,
    }),
    // ...
  ],
})
export class AppModule {}
```

---

#### Step 3.2: Add Request Logging & Audit Trail

**File:** `fliptracker/apps/backend/src/common/interceptors/audit.interceptor.ts`

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        console.log(
          `[AUDIT] ${method} ${url} | User: ${user?.uid || 'anonymous'} | Status: ${context.switchToHttp().getResponse().statusCode} | Duration: ${duration}ms`,
        );
      }),
    );
  }
}
```

---

#### Step 3.3: Implement Rate Limiting & DDoS Protection

**Already implemented:** `@nestjs/throttler` in `auth.module.ts` ✅

**Verify in all modules:**
```typescript
import { ThrottlerModule } from '@nestjs/throttler';

// Already configured with:
// - 10 requests per 60 seconds (short)
// - 100 requests per 3600 seconds (long)
```

---

## Files to Create/Modify

### Create Files

1. **`fliptracker/.env.example`** - Environment template
2. **`fliptracker/firestore.rules`** - Firestore security rules
3. **`fliptracker/apps/backend/src/config/validate.ts`** - Env validation
4. **`fliptracker/SECURITY.md`** - Security guidelines for developers

### Modify Files

1. **`.gitignore`** - Add sensitive files
2. **`fliptracker/apps/backend/src/.env`** - Remove from git
3. **`fliptracker/apps/backend/src/modules/parcels/parcels.controller.ts`** - Add ownership checks
4. **`fliptracker/apps/backend/src/modules/connected-emails/connected-emails.controller.ts`** - Add ownership checks
5. **`fliptracker/apps/backend/src/app.module.ts`** - Add config validation
6. **`fliptracker/package.json`** - Add security audit script

### Delete Files

1. **`fliptracker/apps/frontend/services/geminiService.ts`** - Dead code, exposes API key

---

## Implementation Timeline

| Phase | Task | Timeline | Priority |
|-------|------|----------|----------|
| 1 | Revoke Firebase credentials | 24 hrs | 🔴 CRITICAL |
| 1 | Remove secrets from git | 24 hrs | 🔴 CRITICAL |
| 1 | Add .gitignore | 24 hrs | 🔴 CRITICAL |
| 2 | Add ownership validations | 3 days | 🔴 CRITICAL |
| 2 | Deploy Firestore rules | 3 days | 🔴 CRITICAL |
| 2 | Delete dead code | 1 day | 🟡 HIGH |
| 3 | Env validation | 1 week | 🟡 HIGH |
| 3 | Audit logging | 1 week | 🟡 HIGH |

---

## Security Checklist

### Before Going Live

- [ ] All Firebase credentials rotated
- [ ] All secrets removed from git history
- [ ] .gitignore properly configured
- [ ] All API endpoints verify data ownership
- [ ] Firestore security rules deployed and tested
- [ ] No browser-accessible database credentials
- [ ] Dead code (geminiService.ts) removed
- [ ] Environment variables validated at startup
- [ ] Rate limiting configured
- [ ] Audit logging implemented
- [ ] Security documentation created

### Ongoing

- [ ] Weekly security audit of API endpoints
- [ ] Monthly rotation of API keys
- [ ] Quarterly penetration testing
- [ ] Dependency security scanning (npm audit, snyk)
- [ ] Code review checklist includes security checks

---

## References

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [Firebase Security Best Practices](https://firebase.google.com/docs/firestore/security/start)
- [NestJS Security Documentation](https://docs.nestjs.com/security/overview)
- [CWE-798: Use of Hard-Coded Credentials](https://cwe.mitre.org/data/definitions/798.html)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

## Questions & Support

For security concerns:
1. Create a private security issue
2. Do NOT discuss in public PRs
3. Use security advisories for critical issues
4. Contact: [your-security-contact]

---

**Status:** Ready for Implementation  
**Last Updated:** January 28, 2026  
**Next Review:** February 4, 2026
