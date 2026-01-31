import { Controller, Get, Post, Delete, Param, Query, UseGuards, Req, Res, SetMetadata, Inject } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { ConnectedEmailsService } from './connected-emails.service';
import { AuthGuard, AuthenticatedRequest } from '../auth/auth.guard';
import { FirebaseService } from '../auth/firebase.service';
import { GmailService } from '../providers/gmail/gmail.service';
import { OutlookService } from '../providers/outlook/outlook.service';
import { EmailSyncOrchestrator } from '../email-services/email-sync.orchestrator';
import { ConnectedEmail } from '../../domain/entities';
import {
  RAW_EMAIL_REPOSITORY,
  PARSED_EMAIL_REPOSITORY,
  EMAIL_SYNC_EVENT_REPOSITORY,
  IRawEmailRepository,
  IParsedEmailRepository,
  IEmailSyncEventRepository,
} from '../../domain/repositories/email-sync.repository';

export const SkipAuth = () => SetMetadata('skipAuth', true);

@Controller('emails')
export class ConnectedEmailsController {
  constructor(
    private connectedEmailsService: ConnectedEmailsService,
    private firebaseService: FirebaseService,
    private gmailService: GmailService,
    private outlookService: OutlookService,
    private emailSyncOrchestrator: EmailSyncOrchestrator,
    @Inject(RAW_EMAIL_REPOSITORY)
    private rawEmailRepository: IRawEmailRepository,
    @Inject(PARSED_EMAIL_REPOSITORY)
    private parsedEmailRepository: IParsedEmailRepository,
    @Inject(EMAIL_SYNC_EVENT_REPOSITORY)
    private emailSyncEventRepository: IEmailSyncEventRepository,
  ) {}

  @Get()
  @UseGuards(AuthGuard)
  async getConnectedEmails(@Req() req: AuthenticatedRequest) {
    console.log('[getConnectedEmails] Called with userId:', req.user?.uid);
    try {
      const emails = await this.connectedEmailsService.findByUserId(req.user.uid);
      console.log('[getConnectedEmails] Found', emails.length, 'emails for userId:', req.user.uid);
      return { emails };
    } catch (error) {
      console.error('Failed to fetch connected emails:', error?.message || error);
      return { emails: [] };
    }
  }

  @Get('debug/all')
  @SkipAuth()
  async debugGetAllEmails() {
    console.log('[DEBUG] Returning all in-memory emails (no auth)');
    let firestoreStatus = 'ok';
    let firestoreError: { message?: string; code?: string | number } | null = null;

    try {
      await this.firebaseService.getFirestore().collection('_health').limit(1).get();
    } catch (error) {
      firestoreStatus = 'error';
      firestoreError = {
        message: error?.message || String(error),
        code: error?.code,
      };
    }

    return {
      message: 'Debug endpoint',
      timestamp: new Date().toISOString(),
      firebase: {
        initialized: this.firebaseService.isInitialized(),
        projectId: this.firebaseService.getProjectId(),
        configuredProjectId: this.firebaseService.getConfiguredProjectId(),
        clientEmail: this.firebaseService.getClientEmail(),
        clientEmailProjectId: this.firebaseService.getClientEmailProjectId(),
        configuredDatabaseId: this.firebaseService.getConfiguredDatabaseId(),
        firestoreStatus,
        firestoreError,
      },
    };
  }

  @Get('summary')
  @UseGuards(AuthGuard)
  async getEmailSummary(@Req() req: AuthenticatedRequest) {
    let emails: ConnectedEmail[] = [];
    let parsedEmails: any[] = [];
    let rawEmailsCount = 0;
    let lastSyncAt: Date | null = null;

    try {
      emails = await this.connectedEmailsService.findByUserId(req.user.uid);
      
      // Get parsed emails
      parsedEmails = await this.parsedEmailRepository.findByUserId(req.user.uid);
      
      // Get raw emails count
      const rawEmails = await this.rawEmailRepository.findByUserId(req.user.uid);
      rawEmailsCount = rawEmails.length;
      
      // Get last sync time from user
      const user = await this.connectedEmailsService.usersService.findById(req.user.uid);
      lastSyncAt = user?.emailSyncLastFinishedAt || null;
    } catch (error) {
      console.warn('Email summary fallback:', error?.message || error);
    }

    const totalConnections = emails.length;
    const connected = emails.filter((e: ConnectedEmail) => e.status === 'active').length;
    const expired = emails.filter((e: ConnectedEmail) => e.status === 'expired').length;
    const errorCount = emails.filter((e: ConnectedEmail) => e.status === 'revoked').length;

    // Format recent parsed emails for frontend
    const recentParsed = parsedEmails
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(email => ({
        id: email.id,
        subject: `Tracking: ${email.trackingNumber || 'N/A'}`,
        from: email.marketplace || 'Unknown',
        trackingNumber: email.trackingNumber,
        carrier: email.carrier,
        qrCode: email.qrCode,
        withdrawalCode: email.withdrawalCode,
        articleId: email.articleId,
        status: email.status,
        parsedAt: email.createdAt,
      }));

    return {
      stats: {
        totalConnections,
        connected,
        expired,
        error: errorCount,
        emailsAnalyzed: rawEmailsCount,
        lastSyncAt,
      },
      recentParsed,
      logs: [],
    };
  }

