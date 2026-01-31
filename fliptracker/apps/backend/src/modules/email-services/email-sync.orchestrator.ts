import { Injectable, Inject } from '@nestjs/common';
import { EmailFetchService } from './email-fetch.service';
import { EmailParsingService } from './email-parsing.service';
import { EmailTrackingDetectorService } from './email-tracking-detector.service';
import { ParsedEmailToParcelService } from './parsed-email-to-parcel.service';
import { ConnectedEmailsService } from '../connected-emails/connected-emails.service';
import { UsersService } from '../users/users.service';
import {
  RAW_EMAIL_REPOSITORY,
  PARSED_EMAIL_REPOSITORY,
  EMAIL_SYNC_EVENT_REPOSITORY,
  IRawEmailRepository,
  IParsedEmailRepository,
  IEmailSyncEventRepository,
} from '../../domain/repositories/email-sync.repository';
import { RawEmail, ParsedEmail } from '../../domain/entities/email-sync.entity';

@Injectable()
export class EmailSyncOrchestrator {
  private readonly INITIAL_SYNC_LIMIT = 100; // Premier sync: 100 emails
  private readonly MAINTENANCE_SYNC_LIMIT = 20; // Syncs suivants: 20 emails

  constructor(
    private fetchService: EmailFetchService,
    private parsingService: EmailParsingService,
    private trackingDetector: EmailTrackingDetectorService,
    private parsedEmailToParcelService: ParsedEmailToParcelService,
    private connectedEmailsService: ConnectedEmailsService,
    private usersService: UsersService,
    @Inject(RAW_EMAIL_REPOSITORY)
    private rawEmailRepository: IRawEmailRepository,
    @Inject(PARSED_EMAIL_REPOSITORY)
    private parsedEmailRepository: IParsedEmailRepository,
    @Inject(EMAIL_SYNC_EVENT_REPOSITORY)
    private emailSyncEventRepository: IEmailSyncEventRepository,
  ) {}

