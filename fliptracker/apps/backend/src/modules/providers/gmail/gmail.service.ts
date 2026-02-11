import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, gmail_v1 } from 'googleapis';

export interface GmailTokens {
  access_token: string | null;
  refresh_token: string | null;
  expiry_date: number | null;
}

export interface GmailProfile {
  emailAddress: string;
}

export interface NormalizedEmail {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: Date;
  body: string;
  snippet: string;
}

@Injectable()
export class GmailService {
  private oauth2Client;

  constructor(private configService: ConfigService) {
    this.oauth2Client = new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      // Use separate redirect URI for email connections, fallback to auth redirect URI
      this.configService.get('GOOGLE_EMAIL_REDIRECT_URI') || this.configService.get('GOOGLE_REDIRECT_URI'),
    );
  }

  getAuthUrl(state: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.readonly', 'email', 'profile'],
      state,
      prompt: 'consent',
    });
  }

  async exchangeCode(code: string): Promise<GmailTokens> {
    console.log('[GmailService] Starting token exchange with code:', code.substring(0, 10) + '...');
    const { tokens } = await this.oauth2Client.getToken(code);
    console.log('[GmailService] Token response:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date,
    });
    const result = {
      access_token: tokens.access_token || null,
      refresh_token: tokens.refresh_token || null,
      expiry_date: tokens.expiry_date || null,
    };
    console.log('[GmailService] Returning tokens:', result);
    return result;
  }

  async refreshAccessToken(refreshToken: string): Promise<GmailTokens> {
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    return {
      access_token: credentials.access_token || null,
      refresh_token: credentials.refresh_token || refreshToken,
      expiry_date: credentials.expiry_date || null,
    };
  }

  async getUserProfile(accessToken: string): Promise<GmailProfile> {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    return { emailAddress: profile.data.emailAddress! };
  }

  async fetchRecentEmails(accessToken: string, maxResults = 50): Promise<NormalizedEmail[]> {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: 'from:vinted OR from:vintedgo OR from:chronopost OR from:colissimo OR from:mondialrelay OR from:notif-colissimo-laposte OR from:notif-laposte.info OR from:dhl OR from:ups OR from:fedex OR from:dpd OR from:gls OR from:relaiscolis OR from:sheinnotice OR from:orders.temu.com OR from:gofoexpress OR from:cirroparcel OR from:pickup.fr OR from:showroomprive OR from:redcare-pharmacie OR subject:(colis OR livraison OR tracking OR shipping OR delivered OR retrait OR suivi OR expédition OR récupérer OR chronopost OR colissimo OR mondial OR vinted OR livré OR bordereau OR étiquette)',
    });

    const messages = response.data.messages || [];
    const emails: NormalizedEmail[] = [];

    for (const message of messages) {
      const email = await this.getEmailDetails(gmail, message.id!);
      if (email) {
        emails.push(email);
      }
    }

    return emails;
  }

  async startWatch(accessToken: string, topicName: string): Promise<{ historyId?: string; expiration?: string }> {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
      },
    });

    return {
      historyId: response.data.historyId ?? undefined,
      expiration: response.data.expiration ?? undefined,
    };
  }

  private async getEmailDetails(gmail: gmail_v1.Gmail, messageId: string): Promise<NormalizedEmail | null> {
    try {
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const headers = response.data.payload?.headers || [];
      const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      const body = this.extractBody(response.data.payload);

      return {
        id: response.data.id!,
        threadId: response.data.threadId!,
        from: getHeader('from'),
        subject: getHeader('subject'),
        date: new Date(parseInt(response.data.internalDate!) || Date.now()),
        body,
        snippet: response.data.snippet || '',
      };
    } catch (error) {
      console.error('Failed to fetch email details:', error);
      return null;
    }
  }

  private extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
    if (!payload) return '';

    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    if (payload.parts) {
      // Prefer HTML — carrier emails have richer address/tracking structure in HTML.
      // All parsers already handle HTML (strip tags as needed).
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
      for (const part of payload.parts) {
        const nested = this.extractBody(part);
        if (nested) return nested;
      }
    }

    return '';
  }
}
