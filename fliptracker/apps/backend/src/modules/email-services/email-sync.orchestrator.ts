import { Injectable, Inject } from '@nestjs/common';
import { EmailFetchService } from './email-fetch.service';
import { HybridEmailParsingService } from './hybrid-email-parsing.service';
import { EmailTrackingDetectorService } from './email-tracking-detector.service';
import { EmailClassifierService } from './email-classifier.service';
import { ParsedEmailToParcelService } from './parsed-email-to-parcel.service';
import { DeepSeekService } from './deepseek.service';
import { ParsedTrackingInfo } from './email-parsing.service';
import { ConnectedEmailsService } from '../connected-emails/connected-emails.service';
import { UsersService } from '../users/users.service';
import { LabelUrlExtractorService } from './utils/label-url-extractor.service';
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
  private readonly INITIAL_SYNC_LIMIT = 200; // Premier sync: 200 emails
  private readonly MAINTENANCE_SYNC_LIMIT = 200; // Syncs suivants: 30 emails

  constructor(
    private fetchService: EmailFetchService,
    private hybridParsingService: HybridEmailParsingService,
    private trackingDetector: EmailTrackingDetectorService,
    private emailClassifier: EmailClassifierService,
    private parsedEmailToParcelService: ParsedEmailToParcelService,
    private deepSeekService: DeepSeekService,
    private connectedEmailsService: ConnectedEmailsService,
    private usersService: UsersService,
    private labelUrlExtractor: LabelUrlExtractorService,
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
                console.log(`   🤖 Flagging for DeepSeek enhancement: ${rawEmailData.subject.substring(0, 60)}...`);
                if (!parsed.trackingNumber) console.log(`      ⚠️  Reason: No tracking number found`);
                if (!parsed.pickupAddress || parsed.pickupAddress.length < 20) console.log(`      ⚠️  Reason: Incomplete or missing address`);
                if (!parsed.marketplace) console.log(`      ⚠️  Reason: Marketplace not detected`);
                deepSeekCandidates.push({ rawEmailData, parsed });
                continue;
              }

              if (!parsed.trackingNumber) {
                parsedNoTracking++;
                continue;
              }

              totalTrackingEmails++;
              parsedWithTracking++;
              
              // Clean undefined values before saving to Firestore
              const cleanedParsed = this.removeUndefinedValues(parsed);

              // ── Classify email type + extract label URL ──
              try {
                const bodyText = (rawEmailData.rawBody || rawEmailData.fetched.body || '').replace(/<[^>]*>/g, ' ').substring(0, 2000);
                const classification = await this.emailClassifier.classify({
                  subject: rawEmailData.subject,
                  from: rawEmailData.from,
                  bodySnippet: bodyText,
                });
                cleanedParsed.emailType = classification.emailType;
                cleanedParsed.sourceType = classification.sourceType;
                cleanedParsed.sourceName = classification.sourceName;
                cleanedParsed.classificationConfidence = classification.confidence;
                console.log(`      🏷️  Classification: ${classification.emailType} (${classification.sourceType}/${classification.sourceName}) [${Math.round(classification.confidence * 100)}%]`);
              } catch (classErr) {
                console.warn(`      ⚠️  Classification failed:`, classErr.message);
              }

              try {
                const labelUrl = this.labelUrlExtractor.extractLabelUrl(
                  rawEmailData.rawBody || rawEmailData.fetched.body,
                );
                if (labelUrl) {
                  cleanedParsed.labelUrl = labelUrl;
                  console.log(`      🏷️  Label URL found: ${labelUrl.substring(0, 80)}…`);
                }
              } catch (labelErr) {
                // non-critical
              }
              
              console.log(`   ✅ Found tracking: ${cleanedParsed.trackingNumber} (${cleanedParsed.carrier || 'unknown carrier'})`);
              if (cleanedParsed.type) console.log(`      📍 Type: ${cleanedParsed.type === 'sale' ? 'VENTE (expédition)' : 'ACHAT (réception)'}`);
              if (cleanedParsed.qrCode) console.log(`      📦 QR Code: ${cleanedParsed.qrCode}`);
              if (cleanedParsed.withdrawalCode) console.log(`      🔑 Withdrawal: ${cleanedParsed.withdrawalCode}`);
              if (cleanedParsed.marketplace) console.log(`      🛒 Marketplace: ${cleanedParsed.marketplace}`);

              const saved = await this.persistParsedEmail(userId, rawEmailData, cleanedParsed);
              if (saved?.created) {
                totalEmailsParsed++;
              }
              if (saved?.parsedEmail) {
                await this.createParcelFromParsedEmail(saved.parsedEmail, cleanedParsed);
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
                // Clean undefined values before saving to Firestore
                const cleaned = this.removeUndefinedValues(merged);

                if (!cleaned.trackingNumber) {
                  parsedNoTracking++;
                  continue;
                }

                totalTrackingEmails++;
                parsedWithTracking++;

                // ── Classify DeepSeek-enhanced email + extract label URL ──
                try {
                  const dsBodyText = (candidate.rawEmailData.rawBody || candidate.rawEmailData.fetched.body || '').replace(/<[^>]*>/g, ' ').substring(0, 2000);
                  const classification = await this.emailClassifier.classify({
                    subject: candidate.rawEmailData.subject,
                    from: candidate.rawEmailData.from,
                    bodySnippet: dsBodyText,
                  });
                  cleaned.emailType = classification.emailType;
                  cleaned.sourceType = classification.sourceType;
                  cleaned.sourceName = classification.sourceName;
                  cleaned.classificationConfidence = classification.confidence;
                } catch {}

                try {
                  const labelUrl = this.labelUrlExtractor.extractLabelUrl(
                    candidate.rawEmailData.rawBody || candidate.rawEmailData.fetched.body,
                  );
                  if (labelUrl) cleaned.labelUrl = labelUrl;
                } catch {}

                console.log(`   ✅ DeepSeek tracking: ${cleaned.trackingNumber} (${cleaned.carrier || 'unknown carrier'})`);
                if (cleaned.type) console.log(`      📍 Type: ${cleaned.type === 'sale' ? 'VENTE (expédition)' : 'ACHAT (réception)'}`);
                if (cleaned.qrCode) console.log(`      📦 QR Code: ${cleaned.qrCode}`);
                if (cleaned.withdrawalCode) console.log(`      🔑 Withdrawal: ${cleaned.withdrawalCode}`);
                if (cleaned.marketplace) console.log(`      🛒 Marketplace: ${cleaned.marketplace}`);

                const saved = await this.persistParsedEmail(userId, candidate.rawEmailData, cleaned);
                if (saved?.created) {
                  totalEmailsParsed++;
                }
                if (saved?.parsedEmail) {
                  await this.createParcelFromParsedEmail(saved.parsedEmail, cleaned);
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
      // SMART UPDATE: Merge new data with existing, keeping non-null values
      const updates: Partial<ParsedEmail> = {};
      let hasUpdates = false;

      // Update fields if new value is non-null and old value is null/missing
      if (parsed.qrCode && !existing.qrCode) {
        updates.qrCode = parsed.qrCode;
        hasUpdates = true;
        console.log(`      🔄 Updating QR code for ${parsed.trackingNumber}: ${parsed.qrCode}`);
      }
      if (parsed.withdrawalCode && !existing.withdrawalCode) {
        updates.withdrawalCode = parsed.withdrawalCode;
        hasUpdates = true;
        console.log(`      🔄 Updating withdrawal code for ${parsed.trackingNumber}: ${parsed.withdrawalCode}`);
      }
      if (parsed.marketplace && !existing.marketplace) {
        updates.marketplace = parsed.marketplace;
        hasUpdates = true;
        console.log(`      🔄 Updating marketplace for ${parsed.trackingNumber}: ${parsed.marketplace}`);
      }
      if (parsed.pickupAddress && !existing.pickupAddress) {
        updates.pickupAddress = parsed.pickupAddress;
        hasUpdates = true;
        console.log(`      🔄 Updating pickup address for ${parsed.trackingNumber}`);
      }
      if (parsed.productName && !existing.productName) {
        updates.productName = parsed.productName;
        hasUpdates = true;
      }
      if (parsed.pickupDeadline && !existing.pickupDeadline) {
        updates.pickupDeadline = parsed.pickupDeadline;
        hasUpdates = true;
      }
      if (parsed.type && !existing.type) {
        updates.type = parsed.type;
        hasUpdates = true;
      }

      if (hasUpdates) {
        const updated = await this.parsedEmailRepository.update(existing.id, updates);
        
        // 🔥 FLAGRANT LOGS FOR DATABASE UPDATE
        console.log('\n');
        console.log('━'.repeat(80));
        console.log('🔄 PARSED EMAIL UPDATED IN DATABASE');
        console.log('━'.repeat(80));
        console.log(`📋 Firestore Document ID: ${updated.id}`);
        console.log(`🔢 Tracking Number: ${updated.trackingNumber}`);
        console.log(`📝 Updated Fields: ${Object.keys(updates).join(', ')}`);
        console.log(`🚚 Carrier: ${updated.carrier || 'NOT SET'}`);
        console.log(`📦 Type: ${updated.type || 'NOT SET'}`);
        console.log(`🏪 Marketplace: ${updated.marketplace || 'NOT SET'}`);
        
        // Only show optional fields if they have values
        if (updated.pickupAddress) {
          console.log(`📍 Pickup Address: ${updated.pickupAddress.substring(0, 60)}...`);
        }
        if (updated.withdrawalCode) {
          console.log(`🔑 Withdrawal Code: ${updated.withdrawalCode}`);
        }
        if (updated.qrCode) {
          console.log(`📱 QR Code: ${updated.qrCode.substring(0, 80)}...`);
        }
        
        console.log('━'.repeat(80));
        console.log('\n');
        
        return { parsedEmail: updated, created: false };
      } else {
        console.log(`[EmailSyncOrchestrator] ⚠️  Tracking already exists: ${parsed.trackingNumber}, no new data to update`);
        return null;
      }
    }

    // Build data object for new entry, explicitly ensuring no undefined values for Firestore
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
      // Classification fields
      emailType: parsed.emailType ?? null,
      sourceType: parsed.sourceType ?? null,
      sourceName: parsed.sourceName ?? null,
      classificationConfidence: parsed.classificationConfidence ?? null,
      labelUrl: parsed.labelUrl ?? null,
    };

    // Only add optional fields if they have values
    if (parsed.carrier !== undefined) data.carrier = parsed.carrier;
    if (parsed.type !== undefined) data.type = parsed.type;

    const parsedEmail = await this.parsedEmailRepository.create(data);

    // 🔥 FLAGRANT LOGS FOR DATABASE TRACKING
    console.log('\n');
    console.log('━'.repeat(80));
    console.log('💾 NEW PARSED EMAIL SAVED TO DATABASE');
    console.log('━'.repeat(80));
    console.log(`📋 Firestore Document ID: ${parsedEmail.id}`);
    console.log(`🔢 Tracking Number: ${parsedEmail.trackingNumber}`);
    console.log(`🚚 Carrier: ${parsedEmail.carrier || 'NOT SET'}`);
    console.log(`📦 Type: ${parsedEmail.type || 'NOT SET'}`);
    console.log(`🏪 Marketplace: ${parsedEmail.marketplace || 'NOT SET'}`);
    
    // Only show optional fields if they have values
    if (parsedEmail.pickupAddress) {
      console.log(`📍 Pickup Address: ${parsedEmail.pickupAddress.substring(0, 60)}...`);
    }
    if (parsedEmail.withdrawalCode) {
      console.log(`🔑 Withdrawal Code: ${parsedEmail.withdrawalCode}`);
    }
    if (parsedEmail.qrCode) {
      console.log(`📱 QR Code: ${parsedEmail.qrCode.substring(0, 80)}...`);
    }
    if (parsedEmail.productName) {
      console.log(`🛍️  Product: ${parsedEmail.productName}`);
    }
    if (parsedEmail.recipientName) {
      console.log(`👤 Recipient: ${parsedEmail.recipientName}`);
    }
    if (parsedEmail.pickupDeadline) {
      console.log(`📅 Pickup Deadline: ${parsedEmail.pickupDeadline.toISOString()}`);
    }
    
    console.log(`📅 Received At: ${parsedEmail.receivedAt ? parsedEmail.receivedAt.toISOString() : 'NOT SET'}`);
    console.log(`📧 Raw Email ID: ${parsedEmail.rawEmailId}`);
    console.log(`👥 User ID: ${parsedEmail.userId}`);
    console.log(`📅 Created At: ${parsedEmail.createdAt ? parsedEmail.createdAt.toISOString() : new Date().toISOString()}`);
    console.log('━'.repeat(80));
    console.log('\n');

    return { parsedEmail, created: true };
  }

  private async createParcelFromParsedEmail(parsedEmail: ParsedEmail, parsed: ParsedTrackingInfo): Promise<void> {
    try {
      const parcel = await this.parsedEmailToParcelService.createParcelFromParsedEmail(parsedEmail);
      if (parcel) {
        const direction = parcel.type === 'purchase' ? '📥 INCOMING' : '📤 OUTGOING';
        
        // 🔥 FLAGRANT LOGS FOR PARCEL CREATION
        console.log('\n');
        console.log('┏' + '━'.repeat(78) + '┓');
        console.log('┃ 📦 PARCEL/SHIPMENT CREATED IN DATABASE' + ' '.repeat(38) + '┃');
        console.log('┗' + '━'.repeat(78) + '┛');
        console.log(`🆔 Parcel Document ID: ${parcel.id}`);
        console.log(`📋 Title: ${parcel.title}`);
        console.log(`🔢 Tracking: ${parcel.trackingNumber}`);
        console.log(`📦 Direction: ${direction}`);
        console.log(`🚚 Carrier: ${parcel.carrier || 'NOT SET'}`);
        console.log(`👤 User ID: ${parcel.userId}`);
        console.log(`📅 Created At: ${parcel.createdAt ? parcel.createdAt.toISOString() : new Date().toISOString()}`);
        console.log(`🔗 Linked ParsedEmail ID: ${parsedEmail.id}`);
        console.log('━'.repeat(80));
        console.log('\n');
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

  private removeUndefinedValues(obj: any): any {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = value;
      }
    }
    return cleaned;
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
