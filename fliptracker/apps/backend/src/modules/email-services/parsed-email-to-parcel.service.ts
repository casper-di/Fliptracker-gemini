import { Injectable, Inject } from '@nestjs/common';
import { ParsedEmail } from '../../domain/entities/email-sync.entity';
import { Parcel, ParcelType, ParcelStatus, EmailType, StatusHistoryEntry } from '../../domain/entities/parcel.entity';
import {
  PARCEL_REPOSITORY,
  IParcelRepository,
} from '../../domain/repositories/parcel.repository';
import { StatusDetectorService } from './status-detector.service';

/**
 * Status progression order — higher index = further along in lifecycle.
 * A status can only advance forward, never regress (anti-regression rule).
 */
const STATUS_ORDER: ParcelStatus[] = [
  'pending',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'returned',  // terminal state, separate branch
];

@Injectable()
export class ParsedEmailToParcelService {
  constructor(
    @Inject(PARCEL_REPOSITORY)
    private parcelRepository: IParcelRepository,
    private statusDetector: StatusDetectorService,
  ) {}

  // ─── public API ──────────────────────────────────────────────

  /**
   * Convert ParsedEmail to Parcel.
   * - If parcel doesn't exist → create
   * - If parcel exists → update (merge new data, anti-regression on status)
   */
  async createParcelFromParsedEmail(parsedEmail: ParsedEmail): Promise<Parcel | null> {
    if (!parsedEmail.trackingNumber) {
      console.log(`      ⚠️  Skipping: No tracking number`);
      return null;
    }

    console.log(`      📦 Processing ParsedEmail:`, {
      trackingNumber: parsedEmail.trackingNumber,
      carrier: parsedEmail.carrier,
      marketplace: parsedEmail.marketplace,
      emailType: (parsedEmail as any).emailType ?? 'n/a',
    });

    // Check if parcel already exists
    const existing = await this.parcelRepository.findByTrackingNumber(
      parsedEmail.userId,
      parsedEmail.trackingNumber,
    );

    if (existing) {
      console.log(`      ℹ️  Parcel exists (${existing.id}), merging update…`);
      return this.updateParcelFromEmail(existing, parsedEmail);
    }

    return this.createNewParcel(parsedEmail);
  }

  // ─── creation ────────────────────────────────────────────────

  private async createNewParcel(parsedEmail: ParsedEmail): Promise<Parcel | null> {
    if (!parsedEmail.trackingNumber) return null;

    const type = this.resolveType(parsedEmail);
    const carrier = this.mapCarrier(parsedEmail.carrier);
    const title = this.generateTitle(parsedEmail);
    const status = this.resolveInitialStatus(parsedEmail);
    const emailType = (parsedEmail as any).emailType as EmailType | undefined;

    const historyEntry: StatusHistoryEntry = {
      status,
      timestamp: new Date(),
      ...(emailType ? { emailType } : {}),
      ...(parsedEmail.rawEmailId ? { sourceEmailId: parsedEmail.rawEmailId } : {}),
    };

    try {
      const parcel = await this.parcelRepository.create({
        userId: parsedEmail.userId,
        trackingNumber: parsedEmail.trackingNumber,
        carrier,
        status,
        type,
        sourceEmailId: parsedEmail.rawEmailId,
        provider: parsedEmail.provider ?? 'gmail',
        title,
        // Email classification
        lastEmailType: emailType ?? null,
        sourceType: (parsedEmail as any).sourceType ?? null,
        sourceName: (parsedEmail as any).sourceName ?? null,
        labelUrl: (parsedEmail as any).labelUrl ?? null,
        statusHistory: [historyEntry],
        // Metadata
        productName: parsedEmail.productName ?? null,
        productDescription: parsedEmail.productDescription ?? null,
        recipientName: parsedEmail.recipientName ?? null,
        senderName: parsedEmail.senderName ?? null,
        senderEmail: parsedEmail.senderEmail ?? null,
        pickupAddress: parsedEmail.pickupAddress ?? null,
        pickupDeadline: parsedEmail.pickupDeadline ?? null,
        orderNumber: parsedEmail.orderNumber ?? null,
        withdrawalCode: parsedEmail.withdrawalCode ?? null,
        qrCode: parsedEmail.qrCode ?? null,
        marketplace: parsedEmail.marketplace || null,
        itemPrice: parsedEmail.estimatedValue || null,
        currency: parsedEmail.currency || null,
      } as any);

      console.log(`      ✅ Parcel created: ${parcel.id} - "${title}" [${status}]`);
      return parcel;
    } catch (error) {
      console.error(`      ❌ Failed to create parcel:`, error.message);
      return null;
    }
  }

