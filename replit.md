# Fliptracker - SaaS Email Parcel Tracking

## Overview
Fliptracker is a SaaS MVP that automatically detects and tracks parcels from connected email accounts. It analyzes emails from Gmail and Outlook to extract shipping information and tracking numbers.

## Tech Stack
- **Frontend**: React + Vite + TypeScript (port 5000)
- **Backend**: NestJS + TypeScript (port 3001)
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Email Providers**: Gmail API, Microsoft Graph API

## Project Structure
```
fliptracker/
├── apps/
│   ├── frontend/          # React Vite frontend
│   └── backend/           # NestJS backend
│       └── src/
│           ├── domain/           # Entities & repository interfaces
│           ├── infrastructure/   # Firestore repositories, encryption
│           └── modules/          # NestJS modules
│               ├── auth/           # Firebase Auth guard
│               ├── users/          # User management
│               ├── connected-emails/  # OAuth email connections
│               ├── parcels/        # Parcel CRUD with filters
│               ├── providers/      # Gmail & Outlook services
│               └── email-analysis/ # Tracking number extraction
├── packages/              # Shared packages
└── plugins/               # Plugins
```

## Backend Architecture (Clean Architecture)

### Domain Layer
- **Entities**: User, ConnectedEmail, Parcel
- **Repository Interfaces**: Abstraction for database operations

### Infrastructure Layer
- **Firestore Repositories**: Concrete implementations
- **Encryption Service**: AES-256-GCM for token encryption

### Application Layer (Modules)
- **AuthModule**: Firebase JWT validation, AuthGuard
- **UsersModule**: User CRUD, find-or-create
- **ConnectedEmailsModule**: OAuth flows, token management
- **ProvidersModule**: Gmail & Outlook API integration
- **EmailAnalysisModule**: Tracking extraction with regex patterns
- **ParcelsModule**: Full CRUD with filtering/pagination

## API Endpoints

### Authentication
All endpoints require `Authorization: Bearer <firebase_token>`

### Users
- `GET /api/users/me` - Get current user

### Connected Emails
- `GET /api/emails` - List connected email accounts
- `POST /api/emails/connect/:provider/start` - Start OAuth flow
- `POST /api/emails/connect/:provider/callback` - OAuth callback
- `DELETE /api/emails/:id` - Disconnect email
- `POST /api/emails/:id/reconnect` - Reconnect expired token

### Parcels
- `GET /api/parcels` - List with filters (type, status, provider, date range, search, pagination)
- `GET /api/parcels/:id` - Get single parcel
- `POST /api/parcels` - Create parcel
- `PATCH /api/parcels/:id` - Update parcel
- `DELETE /api/parcels/:id` - Delete parcel

## Supported Carriers
- UPS, FedEx, USPS, DHL, La Poste, Colissimo, Chronopost

## Environment Variables Required
```
# Firebase Admin SDK
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Google OAuth (Gmail)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Microsoft OAuth (Outlook)
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=
MICROSOFT_TENANT_ID=common

# Security
ENCRYPTION_KEY=

# Frontend
FRONTEND_URL=
```

## Development Commands
```bash
# Run frontend only
cd fliptracker && pnpm dev:frontend

# Run backend only
cd fliptracker && pnpm dev:backend

# Run both
cd fliptracker && pnpm dev
```

## Recent Changes
- 2026-01-25: Implemented complete NestJS backend with clean architecture
  - Firebase Auth integration
  - Gmail and Outlook OAuth providers
  - Email analysis with tracking number extraction
  - Firestore repositories with encryption
  - Full CRUD APIs for parcels with filtering
