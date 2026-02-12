import { Injectable, Inject } from '@nestjs/common';
import { EmailFetchService } from './email-fetch.service';
import { EmailTrackingDetectorService } from './email-tracking-detector.service';
import { EmailClassifierService } from './email-classifier.service';
import { ParsedEmailToParcelService } from './parsed-email-to-parcel.service';
import { NlpClientService } from './nlp-client.service';
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
  private readonly INITIAL_SYNC_LIMIT = 1000;
  private readonly MAINTENANCE_SYNC_LIMIT = 1000;

  constructor(
    private fetchService: EmailFetchService,
    private trackingDetector: EmailTrackingDetectorService,
    private emailClassifier: EmailClassifierService,
    private parsedEmailToParcelService: ParsedEmailToParcelService,
    private nlpClientService: NlpClientService,
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

          // STEP 3: PARSE EMAILS VIA NLP MODEL
          console.log(`\n🧠 STEP 3: Extracting tracking information via NLP model...`);
          let skippedNonTracking = 0;
          let parsedWithTracking = 0;
          let parsedNoTracking = 0;

          // Phase A: Filter tracking emails (Tier 1 — keyword detection)
          const trackingEmails: Array<RawEmail & { fetched: typeof fetchedEmails[0] }> = [];

          for (const rawEmailData of savedRawEmails) {
            const isTracking = this.trackingDetector.isTrackingEmail({
              subject: rawEmailData.fetched.subject,
              from: rawEmailData.fetched.from,
              body: rawEmailData.fetched.body,
            });
            if (isTracking) {
              trackingEmails.push(rawEmailData);
            } else {
              skippedNonTracking++;
            }
          }

          console.log(`   📧 Tracking emails detected: ${trackingEmails.length} / ${savedRawEmails.length}`);
          console.log(`   🚫 Non-tracking skipped: ${skippedNonTracking}`);

          // Phase B: Batch NLP extraction on all tracking emails
          if (trackingEmails.length > 0) {
            console.log(`\n🧠 Running NLP model on ${trackingEmails.length} tracking email(s)...`);

            let nlpResults: (ParsedTrackingInfo | null)[] = [];
            try {
              nlpResults = await this.nlpClientService.extractBatch(
                trackingEmails.map(e => ({
                  body: e.rawBody || e.fetched.body,
                  subject: e.subject,
                  from: e.from,
                })),
              );
            } catch (nlpError) {
              console.error('[EmailSyncOrchestrator] NLP batch extraction failed:', nlpError);
              nlpResults = trackingEmails.map(() => null);
            }

            // Phase C: Process each NLP result
            for (let i = 0; i < trackingEmails.length; i++) {
              const rawEmailData = trackingEmails[i];
              const nlpResult = nlpResults[i];

              try {
                if (!nlpResult || !nlpResult.trackingNumber) {
                  parsedNoTracking++;
                  continue;
                }

                // Clean & validate tracking number
                nlpResult.trackingNumber = this.cleanTrackingNumber(nlpResult.trackingNumber);
                if (!this.isValidTrackingNumber(nlpResult.trackingNumber)) {
                  console.log(`   ⚠️  Rejected invalid tracking: "${nlpResult.trackingNumber}" from ${rawEmailData.subject.substring(0, 60)}`);
                  parsedNoTracking++;
                  continue;
                }

                totalTrackingEmails++;
                parsedWithTracking++;

                const cleaned = this.removeUndefinedValues(nlpResult);

                // Classify email type (rule-based)
                try {
                  const bodyText = (rawEmailData.rawBody || rawEmailData.fetched.body || '').replace(/<[^>]*>/g, ' ').substring(0, 2000);
                  const classification = await this.emailClassifier.classify({
                    subject: rawEmailData.subject,
                    from: rawEmailData.from,
                    bodySnippet: bodyText,
                  });
                  cleaned.emailType = classification.emailType;
                  cleaned.sourceType = classification.sourceType;
                  cleaned.sourceName = classification.sourceName;
                  cleaned.classificationConfidence = classification.confidence;
                  console.log(`      🏷️  Classification: ${classification.emailType} (${classification.sourceType}/${classification.sourceName}) [${Math.round(classification.confidence * 100)}%]`);
                } catch (classErr) {
                  console.warn(`      ⚠️  Classification failed:`, classErr.message);
                }

                // Extract label URL
                try {
                  const labelUrl = this.labelUrlExtractor.extractLabelUrl(
                    rawEmailData.rawBody || rawEmailData.fetched.body,
                  );
                  if (labelUrl) {
                    cleaned.labelUrl = labelUrl;
                    console.log(`      🏷️  Label URL found: ${labelUrl.substring(0, 80)}…`);
                  }
                } catch {}

                console.log(`   ✅ NLP tracking: ${cleaned.trackingNumber} (${cleaned.carrier || 'unknown carrier'})`);
                if (cleaned.type) console.log(`      📍 Type: ${cleaned.type === 'sale' ? 'VENTE (expédition)' : 'ACHAT (réception)'}`);
                if (cleaned.qrCode) console.log(`      📦 QR Code: ${cleaned.qrCode}`);
                if (cleaned.withdrawalCode) console.log(`      🔑 Withdrawal: ${cleaned.withdrawalCode}`);
                if (cleaned.marketplace) console.log(`      🛒 Marketplace: ${cleaned.marketplace}`);

                const saved = await this.persistParsedEmail(userId, rawEmailData, cleaned);
                if (saved?.created) {
                  totalEmailsParsed++;
                }
                if (saved?.parsedEmail) {
                  await this.createParcelFromParsedEmail(saved.parsedEmail, cleaned);
                }
              } catch (parseError) {
                console.warn('[EmailSyncOrchestrator] Failed to process NLP result:', parseError);
              }
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

  /**
   * Validate tracking number quality before saving to database.
   * Cleans tracking number by stripping common French/English prefixes
   * e.g. "suivi : PP42753268305" → "PP42753268305"
   *      "n° de suivi: 6A12345678901" → "6A12345678901"
   */
  private cleanTrackingNumber(tracking: string): string {
    if (!tracking) return tracking;
    
    // Strip common prefix patterns (French and English)
    let cleaned = tracking
      // "suivi : XXX", "suivi: XXX", "suivi XXX"
      .replace(/^(?:n[°u]m[eé]ro\s*(?:de\s*)?)?(?:suivi|tracking|colis|envoi|bordereau)[\s:]*[:=\-]?\s*/i, '')
      // "numéro : XXX", "n° : XXX"
      .replace(/^(?:n[°u]m[eé]ro|n°|ref|réf[eé]rence)[\s:]*[:=\-]?\s*/i, '')
      .trim();
    
    // If still contains a colon, take the part after the last colon
    if (cleaned.includes(':') && /[a-zéèêëàâäùûüôöîïç]/i.test(cleaned.split(':')[0])) {
      const afterColon = cleaned.split(':').pop()?.trim();
      if (afterColon && /[A-Z0-9]/i.test(afterColon)) {
        cleaned = afterColon;
      }
    }
    
    return cleaned;
  }

  /**
   * Validates tracking number after cleaning.
   * Rejects obviously invalid tracking numbers like:
   * - "Tracking Information" (literal text extracted by bad regex)
   * - "333333333333336" (all same digit)
   * - Numbers containing common words
   * - Too short strings
   */
  private isValidTrackingNumber(tracking: string): boolean {
    if (!tracking || tracking.length < 6) return false;
    
    const lower = tracking.toLowerCase();
    
    // Reject literal text that got extracted as tracking
    const rejectTexts = [
      'tracking information', 'tracking details', 'suivi de',
      'numéro de suivi', 'information', 'undefined', 'null', 'n/a',
    ];
    if (rejectTexts.some(t => lower.includes(t))) return false;
    
    // Reject if still contains French/English words (not a real tracking number)
    const wordPattern = /\b(suivi|tracking|colis|livraison|commande|numero|numéro|envoi|details|information)\b/i;
    if (wordPattern.test(tracking)) return false;

    // Reject all-same-digit numbers
    if (/^(\d)\1{7,}$/.test(tracking)) return false;
    
    // Must contain at least some digits
    if (!/\d/.test(tracking)) return false;
    
    // Reject if > 40 chars (no valid tracking is this long)
    if (tracking.length > 40) return false;
    
    return true;
  }
}