  // ─── update (merge + anti-regression) ────────────────────────

  private async updateParcelFromEmail(existing: Parcel, parsedEmail: ParsedEmail): Promise<Parcel> {
    const newStatus = this.resolveInitialStatus(parsedEmail);
    const accepted = this.shouldAdvanceStatus(existing.status, newStatus);
    const finalStatus = accepted ? newStatus : existing.status;
    const emailType = (parsedEmail as any).emailType as EmailType | undefined;

    if (!accepted) {
      console.log(`      🛡️  Anti-regression: keeping "${existing.status}" (would regress to "${newStatus}")`);
    }

    // Build history entry
    const historyEntry: StatusHistoryEntry = {
      status: newStatus,
      timestamp: new Date(),
      ...(emailType ? { emailType } : {}),
      ...(parsedEmail.rawEmailId ? { sourceEmailId: parsedEmail.rawEmailId } : {}),
    };
    const statusHistory = [...(existing.statusHistory ?? []), historyEntry];

    // Merge: only overwrite null/empty fields — never erase existing data
    const updates: Partial<Parcel> = {
      status: finalStatus,
      lastEmailType: emailType ?? existing.lastEmailType ?? null,
      sourceType: (parsedEmail as any).sourceType ?? existing.sourceType ?? null,
      sourceName: (parsedEmail as any).sourceName ?? existing.sourceName ?? null,
      labelUrl: (parsedEmail as any).labelUrl ?? existing.labelUrl ?? null,
      statusHistory,
      // Metadata: fill blanks
      productName: existing.productName ?? parsedEmail.productName ?? null,
      productDescription: existing.productDescription ?? parsedEmail.productDescription ?? null,
      recipientName: existing.recipientName ?? parsedEmail.recipientName ?? null,
      senderName: existing.senderName ?? parsedEmail.senderName ?? null,
      senderEmail: existing.senderEmail ?? parsedEmail.senderEmail ?? null,
      pickupAddress: existing.pickupAddress ?? parsedEmail.pickupAddress ?? null,
      pickupDeadline: existing.pickupDeadline ?? parsedEmail.pickupDeadline ?? null,
      orderNumber: existing.orderNumber ?? parsedEmail.orderNumber ?? null,
      withdrawalCode: existing.withdrawalCode ?? parsedEmail.withdrawalCode ?? null,
      qrCode: existing.qrCode ?? parsedEmail.qrCode ?? null,
      marketplace: existing.marketplace ?? parsedEmail.marketplace ?? null,
      itemPrice: (existing as any).itemPrice ?? parsedEmail.estimatedValue ?? null,
      currency: (existing as any).currency ?? parsedEmail.currency ?? null,
    };

    try {
      const updated = await this.parcelRepository.update(existing.id, updates);
      console.log(`      🔄 Parcel updated: ${existing.id} [${existing.status} → ${finalStatus}]`);
      return updated ?? existing;
    } catch (error) {
      console.error(`      ❌ Failed to update parcel ${existing.id}:`, error.message);
      return existing;
    }
  }

  // ─── status helpers ──────────────────────────────────────────

  /**
   * Anti-regression: only allow status to advance forward in lifecycle.
   * Exception: 'returned' can always be set (it's a terminal override from carrier).
   */
  private shouldAdvanceStatus(current: ParcelStatus, incoming: ParcelStatus): boolean {
    if (incoming === 'returned') return true; // always accept return
    if (current === 'returned') return false; // returned is terminal

    const currentIdx = STATUS_ORDER.indexOf(current);
    const incomingIdx = STATUS_ORDER.indexOf(incoming);

    // Unknown statuses default to index -1 → always accept something known
    return incomingIdx > currentIdx;
  }

