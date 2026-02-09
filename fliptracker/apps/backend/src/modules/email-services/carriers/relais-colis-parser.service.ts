import { Injectable } from '@nestjs/common';
import { ParsedTrackingInfo } from '../email-parsing.service';
import { ShipmentTypeDetectorService } from '../shipment-type-detector.service';
import { WithdrawalCodeExtractorService } from '../utils/withdrawal-code-extractor.service';

/**
 * Parser spécialisé pour Relais Colis (différent de Mondial Relay)
 * Email type: Notification de colis disponible en point relais
 */
@Injectable()
export class RelaisColisParserService {
  constructor(
    private shipmentTypeDetector: ShipmentTypeDetectorService,
    private withdrawalCodeExtractor: WithdrawalCodeExtractorService,
  ) {}

  /**
   * Parse un email Relais Colis pour extraire les informations de retrait
   */
  parse(email: { subject: string; from: string; body: string; receivedAt: Date }): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = {
      carrier: 'relais_colis',
      marketplace: null,
      type: this.shipmentTypeDetector.detectType(email),
    };

    const bodyOriginal = email.body;

    // 1. Extraction du numéro de suivi Relais Colis
    // Format: VD + 10 chiffres (ex: VD3480002988)
    const trackingPatterns = [
      /<font[^>]*color\s*=\s*["']#ef354a["'][^>]*>\s*(VD\d{10})\s*<\/font>/i,
      /VD(\d{10})/i,
      /tracking[\s:]*VD(\d{10})/gi,
    ];

    for (const pattern of trackingPatterns) {
      const match = bodyOriginal.match(pattern);
      if (match) {
        result.trackingNumber = match[1] || `VD${match[1]}`;
        // S'assurer que le format est correct
        if (!result.trackingNumber.startsWith('VD')) {
          result.trackingNumber = `VD${result.trackingNumber}`;
        }
        break;
      }
    }

    // 2. Extraction de la marketplace/sender (VINTED, etc.)
    // Apparaît juste avant le numéro de tracking dans l'email
    const marketplacePatterns = [
      /<font[^>]*color\s*=\s*["']#ef354a["'][^>]*>\s*([A-Z]+)\s*<\/font>[\s\S]{0,200}?<font[^>]*>VD\d+<\/font>/i,
      /R[eé]f[eé]rence\s+colis[\s\S]{0,100}?<font[^>]*>\s*([A-Z]+)\s*<\/font>/i,
    ];

    for (const pattern of marketplacePatterns) {
      const match = bodyOriginal.match(pattern);
      if (match && match[1]) {
        const marketplace = match[1].trim();
        if (marketplace.length > 2 && marketplace !== 'COLIS') {
          result.marketplace = marketplace.toLowerCase();
          result.senderName = marketplace;
          break;
        }
      }
    }

    // 3. Extraction de l'adresse du point relais
    // Format HTML: <font color="#ef354a">NOM POINT RELAIS</font><br>
    //              <font>ADRESSE RUE<br>CODE POSTAL VILLE</font>
    const addressPattern = /<font[^>]*color\s*=\s*["']#ef354a["'][^>]*>\s*([^<]+)\s*<\/font>\s*<br>\s*<a[^>]*>\s*<font[^>]*>\s*([^<]+)<br>\s*([^<]+)\s*<\/font>/i;
    const addressMatch = bodyOriginal.match(addressPattern);
    
    if (addressMatch) {
      const pointName = addressMatch[1].trim();
      const street = addressMatch[2].trim();
      const cityPostal = addressMatch[3].trim();
      result.pickupAddress = `${pointName}\n${street}\n${cityPostal}`;
    }

    // 4. Extraction du QR Code (URL de l'image)
    const qrPatterns = [
      /<img\s+src\s*=\s*["']\s*(https:\/\/service\.relaiscolis\.com\/Pages\/qrcodeencrypt\.aspx[^"']+)["']/i,
      /src\s*=\s*["']\s*([^"']*qrcodeencrypt[^"']+)["']/i,
    ];

    for (const pattern of qrPatterns) {
      const match = bodyOriginal.match(pattern);
      if (match && match[1]) {
        result.qrCode = match[1].trim();
        break;
      }
    }

    // 5. Extraction de la deadline de retrait
    // Format français: "jusqu'au 30 décembre" ou "jusqu'au DD/MM/YYYY"
    const deadlinePatterns = [
      /jusqu['']au\s+(\d{1,2})\s+(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)/i,
      /jusqu['']au\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    ];

    const monthMap: Record<string, string> = {
      'janvier': '01', 'février': '02', 'fevrier': '02', 'mars': '03',
      'avril': '04', 'mai': '05', 'juin': '06', 'juillet': '07',
      'août': '08', 'aout': '08', 'septembre': '09', 'octobre': '10',
      'novembre': '11', 'décembre': '12', 'decembre': '12',
    };

    for (const pattern of deadlinePatterns) {
      const match = bodyOriginal.match(pattern);
      if (match) {
        try {
          if (match[2]) {
            // Format "30 décembre"
            const day = match[1].padStart(2, '0');
            const month = monthMap[match[2].toLowerCase()];
            const year = email.receivedAt.getFullYear();
            result.pickupDeadline = new Date(`${year}-${month}-${day}`);
          } else {
            // Format "30/12/2025"
            const parts = match[1].split('/');
            if (parts.length === 3) {
              const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
              result.pickupDeadline = new Date(`${year}-${parts[1]}-${parts[0]}`);
            }
          }
          break;
        } catch (e) {
          // Ignore invalid dates
        }
      }
    }

    // Note: Relais Colis primarily uses QR Code, but some emails include a numeric withdrawal code
    result.withdrawalCode = this.withdrawalCodeExtractor.extractCode(bodyOriginal, bodyOriginal);

    return result;
  }
}
