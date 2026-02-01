import { Injectable } from '@nestjs/common';
import { findTracking, getTracking } from 'ts-tracking-number';

/**
 * Service d'extraction intelligente de numéros de suivi
 * Utilise ts-tracking-number pour détecter automatiquement 100+ formats
 */
@Injectable()
export class TrackingNumberExtractorService {

  /**
   * Extrait tous les numéros de suivi potentiels d'un texte
   * @param text - Texte à analyser (email body, subject, etc.)
   * @returns Array de numéros de suivi détectés avec leur transporteur
   */
  extractTrackingNumbers(text: string): Array<{
    trackingNumber: string;
    carrier: string;
    confidence: 'high' | 'medium' | 'low';
  }> {
    const results: Array<{
      trackingNumber: string;
      carrier: string;
      confidence: 'high' | 'medium' | 'low';
    }> = [];

    try {
      // Utiliser ts-tracking-number pour détecter automatiquement
      const detected = findTracking(text);

      if (detected && Array.isArray(detected)) {
        for (const item of detected) {
          if (item.trackingNumber) {
            results.push({
              trackingNumber: item.trackingNumber,
              carrier: this.normalizeCarrier(item.courier?.name || 'unknown'),
              confidence: this.calculateConfidence(item),
            });
          }
        }
      }
    } catch (error) {
      console.error('[TrackingNumberExtractor] Error detecting tracking numbers:', error);
    }

    // Fallback: regex patterns personnalisés pour transporteurs français
    if (results.length === 0) {
      const customResults = this.extractWithCustomPatterns(text);
      results.push(...customResults);
    }

    // Dédupliquer et retourner
    return this.deduplicateResults(results);
  }

  /**
   * Extrait le meilleur numéro de suivi (le plus probable)
   */
  extractBestTrackingNumber(text: string): string | null {
    const results = this.extractTrackingNumbers(text);
    
    if (results.length === 0) return null;

    // Trier par confiance (high > medium > low)
    const sorted = results.sort((a, b) => {
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    });

    return sorted[0].trackingNumber;
  }

  /**
   * Patterns personnalisés pour transporteurs français
   */
  private extractWithCustomPatterns(text: string): Array<{
    trackingNumber: string;
    carrier: string;
    confidence: 'high' | 'medium' | 'low';
  }> {
    const results: Array<{
      trackingNumber: string;
      carrier: string;
      confidence: 'high' | 'medium' | 'low';
    }> = [];

    // Colissimo: 6A/6V/7A/8A/8V + 11 chiffres
    const colissimoPattern = /\b([6-8][AV]\d{11})\b/g;
    let match;
    while ((match = colissimoPattern.exec(text)) !== null) {
      results.push({
        trackingNumber: match[1],
        carrier: 'colissimo',
        confidence: 'high',
      });
    }

    // Colissimo international: RR/LA + 9 chiffres + FR
    const colissimoIntlPattern = /\b([RL][A-Z]\d{9}[A-Z]{2})\b/g;
    while ((match = colissimoIntlPattern.exec(text)) !== null) {
      results.push({
        trackingNumber: match[1],
        carrier: 'colissimo',
        confidence: 'high',
      });
    }

    // UPS: 1Z format
    const upsPattern = /\b(1Z[A-Z0-9]{16})\b/g;
    while ((match = upsPattern.exec(text)) !== null) {
      results.push({
        trackingNumber: match[1],
        carrier: 'ups',
        confidence: 'high',
      });
    }

    // DHL Express: 10-11 chiffres
    const dhlPattern = /\b(\d{10,11})\b/g;
    while ((match = dhlPattern.exec(text)) !== null) {
      if (text.toLowerCase().includes('dhl')) {
        results.push({
          trackingNumber: match[1],
          carrier: 'dhl',
          confidence: 'medium',
        });
      }
    }

    // Mondial Relay: Format variable, souvent 8-12 chiffres
    const mondialRelayPattern = /\b(\d{8,12})\b/g;
    while ((match = mondialRelayPattern.exec(text)) !== null) {
      if (text.toLowerCase().includes('mondial relay') || text.toLowerCase().includes('relais')) {
        results.push({
          trackingNumber: match[1],
          carrier: 'mondial_relay',
          confidence: 'medium',
        });
      }
    }

    return results;
  }

  /**
   * Normalise le nom du transporteur pour correspondre au CarrierType
   */
  private normalizeCarrier(carrier: string): string {
    const normalized = carrier.toLowerCase().replace(/\s+/g, '_');

    const mapping: Record<string, string> = {
      usps: 'usps',
      ups: 'ups',
      fedex: 'fedex',
      dhl: 'dhl',
      'dhl_express': 'dhl',
      amazon: 'amazon_logistics',
      ontrac: 'ontrac',
      lasership: 'lasership',
      'canada_post': 'canada_post',
      'royal_mail': 'royal_mail',
      'australia_post': 'australia_post',
    };

    return mapping[normalized] || normalized;
  }

  /**
   * Calcule le niveau de confiance pour une détection
   */
  private calculateConfidence(item: any): 'high' | 'medium' | 'low' {
    // Si le numéro a été validé avec succès
    if (item.valid === true) return 'high';
    
    // Si on a le transporteur mais pas de validation
    if (item.courier && item.courier.name && item.courier.name !== 'unknown') return 'medium';
    
    return 'low';
  }

  /**
   * Déduplique les résultats
   */
  private deduplicateResults(
    results: Array<{
      trackingNumber: string;
      carrier: string;
      confidence: 'high' | 'medium' | 'low';
    }>,
  ): Array<{
    trackingNumber: string;
    carrier: string;
    confidence: 'high' | 'medium' | 'low';
  }> {
    const seen = new Set<string>();
    const deduplicated: Array<{
      trackingNumber: string;
      carrier: string;
      confidence: 'high' | 'medium' | 'low';
    }> = [];

    for (const result of results) {
      if (!seen.has(result.trackingNumber)) {
        seen.add(result.trackingNumber);
        deduplicated.push(result);
      }
    }

    return deduplicated;
  }
}
