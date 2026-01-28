import { Controller, Get, Post, Delete, Param, Query, UseGuards, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { ConnectedEmailsService } from './connected-emails.service';
import { AuthGuard, AuthenticatedRequest } from '../auth/auth.guard';
import { GmailService } from '../providers/gmail/gmail.service';
import { OutlookService } from '../providers/outlook/outlook.service';

@Controller('emails')
@UseGuards(AuthGuard)
export class ConnectedEmailsController {
  constructor(
    private connectedEmailsService: ConnectedEmailsService,
    private gmailService: GmailService,
    private outlookService: OutlookService,
  ) {}

  @Get()
  async getConnectedEmails(@Req() req: AuthenticatedRequest) {
    const emails = await this.connectedEmailsService.findByUserId(req.user.uid);
    return { emails: emails.map(e => ({ ...e, refreshToken: undefined })) };
  }

  @Post('connect/:provider/start')
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

  @Post('connect/:provider/callback')
  async handleOAuthCallback(
    @Param('provider') provider: 'gmail' | 'outlook',
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());

    if (provider === 'gmail') {
      const tokens = await this.gmailService.exchangeCode(code);
      const profile = await this.gmailService.getUserProfile(tokens.access_token!);
      
      await this.connectedEmailsService.connect(
        userId,
        'gmail',
        profile.emailAddress,
        tokens.access_token!,
        tokens.refresh_token!,
        new Date(Date.now() + (tokens.expiry_date || 3600000)),
      );
    } else if (provider === 'outlook') {
      const tokens = await this.outlookService.exchangeCode(code);
      const profile = await this.outlookService.getUserProfile(tokens.accessToken);
      
      await this.connectedEmailsService.connect(
        userId,
        'outlook',
        profile.mail || profile.userPrincipalName,
        tokens.accessToken,
        tokens.refreshToken!,
        new Date(Date.now() + tokens.expiresIn * 1000),
      );
    }

    return { success: true };
  }

  @Delete(':id')
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
  async reconnectEmail(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const email = await this.connectedEmailsService.findById(id);
    if (!email || email.userId !== req.user.uid) {
      return { error: 'Email connection not found' };
    }

    const state = Buffer.from(JSON.stringify({ userId: req.user.uid, reconnectId: id })).toString('base64');
    
    if (email.provider === 'gmail') {
      const authUrl = this.gmailService.getAuthUrl(state);
      return { authUrl };
    } else {
      const authUrl = this.outlookService.getAuthUrl(state);
      return { authUrl };
    }
  }
}
