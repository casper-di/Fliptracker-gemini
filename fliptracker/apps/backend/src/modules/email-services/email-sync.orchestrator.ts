import { Injectable, Inject } from '@nestjs/common';
import { EmailFetchService } from './email-fetch.service';
import { HybridEmailParsingService } from './hybrid-email-parsing.service';
import { EmailTrackingDetectorService } from './email-tracking-detector.service';
import { ParsedEmailToParcelService } from './parsed-email-to-parcel.service';
import { DeepSeekService } from './deepseek.service';
import { ParsedTrackingInfo } from './email-parsing.service';
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
    private hybridParsingService: HybridEmailParsingService,
    private trackingDetector: EmailTrackingDetectorService,
    private parsedEmailToParcelService: ParsedEmailToParcelService,
    private deepSeekService: DeepSeekService,
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
          const deepSeekCandidates: Array<{
            rawEmailData: RawEmail & { fetched: typeof fetchedEmails[0] };
            parsed: ParsedTrackingInfo & { isTrackingEmail: boolean; needsDeepSeek: boolean };
          }> = [];

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

              // Parse email - pass receivedAt for metadata extraction
              const parsed = await this.hybridParsingService.parseEmail({
                ...rawEmailData.fetched,
                receivedAt: rawEmailData.receivedAt,
              });

              // If not a tracking email, skip
              if (!parsed.isTrackingEmail) {
                parsedNoTracking++;
                continue;
              }

              if (parsed.needsDeepSeek) {
                deepSeekCandidates.push({ rawEmailData, parsed });
                continue;
              }

              if (!parsed.trackingNumber) {
                parsedNoTracking++;
                continue;
              }

              totalTrackingEmails++;
              parsedWithTracking++;
              console.log(`   ✅ Found tracking: ${parsed.trackingNumber} (${parsed.carrier || 'unknown carrier'})`);
              if (parsed.type) console.log(`      📍 Type: ${parsed.type === 'sale' ? 'VENTE (expédition)' : 'ACHAT (réception)'}`);
              if (parsed.qrCode) console.log(`      📦 QR Code: ${parsed.qrCode}`);
              if (parsed.withdrawalCode) console.log(`      🔑 Withdrawal: ${parsed.withdrawalCode}`);
              if (parsed.marketplace) console.log(`      🛒 Marketplace: ${parsed.marketplace}`);

              const saved = await this.persistParsedEmail(userId, rawEmailData, parsed);
              if (saved?.created) {
                totalEmailsParsed++;
              }
              if (saved?.parsedEmail) {
                await this.createParcelFromParsedEmail(saved.parsedEmail, parsed);
              }
            } catch (parseError) {
              console.warn('[EmailSyncOrchestrator] Failed to parse email:', parseError);
            }
          }

          if (deepSeekCandidates.length > 0) {
            console.log(`\n🤖 DeepSeek enhancement for ${deepSeekCandidates.length} email(s)...`);
            try {
              const enhancements = await this.deepSeekService.enhanceEmails(
                deepSeekCandidates.map(candidate => ({
                  id: candidate.rawEmailData.id,
                  subject: candidate.rawEmailData.subject,
                  from: candidate.rawEmailData.from,
                  body: candidate.rawEmailData.rawBody,
                  receivedAt: candidate.rawEmailData.receivedAt,
                  partial: candidate.parsed,
                })),
              );

              for (const candidate of deepSeekCandidates) {
                const enhanced = enhancements[candidate.rawEmailData.id];
                const merged = this.mergeParsedResults(candidate.parsed, enhanced);

                if (!merged.trackingNumber) {
                  parsedNoTracking++;
                  continue;
                }

                totalTrackingEmails++;
                parsedWithTracking++;
                console.log(`   ✅ DeepSeek tracking: ${merged.trackingNumber} (${merged.carrier || 'unknown carrier'})`);
                if (merged.type) console.log(`      📍 Type: ${merged.type === 'sale' ? 'VENTE (expédition)' : 'ACHAT (réception)'}`);
                if (merged.qrCode) console.log(`      📦 QR Code: ${merged.qrCode}`);
                if (merged.withdrawalCode) console.log(`      🔑 Withdrawal: ${merged.withdrawalCode}`);
                if (merged.marketplace) console.log(`      🛒 Marketplace: ${merged.marketplace}`);

                const saved = await this.persistParsedEmail(userId, candidate.rawEmailData, merged);
                if (saved?.created) {
                  totalEmailsParsed++;
                }
                if (saved?.parsedEmail) {
                  await this.createParcelFromParsedEmail(saved.parsedEmail, merged);
                }
              }
            } catch (deepSeekError) {
              console.warn('[EmailSyncOrchestrator] DeepSeek enhancement failed:', deepSeekError);
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

  private async persistParsedEmail(
    userId: string,
    rawEmailData: RawEmail,
    parsed: ParsedTrackingInfo,
  ): Promise<{ parsedEmail: ParsedEmail; created: boolean } | null> {
    if (!parsed.trackingNumber) return null;

    const existing = await this.parsedEmailRepository.findByTrackingNumber(
      userId,
      parsed.trackingNumber,
    );

    if (existing) {
      console.log(
        `[EmailSyncOrchestrator] ⚠️  Tracking already exists: ${parsed.trackingNumber}, skipping duplicate...`,
      );
      return null;
    }

    // Build data object, explicitly ensuring no undefined values for Firestore
    const data: any = {
      rawEmailId: rawEmailData.id,
      userId,
      trackingNumber: parsed.trackingNumber,
      status: 'pending_shipment_lookup',
      qrCode: parsed.qrCode ?? null,
      withdrawalCode: parsed.withdrawalCode ?? null,
      articleId: parsed.articleId ?? null,
      marketplace: parsed.marketplace ?? null,
      provider: rawEmailData.provider ?? null,
      senderEmail: rawEmailData.from ?? null,
      senderName: parsed.senderName ?? null,
      receivedAt: rawEmailData.receivedAt ?? null,
      productName: parsed.productName ?? null,
      productDescription: parsed.productDescription ?? null,
      recipientName: parsed.recipientName ?? null,
      pickupAddress: parsed.pickupAddress ?? null,
      pickupDeadline: parsed.pickupDeadline ?? null,
      orderNumber: parsed.orderNumber ?? null,
      estimatedValue: parsed.estimatedValue ?? null,
      currency: parsed.currency ?? null,
    };

    // Only add optional fields if they have values
    if (parsed.carrier !== undefined) data.carrier = parsed.carrier;
    if (parsed.type !== undefined) data.type = parsed.type;

    const parsedEmail = await this.parsedEmailRepository.create(data);

    return { parsedEmail, created: true };
  }

  private async createParcelFromParsedEmail(parsedEmail: ParsedEmail, parsed: ParsedTrackingInfo): Promise<void> {
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
  }

  private mergeParsedResults(
    base: ParsedTrackingInfo,
    enhanced?: ParsedTrackingInfo,
  ): ParsedTrackingInfo {
    if (!enhanced) return base;

    const merged: ParsedTrackingInfo = { ...base };
    for (const [key, value] of Object.entries(enhanced)) {
      if (value !== null && value !== undefined) {
        (merged as any)[key] = value;
      }
    }

    return merged;
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

  private calculateCompleteness(result: any): number {
    let score = 0;
    let maxScore = 10;
    
    if (result.trackingNumber) score += 3;
    if (result.carrier) score += 2;
    if (result.type) score += 1;
    if (result.productName) score += 1;
    if (result.pickupAddress) score += 2;
    if (result.withdrawalCode || result.qrCode) score += 1;
    
    return Math.round((score / maxScore) * 100);
  }
}
