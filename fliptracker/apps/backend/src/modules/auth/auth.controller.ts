import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  Req,
  Res,
  Body,
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

  private async refreshFirebaseIdToken(refreshToken: string): Promise<{ idToken: string; refreshToken: string } | null> {
    const firebaseApiKey = process.env.FIREBASE_API_KEY;
    if (!firebaseApiKey) {
      console.error('FIREBASE_API_KEY not configured');
      return null;
    }

    const response = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(firebaseApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }).toString(),
      },
    );

    const data = await response.json();
    if (!response.ok || !data?.id_token) {
      console.error('Failed to refresh Firebase token:', data?.error || data);
      return null;
    }

    return {
      idToken: data.id_token,
      refreshToken: data.refresh_token || refreshToken,
    };
  }

  private setSessionCookies(res: Response, idToken: string, refreshToken?: string) {
    res.cookie('session', idToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    if (refreshToken) {
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 365 * 24 * 60 * 60 * 1000,
      });
    }
  }

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
    res.clearCookie('refresh_token');
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

      // Extract Google provider ID (sub claim)
      const googleSub = (decodedToken as any).sub || (decodedToken as any).uid;

      // Create or update user in Firestore with Google provider ID
      await this.usersService.findOrCreate(uid, email, 'google', email_verified, googleSub);
      console.log('User authenticated:', { uid, email, googleSub });

      // Set session + refresh cookies (for same-origin deployments)
      this.setSessionCookies(res, firebaseTokens.idToken, firebaseTokens.refreshToken);

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
  async getToken(@Req() req: any, @Res() res: Response) {
    const sessionToken = req.cookies?.session;
    if (sessionToken) {
      const decoded = await this.firebaseService.verifyToken(sessionToken);
      if (decoded) {
        return res.json({ token: sessionToken });
      }
    }

    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      return res.json({ token: null });
    }

    const refreshed = await this.refreshFirebaseIdToken(refreshToken);
    if (!refreshed) {
      return res.status(401).json({ token: null });
    }

    this.setSessionCookies(res, refreshed.idToken, refreshed.refreshToken);
    return res.json({ token: refreshed.idToken });
  }

  @Post('refresh')
  @SkipThrottle()
  async refreshToken(@Req() req: any, @Res() res: Response, @Body() body: any) {
    const refreshToken = req.cookies?.refresh_token || body?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ token: null });
    }

    const refreshed = await this.refreshFirebaseIdToken(refreshToken);
    if (!refreshed) {
      return res.status(401).json({ token: null });
    }

    this.setSessionCookies(res, refreshed.idToken, refreshed.refreshToken);

    if (body?.refreshToken) {
      return res.json({ token: refreshed.idToken, refreshToken: refreshed.refreshToken });
    }

    return res.json({ token: refreshed.idToken });
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