  private resolveInitialStatus(parsedEmail: ParsedEmail): ParcelStatus {
    // 1. Use emailType if available for accurate mapping
    const emailType = (parsedEmail as any).emailType as EmailType | undefined;
    if (emailType) {
      const mapped = this.emailTypeToStatus(emailType);
      if (mapped) return mapped;
    }

    // 2. If we have pickup info → delivered to pickup point
    if (parsedEmail.pickupAddress || parsedEmail.pickupDeadline || parsedEmail.withdrawalCode || parsedEmail.qrCode) {
      return 'delivered';
    }

    // 3. Fallback: pending
    return 'pending';
  }

  private emailTypeToStatus(emailType: EmailType): ParcelStatus | null {
    switch (emailType) {
      case 'order_confirmed':
      case 'label_created':
        return 'pending';
      case 'shipped':
      case 'in_transit':
        return 'in_transit';
      case 'out_for_delivery':
        return 'out_for_delivery';
      case 'delivered':
      case 'pickup_ready':
        return 'delivered';
      case 'returned':
        return 'returned';
      default:
        return null;
    }
  }

  private resolveType(parsedEmail: ParsedEmail): ParcelType {
    if (parsedEmail.type) return parsedEmail.type;
    if (parsedEmail.marketplace) return 'purchase';
    return 'sale';
  }

  private mapCarrier(raw?: string | null): Parcel['carrier'] {
    if (!raw) return 'other';
    const map: Record<string, Parcel['carrier']> = {
      dhl: 'dhl',
      ups: 'ups',
      fedex: 'fedex',
      laposte: 'laposte',
      colissimo: 'laposte',
      chronopost: 'chronopost',
      vinted_go: 'vinted_go',
      mondial_relay: 'mondial_relay',
      relais_colis: 'relais_colis',
    };
    return map[raw] ?? 'other';
  }

  /**
   * Generate a human-readable title for the parcel
   * Prioritizes: productName > senderName > marketplace > carrier
   */
  private generateTitle(parsedEmail: ParsedEmail): string {
    // Priority 1: Product name
    if (parsedEmail.productName) {
      console.log(`      📝 Generated title: "${parsedEmail.productName}"`);
      return parsedEmail.productName;
    }

    // Priority 2: Sender name (e.g., "Vinted Go", "Amazon")
    if (parsedEmail.senderName) {
      const title = `Colis de ${parsedEmail.senderName}`;
      console.log(`      📝 Generated title: "${title}"`);
      return title;
    }

    // Priority 3: Marketplace
    if (parsedEmail.marketplace) {
      const marketplaceLabel = parsedEmail.marketplace.charAt(0).toUpperCase() + parsedEmail.marketplace.slice(1);
      const title = `Achat ${marketplaceLabel}`;
      console.log(`      📝 Generated title: "${title}"`);
      return title;
    }

    // Fallback: Carrier + tracking
    const carrier = parsedEmail.carrier || 'Unknown';
    const fallback = `${carrier.toUpperCase()} - ${parsedEmail.trackingNumber?.substring(0, 10) || 'inconnu'}`;
    console.log(`      📝 Generated title: "${fallback}"`);
    return fallback;
  }

  /**
   * Batch convert multiple ParsedEmails to Parcels
   */
  async batchCreateParcels(parsedEmails: ParsedEmail[]): Promise<Parcel[]> {
    const parcels: Parcel[] = [];

    for (const parsedEmail of parsedEmails) {
      try {
        const parcel = await this.createParcelFromParsedEmail(parsedEmail);
        if (parcel) {
          parcels.push(parcel);
        }
      } catch (error) {
        console.error(
          `[ParsedEmailToParcelService] Failed to process ParsedEmail ${parsedEmail.id}:`,
          error,
        );
      }
    }

    return parcels;
  }
}
