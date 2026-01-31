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
    console.log('\n');
    console.log('='.repeat(80));
    console.log(`🔄 EMAIL SYNC STARTED`);
    console.log(`   Sync ID: ${syncId}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log('='.repeat(80));
    console.log('\n');

    try {
      // 1. Mark user as syncing
      console.log('📝 Marking user status as SYNCING...');
      await this.usersService.update(userId, {
        emailSyncStatus: 'syncing',
        emailSyncStartedAt: new Date(),
      });
      await this.logEvent(syncId, userId, 'SYNC_STARTED', 'completed');
      console.log('✅ User status updated');

      // 2. Get all connected emails
      console.log('\n📧 Fetching connected email accounts...');
      const connectedEmails = await this.connectedEmailsService.findByUserId(userId);
      
      if (connectedEmails.length === 0) {
        console.log('⚠️  No connected emails found for this user');
        await this.usersService.update(userId, { emailSyncStatus: 'idle' });
        console.log('🛑 Sync aborted - no email accounts to sync');
        return;
      }
      
      console.log(`✅ Found ${connectedEmails.length} connected email account(s):`);
      connectedEmails.forEach((email, index) => {
        console.log(`   ${index + 1}. ${email.provider.toUpperCase()}: ${email.emailAddress} (Initial sync: ${email.initialSyncCompleted ? 'DONE' : 'PENDING'})`);
      });

      let totalEmailsFetched = 0;
      let totalEmailsParsed = 0;
      let totalTrackingEmails = 0;

      // 3. For each connected email account
      for (const connectedEmail of connectedEmails) {
        console.log('\n');
        console.log('-'.repeat(80));
        console.log(`📬 Processing: ${connectedEmail.provider.toUpperCase()} - ${connectedEmail.emailAddress}`);
        
        // Check account status
        if (connectedEmail.status === 'expired') {
          console.log(`❌ Account status: EXPIRED - User needs to reconnect`);
          console.log('-'.repeat(80));
          continue;
        } else if (connectedEmail.status === 'revoked') {
          console.log(`❌ Account status: REVOKED - User revoked access`);
          console.log('-'.repeat(80));
          continue;
        } else {
          console.log(`✅ Account status: ${connectedEmail.status.toUpperCase()}`);
        }
        console.log('-'.repeat(80));

        try {
          // Decide fetch limit based on whether initial sync was done
          const limit = connectedEmail.initialSyncCompleted
            ? this.MAINTENANCE_SYNC_LIMIT
            : this.INITIAL_SYNC_LIMIT;

          const syncType = connectedEmail.initialSyncCompleted ? 'MAINTENANCE' : 'INITIAL';
          console.log(`🎯 Sync type: ${syncType}`);
          console.log(`📊 Email limit: ${limit} emails`);

          // STEP 1: FETCH
          console.log(`\n📥 STEP 1: Fetching emails from ${connectedEmail.provider.toUpperCase()}...`);
          const fetchedEmails = await this.fetchService.fetchEmails(connectedEmail, limit);
          totalEmailsFetched += fetchedEmails.length;
          console.log(`✅ Fetched ${fetchedEmails.length} emails`);
          if (fetchedEmails.length > 0) {
            console.log(`   Latest email: "${fetchedEmails[0].subject}" from ${fetchedEmails[0].from}`);
          }

          // STEP 2: SAVE RAW EMAILS + CHECK FOR DUPLICATES
          console.log(`\n💾 STEP 2: Saving raw emails to database...`);
          const savedRawEmails: (RawEmail & { fetched: typeof fetchedEmails[0] })[] = [];
          let duplicateCount = 0;
          let newEmailCount = 0;

          for (const fetchedEmail of fetchedEmails) {
            try {
              // Check if already exists
              const existing = await this.rawEmailRepository.findByMessageId(
                userId,
                fetchedEmail.messageId,
              );

              let rawEmail: RawEmail;
              if (existing) {
                duplicateCount++;
                rawEmail = existing;
              } else {
                newEmailCount++;
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

          console.log(`✅ Raw emails saved:`);
          console.log(`   - New emails: ${newEmailCount}`);
          console.log(`   - Duplicates skipped: ${duplicateCount}`);
          console.log(`   - Total processed: ${savedRawEmails.length}`);

          await this.logEvent(syncId, userId, 'EMAILS_FETCHED', 'completed', {
            totalEmails: fetchedEmails.length,
          });

          // STEP 3: PARSE EMAILS + EXTRACT TRACKING
          console.log(`\n🔍 STEP 3: Parsing emails for tracking information...`);
          let skippedNonTracking = 0;
          let parsedWithTracking = 0;
          let parsedNoTracking = 0;

          for (const rawEmailData of savedRawEmails) {
            try {
              // On INITIAL sync: parse tous les emails
              // On MAINTENANCE: parser seulement si c'est du tracking
              const shouldParse =
                !connectedEmail.initialSyncCompleted ||
                this.trackingDetector.isTrackingEmail(rawEmailData.fetched);

              if (!shouldParse) {
                skippedNonTracking++;
                continue;
              }

              // Parse email
              const parsed = await this.parsingService.parseEmail(rawEmailData.fetched);

              if (!parsed.trackingNumber) {
                parsedNoTracking++;
                continue;
              }

              totalTrackingEmails++;
              parsedWithTracking++;
              console.log(`   ✅ Found tracking: ${parsed.trackingNumber} (${parsed.carrier || 'unknown carrier'})`);
              if (parsed.qrCode) console.log(`      📦 QR Code: ${parsed.qrCode}`);
              if (parsed.withdrawalCode) console.log(`      🔑 Withdrawal: ${parsed.withdrawalCode}`);
              if (parsed.marketplace) console.log(`      🛒 Marketplace: ${parsed.marketplace}`);

              // STEP 4: UPSERT PARSED EMAIL (check if tracking already exists)
              let parsedEmail = await this.parsedEmailRepository.findByTrackingNumber(
                userId,
                parsed.trackingNumber,
              );

              if (parsedEmail) {
                console.log(
                  `[EmailSyncOrchestrator] Tracking already exists: ${parsed.trackingNumber}, updating...`,
                );
                // Update with new info - convert undefined to null for Firestore
                parsedEmail = await this.parsedEmailRepository.update(parsedEmail.id, {
                  trackingNumber: parsed.trackingNumber,
                  carrier: parsed.carrier,
                  qrCode: parsed.qrCode ?? null,
                  withdrawalCode: parsed.withdrawalCode ?? null,
                  articleId: parsed.articleId ?? null,
                  marketplace: parsed.marketplace ?? null,
                  status: 'pending_shipment_lookup',
                });
              } else {
                // Create new - convert undefined to null for Firestore
                parsedEmail = await this.parsedEmailRepository.create({
                  rawEmailId: rawEmailData.id,
                  userId,
                  trackingNumber: parsed.trackingNumber,
                  carrier: parsed.carrier,
                  qrCode: parsed.qrCode ?? null,
                  withdrawalCode: parsed.withdrawalCode ?? null,
                  articleId: parsed.articleId ?? null,
                  marketplace: parsed.marketplace ?? null,
                  status: 'pending_shipment_lookup',
                });
                totalEmailsParsed++;
              }

              // STEP 4.5: CREATE PARCEL FROM PARSED EMAIL
              try {
                const parcel = await this.parsedEmailToParcelService.createParcelFromParsedEmail(parsedEmail);
                if (parcel) {
                  const direction = parcel.type === 'purchase' ? '📥 INCOMING' : '📤 OUTGOING';
                  console.log(`      🎯 Created shipment: ${direction} - ${parcel.title}`);
                }
              } catch (parcelError) {
                console.warn(
                  `      ⚠️  Failed to create parcel for ${parsed.trackingNumber}:`,
                  parcelError.message,
                );
              }
            } catch (parseError) {
              console.warn('[EmailSyncOrchestrator] Failed to parse email:', parseError);
            }
          }

          console.log(`\n📊 Parsing summary:`);
          console.log(`   - Emails with tracking: ${parsedWithTracking}`);
          console.log(`   - Emails without tracking: ${parsedNoTracking}`);
          console.log(`   - Non-tracking emails skipped: ${skippedNonTracking}`);

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
            console.log(`\n🎉 Initial sync completed for ${connectedEmail.emailAddress}`);
            console.log(`   Future syncs will only fetch ${this.MAINTENANCE_SYNC_LIMIT} recent emails`);
          }
          
          console.log(`\n✅ Account processing complete: ${connectedEmail.emailAddress}`);
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

      console.log('\n');
      console.log('='.repeat(80));
      console.log('✅ SYNC COMPLETED SUCCESSFULLY');
      console.log(`   Total emails fetched: ${totalEmailsFetched}`);
      console.log(`   Emails parsed: ${totalEmailsParsed}`);
      console.log(`   Tracking emails found: ${totalTrackingEmails}`);
      console.log(`   Sync ID: ${syncId}`);
      console.log(`   Duration: ${Date.now() - new Date().getTime()}ms`);
      console.log('='.repeat(80));
      console.log('\n');
    } catch (error) {
      console.log('\n');
      console.log('='.repeat(80));
      console.error('❌ SYNC FAILED');
      console.error(`   Error: ${error.message}`);
      console.error(`   Sync ID: ${syncId}`);
      console.log('='.repeat(80));
      console.error('\n', error);
      
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
        data: data || null, // Firestore doesn't accept undefined
      });
    } catch (error) {
      console.warn('[EmailSyncOrchestrator] Failed to log event:', error);
    }
  }

  private generateId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}
