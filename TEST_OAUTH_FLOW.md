# Testing Gmail OAuth Flow

## Problem Analysis

Your callback URL shows:
```
state=26lcdw
scope=email+profile+https://www.googleapis.com/auth/userinfo.email+https://www.googleapis.com/auth/userinfo.profile+openid
```

**Issues identified:**
1. ✅ State parameter `26lcdw` is NOT base64-encoded JSON (should be like `eyJ1c2VySWQiOiJhYmMxMjMifQ==`)
2. ❌ Missing required scope: `https://www.googleapis.com/auth/gmail.readonly`
3. ❌ This looks like the **user authentication** OAuth flow, not the **email connection** flow

## The Correct Flow

### Step 1: Deploy Backend Changes
The fixes are ready but need to be deployed to Render:

```bash
cd fliptracker
git add .
git commit -m "Fix: Skip auth for OAuth callback endpoint and improve error handling"
git push origin main
```

After pushing, Render will auto-deploy (if configured) or manually trigger deployment.

### Step 2: Verify Environment Variables on Render

Go to your Render dashboard and ensure these environment variables are set:

```env
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_EMAIL_REDIRECT_URI=https://fliptracker-gemini.onrender.com/api/emails/connect/gmail/callback
FRONTEND_URL=https://fliptracker-gemini.onrender.com
```

### Step 3: Update Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to: **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add:
   ```
   https://fliptracker-gemini.onrender.com/api/emails/connect/gmail/callback
   ```
5. Click **Save**

### Step 4: Test the Correct Flow

**DO NOT manually construct Google OAuth URLs!** 

Use the app's proper flow:

1. **Login to your app** at https://fliptracker-gemini.onrender.com
2. Navigate to the **Email Sync** page
3. Click **"Connect Gmail"** button
4. This calls: `POST /api/emails/connect/gmail/start`
5. The backend returns an `authUrl` with:
   - Properly encoded state containing your userId
   - Correct scopes including `gmail.readonly`
6. Frontend redirects you to Google
7. After authorization, Google redirects to the callback with the correct state

### Step 5: Verify Logs

After testing, check Render logs for:

```
OAuth callback received: { provider: 'gmail', hasCode: true, state: '<base64-string>' }
Decoded state for userId: <your-user-id>
Successfully connected gmail account for user <your-user-id>
```

## Quick Test Command

Test the start endpoint (replace `<YOUR_AUTH_TOKEN>` with your Firebase ID token):

```bash
curl -X POST https://fliptracker-gemini.onrender.com/api/emails/connect/gmail/start \
  -H "Authorization: Bearer <YOUR_AUTH_TOKEN>" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.readonly%20email%20profile&state=eyJ1c2VySWQiOiIuLi4ifQ%3D%3D&response_type=code&client_id=...&redirect_uri=https%3A%2F%2Ffliptracker-gemini.onrender.com%2Fapi%2Femails%2Fconnect%2Fgmail%2Fcallback&prompt=consent"
}
```

The authUrl should contain:
- ✅ `scope=...gmail.readonly...`
- ✅ `state=<base64-encoded-json>`
- ✅ `redirect_uri=...%2Fapi%2Femails%2Fconnect%2Fgmail%2Fcallback`

## Common Issues

### Issue 1: Still getting 401
**Cause:** Backend not redeployed with fixes  
**Solution:** Redeploy backend to Render

### Issue 2: "Invalid state parameter" error
**Cause:** Not using the start endpoint, manually testing OAuth  
**Solution:** Always start OAuth through the app UI or `/emails/connect/gmail/start` endpoint

### Issue 3: Missing gmail.readonly scope
**Cause:** Using wrong OAuth URL (auth login vs email connection)  
**Solution:** Use the correct endpoint and don't manually construct OAuth URLs

## Expected Success Flow

1. User clicks "Connect Gmail" in app
2. Backend creates state with userId: `{"userId":"abc123"}`
3. Backend encodes to base64: `eyJ1c2VySWQiOiJhYmMxMjMifQ==`
4. User authorizes on Google
5. Google redirects to: `/api/emails/connect/gmail/callback?code=...&state=eyJ1c2VySWQiOiJhYmMxMjMifQ==`
6. Backend decodes state, exchanges code for tokens
7. Backend saves connection to database
8. Backend redirects to: `https://fliptracker-gemini.onrender.com/email-sync?success=true&provider=gmail`
9. Frontend shows success message

## Need Help?

If you're still seeing issues after deploying:

1. Check Render logs for error details
2. Verify the full callback URL that Google redirects to
3. Test the `/emails/connect/gmail/start` endpoint response