  @Post('sync')
  @UseGuards(AuthGuard)
  async manualSync(@Req() req: AuthenticatedRequest) {
    const userId = req.user.uid;
    
    // Return immediately (async background processing)
    this.emailSyncOrchestrator.syncEmailsForUser(userId).catch((err) => {
      console.error('[ConnectedEmailsController] Background sync failed:', err);
    });

    return {
      success: true,
      queuedAt: new Date().toISOString(),
    };
  }

  @Get('sync/status')
  @UseGuards(AuthGuard)
  async getSyncStatus(@Req() req: AuthenticatedRequest) {
    const user = await this.connectedEmailsService.usersService.findById(req.user.uid);
    return {
      status: user?.emailSyncStatus || 'idle',
      startedAt: user?.emailSyncStartedAt,
      finishedAt: user?.emailSyncLastFinishedAt,
      error: user?.emailSyncLastError,
      lastUpdate: new Date().toISOString(),
    };
  }

  @Get('parsed')
  @UseGuards(AuthGuard)
  async getParsedEmails(@Req() req: AuthenticatedRequest) {
    try {
      const parsedEmails = await this.parsedEmailRepository.findByUserId(req.user.uid);
      return {
        success: true,
        emails: parsedEmails,
        total: parsedEmails.length,
      };
    } catch (error) {
      console.error('[getParsedEmails] Error:', error);
      return {
        success: false,
        emails: [],
        total: 0,
        error: error.message,
      };
    }
  }

  @Get('raw')
  @UseGuards(AuthGuard)
  async getRawEmails(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
  ) {
    try {
      let rawEmails = await this.rawEmailRepository.findByUserId(req.user.uid);
      
      // Apply limit if provided
      if (limit) {
        const limitNum = parseInt(limit, 10);
        rawEmails = rawEmails.slice(0, limitNum);
      }
      
      return {
        success: true,
        emails: rawEmails,
        total: rawEmails.length,
      };
    } catch (error) {
      console.error('[getRawEmails] Error:', error);
      return {
        success: false,
        emails: [],
        total: 0,
        error: error.message,
      };
    }
  }

  @Get('sync/events')
  @UseGuards(AuthGuard)
  async getSyncEvents(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
  ) {
    try {
      let events = await this.emailSyncEventRepository.findByUserId(req.user.uid);
      
      // Apply limit if provided
      if (limit) {
        const limitNum = parseInt(limit, 10);
        events = events.slice(0, limitNum);
      }
      
      return {
        success: true,
        events,
        total: events.length,
      };
    } catch (error) {
      console.error('[getSyncEvents] Error:', error);
      return {
        success: false,
        events: [],
        total: 0,
        error: error.message,
      };
    }
  }

  @Post('connect/:provider/start')
  @UseGuards(AuthGuard)
  async startOAuthFlow(
    @Param('provider') provider: 'gmail' | 'outlook',
    @Req() req: AuthenticatedRequest,
  ) {
    const state = Buffer.from(JSON.stringify({ userId: req.user.uid })).toString('base64');
    
    if (provider === 'gmail') {
      const authUrl = this.gmailService.getAuthUrl(state);
      return { authUrl };
    } else if (provider === 'outlook') {
      const authUrl = this.outlookService.getAuthUrl(state);
      return { authUrl };
    }

    return { error: 'Invalid provider' };
  }