  /**
   * Main sync orchestration
   * Called directly (MVP) or via queue (future)
   */
  async syncEmailsForUser(userId: string): Promise<void> {
    const syncId = this.generateId();
    console.log(`[EmailSyncOrchestrator] Starting sync ${syncId} for user ${userId}`);

    try {
      // 1. Mark user as syncing
      await this.usersService.update(userId, {
        emailSyncStatus: 'syncing',
        emailSyncStartedAt: new Date(),
      });
      await this.logEvent(syncId, userId, 'SYNC_STARTED', 'completed');

      // 2. Get all connected emails
      const connectedEmails = await this.connectedEmailsService.findByUserId(userId);
      if (connectedEmails.length === 0) {
        console.log(`[EmailSyncOrchestrator] No connected emails for user ${userId}`);
        await this.usersService.update(userId, { emailSyncStatus: 'idle' });
        return;
      }

      let totalEmailsFetched = 0;
      let totalEmailsParsed = 0;
      let totalTrackingEmails = 0;

      // 3. For each connected email account
      for (const connectedEmail of connectedEmails) {
        console.log(
          `[EmailSyncOrchestrator] Syncing ${connectedEmail.provider} account: ${connectedEmail.emailAddress}`,
        );

        try {
          // Decide fetch limit based on whether initial sync was done
          const limit = connectedEmail.initialSyncCompleted
            ? this.MAINTENANCE_SYNC_LIMIT
            : this.INITIAL_SYNC_LIMIT;

          console.log(
            `[EmailSyncOrchestrator] Fetching ${limit} emails (initialSync: ${!connectedEmail.initialSyncCompleted})`,
          );

          // STEP 1: FETCH
          const fetchedEmails = await this.fetchService.fetchEmails(connectedEmail, limit);
          totalEmailsFetched += fetchedEmails.length;
          console.log(
            `[EmailSyncOrchestrator] Fetched ${fetchedEmails.length} emails from ${connectedEmail.emailAddress}`,
          );

          // STEP 2: SAVE RAW EMAILS + CHECK FOR DUPLICATES
          const savedRawEmails: (RawEmail & { fetched: typeof fetchedEmails[0] })[] = [];

          for (const fetchedEmail of fetchedEmails) {
            try {
              // Check if already exists
              const existing = await this.rawEmailRepository.findByMessageId(
                userId,
                fetchedEmail.messageId,
              );

              let rawEmail: RawEmail;
              if (existing) {
                console.log(
                  `[EmailSyncOrchestrator] Duplicate email found: ${fetchedEmail.messageId}`,
                );
                rawEmail = existing;
              } else {
                // Save new raw email
                rawEmail = await this.rawEmailRepository.create({
                  userId,
                  provider: connectedEmail.provider,
                  messageId: fetchedEmail.messageId,
                  subject: fetchedEmail.subject,
                  from: fetchedEmail.from,
                  receivedAt: fetchedEmail.receivedAt,
                  rawBody: fetchedEmail.body,
                  status: 'fetched',
                });
              }

              savedRawEmails.push({ ...rawEmail, fetched: fetchedEmail });
            } catch (saveError) {
              console.error('[EmailSyncOrchestrator] Failed to save raw email:', saveError);
            }
          }

          await this.logEvent(syncId, userId, 'EMAILS_FETCHED', 'completed', {
            totalEmails: fetchedEmails.length,
          });

          // STEP 3: PARSE EMAILS + EXTRACT TRACKING
          for (const rawEmailData of savedRawEmails) {
            try {
              // On INITIAL sync: parse tous les emails
              // On MAINTENANCE: parser seulement si c'est du tracking
              const shouldParse =
                !connectedEmail.initialSyncCompleted ||
                this.trackingDetector.isTrackingEmail(rawEmailData.fetched);

              if (!shouldParse) {
                console.log(
                  `[EmailSyncOrchestrator] Skipping non-tracking email from ${rawEmailData.from}`,
                );
                continue;
              }

              // Parse email
              const parsed = await this.parsingService.parseEmail(rawEmailData.fetched);

              if (!parsed.trackingNumber) {
                console.log(
                  `[EmailSyncOrchestrator] No tracking found in email from ${rawEmailData.from}`,
                );
                continue;
              }

              totalTrackingEmails++;
              console.log(
                `[EmailSyncOrchestrator] Tracking found: ${parsed.trackingNumber} (${parsed.carrier})`,
              );

              // STEP 4: UPSERT PARSED EMAIL (check if tracking already exists)
              let parsedEmail = await this.parsedEmailRepository.findByTrackingNumber(
                userId,
                parsed.trackingNumber,
              );

              if (parsedEmail) {
                console.log(
                  `[EmailSyncOrchestrator] Tracking already exists: ${parsed.trackingNumber}, updating...`,
                );
                // Update with new info (QR, withdrawal code, etc.)
                parsedEmail = await this.parsedEmailRepository.update(parsedEmail.id, {
                  ...parsed,
                  status: 'pending_shipment_lookup',
                });
              } else {
                // Create new
                parsedEmail = await this.parsedEmailRepository.create({
                  rawEmailId: rawEmailData.id,
                  userId,
                  ...parsed,
                  status: 'pending_shipment_lookup',
                });
                totalEmailsParsed++;
              }

              console.log(
                `[EmailSyncOrchestrator] Parsed email: ${parsed.trackingNumber} | QR: ${parsed.qrCode || 'N/A'} | Withdrawal: ${parsed.withdrawalCode || 'N/A'}`,
              );

              // STEP 4.5: CREATE PARCEL FROM PARSED EMAIL
              try {
                await this.parsedEmailToParcelService.createParcelFromParsedEmail(parsedEmail);
              } catch (parcelError) {
                console.warn(
                  `[EmailSyncOrchestrator] Failed to create parcel for ${parsed.trackingNumber}:`,
                  parcelError,
                );
              }
            } catch (parseError) {
              console.warn('[EmailSyncOrchestrator] Failed to parse email:', parseError);
            }
          }

          await this.logEvent(syncId, userId, 'EMAIL_PARSED', 'completed', {
            parsedEmails: totalEmailsParsed,
            trackingEmails: totalTrackingEmails,
          });

          // STEP 5: MARK INITIAL SYNC AS COMPLETED
          if (!connectedEmail.initialSyncCompleted) {
            await this.connectedEmailsService.update(connectedEmail.id, {
              initialSyncCompleted: true,
              initialSyncCompletedAt: new Date(),
            });
            console.log(
              `[EmailSyncOrchestrator] Marked initial sync as completed for ${connectedEmail.emailAddress}`,
            );
          }
        } catch (accountError) {
          console.error(
            `[EmailSyncOrchestrator] Failed to sync ${connectedEmail.provider} account:`,
            accountError,
          );
        }
      }

      // 6. Mark sync as complete
      await this.usersService.update(userId, {
        emailSyncStatus: 'idle',
        emailSyncLastFinishedAt: new Date(),
      });

      await this.logEvent(syncId, userId, 'SYNC_COMPLETED', 'completed', {
        totalEmails: totalEmailsFetched,
        parsedEmails: totalEmailsParsed,
        trackingEmails: totalTrackingEmails,
      });

      console.log(`[EmailSyncOrchestrator] Sync ${syncId} completed successfully`);
    } catch (error) {
      console.error(`[EmailSyncOrchestrator] Sync ${syncId} failed:`, error);
      await this.usersService.update(userId, {
        emailSyncStatus: 'error',
        emailSyncLastError: error.message,
      });
      await this.logEvent(syncId, userId, 'SYNC_FAILED', 'failed', {
        error: error.message,
      });
    }
  }

  private async logEvent(
    syncId: string,
    userId: string,
    eventType: 'SYNC_STARTED' | 'EMAILS_FETCHED' | 'EMAIL_PARSED' | 'SYNC_COMPLETED' | 'SYNC_FAILED',
    status: 'completed' | 'failed',
    data?: any,
  ): Promise<void> {
    try {
      await this.emailSyncEventRepository.create({
        syncId,
        userId,
        eventType,
        status,
        data,
      });
    } catch (error) {
      console.warn('[EmailSyncOrchestrator] Failed to log event:', error);
    }
  }

  private generateId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}
