import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@microsoft/microsoft-graph-client';

export interface OutlookTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}

export interface OutlookProfile {
  mail: string;
  userPrincipalName: string;
}

export interface OutlookSubscription {
  id: string;
  expirationDateTime: string;
  resource: string;
  clientState?: string;
}

export interface NormalizedEmail {
  id: string;
  conversationId: string;
  from: string;
  subject: string;
  date: Date;
  body: string;
  snippet: string;
}

@Injectable()
export class OutlookService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private tenantId: string;

  constructor(private configService: ConfigService) {
    this.clientId = this.configService.get('MICROSOFT_CLIENT_ID') || '';
    this.clientSecret = this.configService.get('MICROSOFT_CLIENT_SECRET') || '';
    this.redirectUri = this.configService.get('MICROSOFT_REDIRECT_URI') || '';
    this.tenantId = this.configService.get('MICROSOFT_TENANT_ID') || 'common';
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: 'openid profile email Mail.Read offline_access',
      state,
      response_mode: 'query',
    });

    return `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize?${params}`;
  }

  async exchangeCode(code: string): Promise<OutlookTokens> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      },
    );

    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      expiresIn: data.expires_in,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OutlookTokens> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      },
    );

    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in,
    };
  }

  async getUserProfile(accessToken: string): Promise<OutlookProfile> {
    const client = this.getGraphClient(accessToken);
    const user = await client.api('/me').get();
    return {
      mail: user.mail,
      userPrincipalName: user.userPrincipalName,
    };
  }

  async fetchRecentEmails(accessToken: string, maxResults = 50): Promise<NormalizedEmail[]> {
    const client = this.getGraphClient(accessToken);

    const response = await client
      .api('/me/messages')
      .filter("contains(subject,'shipping') or contains(subject,'tracking') or contains(subject,'delivered') or contains(subject,'order')")
      .top(maxResults)
      .select('id,conversationId,from,subject,receivedDateTime,body,bodyPreview')
      .get();

    return (response.value || []).map((message: any) => ({
      id: message.id,
      conversationId: message.conversationId,
      from: message.from?.emailAddress?.address || '',
      subject: message.subject || '',
      date: new Date(message.receivedDateTime),
      body: message.body?.content || '',
      snippet: message.bodyPreview || '',
    }));
  }

  async createSubscription(
    accessToken: string,
    notificationUrl: string,
    clientState: string,
  ): Promise<OutlookSubscription> {
    const expirationDateTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

    const response = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        changeType: 'created',
        notificationUrl,
        resource: '/me/messages',
        expirationDateTime,
        clientState,
        latestSupportedTlsVersion: 'v1_2',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Outlook subscription failed: ${data?.error?.message || response.statusText}`);
    }

    return {
      id: data.id,
      expirationDateTime: data.expirationDateTime,
      resource: data.resource,
      clientState: data.clientState,
    };
  }

  private getGraphClient(accessToken: string): Client {
    return Client.init({
      authProvider: (done) => done(null, accessToken),
    });
  }
}
