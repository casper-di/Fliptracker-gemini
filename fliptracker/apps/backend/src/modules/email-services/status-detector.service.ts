import { Injectable } from '@nestjs/common';
import { ParcelStatus } from '../../domain/entities/parcel.entity';

/**
 * Service to detect parcel status from email content
 */
@Injectable()
export class StatusDetectorService {
  /**
   * Detect the current status of a parcel based on email content
   */
  detectStatus(email: { subject: string; body: string }): ParcelStatus {
    const combined = `${email.subject} ${email.body}`.toLowerCase();

    // Pattern 1: Ready for pickup / Waiting at pickup point
    const readyForPickupPatterns = [
      /vous attend/i,
      /votre colis.*est.*disponible/i,
      /ready to pick up/i,
      /ready for pickup/i,
      /available.*for.*pickup/i,
      /retirer.*votre.*colis/i,
      /awaiting collection/i,
      /en attente de retrait/i,
      /pickup.*pass/i,
    ];

    for (const pattern of readyForPickupPatterns) {
      if (pattern.test(combined)) {
        return 'delivered'; // Available for pickup = delivered to pickup point
      }
    }

    // Pattern 2: Delivered / Received
    const deliveredPatterns = [
      /(?:a été|has been|wurde).*(?:livré|delivered|geliefert)/i,
      /remis.*(?:destinataire|recipient)/i,
      /successfully delivered/i,
      /(?:livraison|delivery).*(?:effectuée|completed)/i,
      /colis.*reçu/i,
      /signé par/i,
      /signed by/i,
    ];

    for (const pattern of deliveredPatterns) {
      if (pattern.test(combined)) {
        return 'delivered';
      }
    }

    // Pattern 3: In transit / On the way
    const inTransitPatterns = [
      /en.*(?:cours|transit|route)/i,
      /in.*transit/i,
      /on.*(?:the|its).*way/i,
      /(?:expédié|shipped|versandt)/i,
      /(?:acheminé|dispatched)/i,
      /out.*for.*delivery/i,
      /en tournée/i,
    ];

    for (const pattern of inTransitPatterns) {
      if (pattern.test(combined)) {
        return 'in_transit';
      }
    }

    // Pattern 4: Returned / Return to sender
    const returnedPatterns = [
      /(?:retourné|returned|zurück)/i,
      /return.*to.*sender/i,
      /renvoyé.*expéditeur/i,
      /not.*collected/i,
      /non.*retiré/i,
    ];

    for (const pattern of returnedPatterns) {
      if (pattern.test(combined)) {
        return 'returned';
      }
    }

    // Default: pending (initial state)
    return 'pending';
  }
}
