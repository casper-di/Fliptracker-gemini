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
      return null;
    }

    // Check if parcel already exists
    const existing = await this.parcelRepository.findByTrackingNumber(
      parsedEmail.userId,
      parsedEmail.trackingNumber,
    );

    if (existing) {
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
        provider: 'gmail', // TODO: get from RawEmail
        title,
      });

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

    if (parsedEmail.marketplace) {
      parts.push(parsedEmail.marketplace.charAt(0).toUpperCase() + parsedEmail.marketplace.slice(1));
    }

    if (parsedEmail.articleId) {
      parts.push(`Article ${parsedEmail.articleId}`);
    }

    if (parsedEmail.carrier) {
      parts.push(parsedEmail.carrier.toUpperCase());
    }

    if (parsedEmail.withdrawalCode) {
      parts.push(`(Point relais: ${parsedEmail.withdrawalCode})`);
    }

    if (parts.length === 0) {
      parts.push(`Colis ${parsedEmail.trackingNumber?.substring(0, 10) || 'inconnu'}`);
    }

    return parts.join(' - ');
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