  @Get('connect/:provider/callback')
  @Post('connect/:provider/callback')
  @UseGuards(AuthGuard)
  @SkipAuth()
  async handleOAuthCallback(
    @Param('provider') provider: 'gmail' | 'outlook',
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    console.log('[OAuth Callback] Received:', { provider, hasCode: !!code, stateLength: state?.length });
    try {
      if (!state) {
        throw new Error('Missing state parameter');
      }
      
      if (!code) {
        throw new Error('Missing authorization code');
      }

      let userId: string;
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
        userId = decoded.userId;
        console.log('[OAuth Callback] Decoded state for userId:', userId);
      } catch (parseError) {
        console.error('[OAuth Callback] Failed to parse state:', state, parseError);
        throw new Error('Invalid state parameter - OAuth flow must be started through /api/emails/connect/:provider/start');
      }

      if (!userId) {
        throw new Error('Missing userId in state parameter');
      }

      if (provider === 'gmail') {
        console.log('[Gmail OAuth] Exchanging code for tokens...');
        const tokens = await this.gmailService.exchangeCode(code);
        console.log('[Gmail OAuth] Got tokens, fetching profile...');
        const profile = await this.gmailService.getUserProfile(tokens.access_token!);
        console.log('[Gmail OAuth] Profile fetched:', { email: profile.emailAddress });
        
        console.log('[Gmail OAuth] Attempting to save connection for:', profile.emailAddress);
        const savedEmail = await this.connectedEmailsService.connect(
          userId,
          'gmail',
          profile.emailAddress,
          tokens.access_token!,
          tokens.refresh_token!,
          new Date(Date.now() + (tokens.expiry_date || 3600000)),
        );
        console.log('[Gmail OAuth] Successfully saved connection with ID:', savedEmail.id);
      } else if (provider === 'outlook') {
        console.log('[Outlook OAuth] Exchanging code for tokens...');
        const tokens = await this.outlookService.exchangeCode(code);
        console.log('[Outlook OAuth] Got tokens, fetching profile...');
        const profile = await this.outlookService.getUserProfile(tokens.accessToken);
        console.log('[Outlook OAuth] Profile fetched:', { email: profile.mail || profile.userPrincipalName });
        
        console.log('[Outlook OAuth] Attempting to save connection for:', profile.mail || profile.userPrincipalName);
        const savedEmail = await this.connectedEmailsService.connect(
          userId,
          'outlook',
          profile.mail || profile.userPrincipalName,
          tokens.accessToken,
          tokens.refreshToken!,
          new Date(Date.now() + tokens.expiresIn * 1000),
        );
        console.log('[Outlook OAuth] Successfully saved connection with ID:', savedEmail.id);
      }

      // Redirect to frontend with success
      console.log(`[OAuth Callback] Successfully connected ${provider} account for user ${userId}`);
      const frontendUrl = process.env.FRONTEND_URL || 'https://fliptracker-gemini.onrender.com';
      return res.redirect(`${frontendUrl}/?success=true&provider=${provider}`);
    } catch (error) {
      console.error('[OAuth Callback] ERROR:', {
        message: error.message,
        code: error.code,
        status: error.status,
        provider,
        stack: error.stack,
      });
      const frontendUrl = process.env.FRONTEND_URL || 'https://fliptracker-gemini.onrender.com';
      return res.redirect(`${frontendUrl}/?success=false&error=${encodeURIComponent(error.message)}`);
    }
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async disconnectEmail(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const email = await this.connectedEmailsService.findById(id);
    if (!email || email.userId !== req.user.uid) {
      return { error: 'Email connection not found' };
    }
    
    await this.connectedEmailsService.disconnect(id);
    return { success: true };
  }

  @Post(':id/reconnect')
  @UseGuards(AuthGuard)
  async reconnectEmail(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const email = await this.connectedEmailsService.findById(id);
    if (!email || email.userId !== req.user.uid) {
      return { error: 'Email connection not found' };
    }

    const state = Buffer.from(JSON.stringify({ userId: req.user.uid, reconnectId: id })).toString('base64');
    
      // ✅ SECURITY: Prevent reconnecting other users' emails
      if (email.userId !== req.user.uid) {
        throw new ForbiddenException('Cannot reconnect this email account');
      }
    
    if (email.provider === 'gmail') {
      const authUrl = this.gmailService.getAuthUrl(state);
      return { authUrl };
    } else {
      const authUrl = this.outlookService.getAuthUrl(state);
      return { authUrl };
    }
  }
}
