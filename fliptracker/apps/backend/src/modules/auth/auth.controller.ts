import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  Req,
  Res,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { FirebaseService } from './firebase.service';
import { UsersService } from '../users/users.service';
import { ConnectedEmailsService } from '../connected-emails/connected-emails.service';
import { ParcelsService } from '../parcels/parcels.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly usersService: UsersService,
    private readonly connectedEmailsService: ConnectedEmailsService,
    private readonly parcelsService: ParcelsService,
  ) {}

  @Post('login/google')
  @HttpCode(HttpStatus.OK)
  async loginWithGoogle(@Req() req: any, @Res() res: Response) {
    // Generate Google OAuth URL for frontend to redirect to
    // The idToken will be received at the callback endpoint after user authorizes
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    const state = Math.random().toString(36).substring(7); // Simple state for CSRF protection

    console.log('Login Google endpoint called');
    console.log('GOOGLE_CLIENT_ID:', clientId ? 'SET' : 'NOT SET');
    console.log('GOOGLE_REDIRECT_URI:', redirectUri ? 'SET' : 'NOT SET');

    if (!clientId || !redirectUri) {
      console.error('Google OAuth not configured');
      return res.status(500).json({ error: 'Google OAuth not configured' });
    }

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent('openid email profile')}&` +
      `state=${state}`;

    console.log('Returning Google Auth URL');
    return res.json({ redirectUrl: googleAuthUrl });
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Res() res: Response) {
    res.clearCookie('session');
    return res.send();
  }

  @Get('callback/google')
  async googleCallback(@Query() query: any, @Res() res: Response) {
    // This endpoint receives the authorization code from Google
    const { code, state, error } = query;

    if (error) {
      return res.redirect(`${process.env.FRONTEND_URL}?error=${error}`);
    }

    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    try {
      // Exchange code for ID token using Google OAuth2
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          redirect_uri: process.env.GOOGLE_REDIRECT_URI || '',
          grant_type: 'authorization_code',
        }).toString(),
      });

      const tokens = await tokenResponse.json();
      if (!tokens.id_token) {
        return res.redirect(`${process.env.FRONTEND_URL}?error=no_token`);
      }

      // Exchange Google ID token for Firebase ID token
      const firebaseApiKey = process.env.FIREBASE_API_KEY;
      if (!firebaseApiKey) {
        console.error('FIREBASE_API_KEY not configured');
        return res.redirect(`${process.env.FRONTEND_URL}?error=firebase_api_key_missing`);
      }

      const requestUri = process.env.FRONTEND_URL || 'https://localhost';
      const signInWithIdpResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(firebaseApiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postBody: `id_token=${encodeURIComponent(tokens.id_token)}&providerId=google.com`,
            requestUri,
            returnIdpCredential: true,
            returnSecureToken: true,
          }),
        },
      );

      const firebaseTokens = await signInWithIdpResponse.json();
      if (!firebaseTokens.idToken) {
        console.error('Failed to exchange Google token for Firebase token', firebaseTokens);
        return res.redirect(`${process.env.FRONTEND_URL}?error=firebase_exchange_failed`);
      }

      // Verify the Firebase ID token
      const decodedToken = await this.firebaseService.verifyToken(firebaseTokens.idToken);
      if (!decodedToken) {
        return res.redirect(`${process.env.FRONTEND_URL}?error=invalid_token`);
      }

      const { uid, email, email_verified } = decodedToken as any;

      // Ensure required fields exist
      if (!uid || !email) {
        console.error('Decoded token missing uid or email', { uid, email });
        return res.redirect(`${process.env.FRONTEND_URL}?error=missing_user_info`);
      }

      // TODO: Create or update user in Firestore (after fixing credentials)
      // For now, just authenticate and redirect
      console.log('User authenticated:', { uid, email });

      // Set session cookie (for same-origin deployments)
      res.cookie('session', firebaseTokens.idToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000,
      });

      // Redirect to frontend with token in query param for cross-origin usage
      // Frontend will capture it and store in localStorage
      const frontendUrl = process.env.FRONTEND_URL || '';
      const redirectUrl = `${frontendUrl}?token=${encodeURIComponent(firebaseTokens.idToken)}&authenticated=true`;
      console.log('Redirecting to frontend:', redirectUrl);
      return res.redirect(redirectUrl);
    } catch (err) {
      console.error('Google callback failed:', err);
      return res.redirect(`${process.env.FRONTEND_URL}?error=callback_failed`);
    }
  }

  @Get('token')
  @SkipThrottle()
  async getToken(@Req() req: any) {
    // Get token from session cookie (set during login)
    const sessionToken = req.cookies?.session;
    
    if (!sessionToken) {
      return { token: null };
    }
    
    // Return the session token so frontend can use it as Bearer token
    return { token: sessionToken };
  }

  @Get('me')
  @SkipThrottle()
  @UseGuards(AuthGuard)
  async getMe(@Req() req: AuthenticatedRequest) {
    const { uid, email, emailVerified, provider } = req.user;

    // Return user info from token without querying Firestore
    // TODO: Fetch from Firestore once credentials are fixed
    return {
      id: uid,
      email,
      provider,
      emailVerified,
      createdAt: new Date(),
    };
  }

  @Get('debug')
  async debug(@Req() req: any) {
    // Debug endpoint to check cookies and environment
    return {
      cookies: req.cookies,
      headers: {
        authorization: req.headers.authorization,
        origin: req.headers.origin,
      },
      environment: {
        FRONTEND_URL: process.env.FRONTEND_URL || 'NOT SET',
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET',
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET',
        GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'NOT SET',
        FIREBASE_API_KEY: process.env.FIREBASE_API_KEY ? 'SET' : 'NOT SET',
      },
    };
  }

  @Delete('account')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@Req() req: AuthenticatedRequest) {
    const { uid } = req.user;

    const connectedEmails = await this.connectedEmailsService.findByUserId(uid);
    for (const email of connectedEmails) {
      await this.connectedEmailsService.delete(email.id);
    }

    const parcels = await this.parcelsService.findByUserId(uid, {});
    for (const parcel of parcels.data) {
      await this.parcelsService.delete(parcel.id, uid);
    }

    await this.usersService.delete(uid);

    await this.firebaseService.deleteUser(uid);
  }
}
