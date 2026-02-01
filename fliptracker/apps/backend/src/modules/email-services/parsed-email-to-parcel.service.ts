import { Injectable, Inject } from '@nestjs/common';
import { ParsedEmail } from '../../domain/entities/email-sync.entity';
import { Parcel, ParcelType } from '../../domain/entities/parcel.entity';
import {
  PARCEL_REPOSITORY,
  IParcelRepository,
} from '../../domain/repositories/parcel.repository';

@Injectable()
export class ParsedEmailToParcelService {
  constructor(
    @Inject(PARCEL_REPOSITORY)
    private parcelRepository: IParcelRepository,
  ) {}

  /**
   * Convert ParsedEmail to Parcel and save it
   * Determines if it's a purchase (incoming) or sale (outgoing) based on marketplace
   */
  async createParcelFromParsedEmail(parsedEmail: ParsedEmail): Promise<Parcel | null> {
    if (!parsedEmail.trackingNumber) {
      console.log(`      ⚠️  Skipping: No tracking number`);
      return null;
    }

    console.log(`      📦 Creating parcel from ParsedEmail:`, {
      trackingNumber: parsedEmail.trackingNumber,
      carrier: parsedEmail.carrier,
      marketplace: parsedEmail.marketplace,
      withdrawalCode: parsedEmail.withdrawalCode,
    });

    // Check if parcel already exists
    const existing = await this.parcelRepository.findByTrackingNumber(
      parsedEmail.userId,
      parsedEmail.trackingNumber,
    );

    if (existing) {
      console.log(`      ℹ️  Parcel already exists: ${existing.id}`);
      return existing;
    }

    // Determine type (purchase vs sale)
    // Priority 1: Use type from parser if explicitly detected
    // Priority 2: If marketplace exists = purchase (incoming)
    // Priority 3: Default to sale (outgoing)
    let type: ParcelType = 'sale';
    if (parsedEmail.type) {
      type = parsedEmail.type; // Parser explicitly detected the type
    } else if (parsedEmail.marketplace) {
      type = 'purchase'; // Marketplace emails are usually purchases
    }

    // Map carrier (some differences in naming)
    let carrier: Parcel['carrier'] = 'other';
    if (parsedEmail.carrier === 'dhl') carrier = 'dhl';
    else if (parsedEmail.carrier === 'ups') carrier = 'ups';
    else if (parsedEmail.carrier === 'fedex') carrier = 'fedex';
    else if (parsedEmail.carrier === 'laposte' || parsedEmail.carrier === 'colissimo')
      carrier = 'laposte';
    else if (parsedEmail.carrier === 'chronopost') carrier = 'chronopost';
    else if (parsedEmail.carrier === 'vinted_go') carrier = 'vinted_go';
    else if (parsedEmail.carrier === 'mondial_relay') carrier = 'mondial_relay';

    // Create parcel title from available info
    const title = this.generateTitle(parsedEmail);

    try {
      const parcel = await this.parcelRepository.create({
        userId: parsedEmail.userId,
        trackingNumber: parsedEmail.trackingNumber,
        carrier,
        status: 'pending', // Initial status
        type,
        sourceEmailId: parsedEmail.rawEmailId,
        provider: parsedEmail.provider ?? 'gmail',
        title,
        // Map all metadata fields from ParsedEmail
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
      });

      console.log(`      ✅ Parcel created: ${parcel.id} - "${title}"`);
      return parcel;
    } catch (error) {
      console.error(`      ❌ Failed to create parcel:`, error.message);
      return null;
    }
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
