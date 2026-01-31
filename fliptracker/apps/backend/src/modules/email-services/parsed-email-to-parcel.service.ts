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

    // Determine type (purchase vs sale) based on marketplace
    // Marketplace emails (Amazon, eBay, etc) = purchases (incoming)
    // If no marketplace detected = could be sale (outgoing)
    const type: ParcelType = parsedEmail.marketplace ? 'purchase' : 'sale';

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
   */
  private generateTitle(parsedEmail: ParsedEmail): string {
    const parts: string[] = [];

    // Prioritize product name if available
    if (parsedEmail.productName) {
      parts.push(parsedEmail.productName);
    } else if (parsedEmail.marketplace) {
      // Fallback to marketplace if no product name
      const marketplaceLabel = parsedEmail.marketplace.charAt(0).toUpperCase() + parsedEmail.marketplace.slice(1);
      parts.push(marketplaceLabel);
    }

    // Add carrier with nice labels
    if (parsedEmail.carrier) {
      let carrierLabel = parsedEmail.carrier.toUpperCase();
      if (parsedEmail.carrier === 'vinted_go') carrierLabel = 'VINTED GO';
      if (parsedEmail.carrier === 'mondial_relay') carrierLabel = 'MONDIAL RELAY';
      if (parsedEmail.carrier === 'chronopost') carrierLabel = 'CHRONOPOST';
      if (parsedEmail.carrier === 'laposte') carrierLabel = 'LA POSTE';
      if (parsedEmail.carrier === 'colissimo') carrierLabel = 'COLISSIMO';
      parts.push(carrierLabel);
    }

    // Add recipient name if available and not already in product
    if (parsedEmail.recipientName && !parsedEmail.productName) {
      parts.push(`pour ${parsedEmail.recipientName}`);
    }

    // Add article ID if available
    if (parsedEmail.articleId) {
      parts.push(`Ref: ${parsedEmail.articleId}`);
    }

    // Add withdrawal code
    if (parsedEmail.withdrawalCode) {
      parts.push(`Code: ${parsedEmail.withdrawalCode}`);
    }

    // Fallback: use tracking number
    if (parts.length === 0) {
      parts.push(`Colis ${parsedEmail.trackingNumber?.substring(0, 10) || 'inconnu'}`);
    }

    const title = parts.join(' · ');
    console.log(`      📝 Generated title: "${title}"`);
    return title;
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
