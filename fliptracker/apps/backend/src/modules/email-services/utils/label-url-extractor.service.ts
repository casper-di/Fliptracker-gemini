import { Injectable } from '@nestjs/common';

/**
 * Extracts label/bordereau download URLs from email HTML/text
 * Looks for PDF links, print links, and download buttons
 */
@Injectable()
export class LabelUrlExtractorService {

  /**
   * Extract the most likely label/bordereau URL from email content
   */
  extractLabelUrl(html: string, text?: string): string | null {
    const urls = [
      ...this.extractFromHrefAttributes(html),
      ...this.extractFromTextPatterns(text || html),
    ];

    // Deduplicate and score
    const unique = [...new Set(urls)];
    const scored = unique
      .map(url => ({ url, score: this.scoreUrl(url) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      console.log(`[LabelUrlExtractor] Found ${scored.length} candidate(s), best: ${scored[0].url.substring(0, 80)}...`);
      return scored[0].url;
    }

    return null;
  }

  /**
   * Extract URLs from <a href="..."> near label/bordereau keywords
   */
  private extractFromHrefAttributes(html: string): string[] {
    const results: string[] = [];
    
    // Pattern: <a ...href="URL"...> near label keywords
    const labelKeywords = [
      'étiquette', 'etiquette', 'bordereau', 'label',
      'imprimer', 'print', 'télécharger', 'download',
      'pdf', 'shipping label', 'bon de transport',
    ];

    // Find all <a> tags with href
    const aTagRegex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = aTagRegex.exec(html)) !== null) {
      const url = match[1];
      const anchorContent = match[2].toLowerCase();
      const anchorFull = match[0].toLowerCase();

      // Check if anchor text or surrounding context mentions labels
      for (const keyword of labelKeywords) {
        if (anchorContent.includes(keyword) || anchorFull.includes(keyword)) {
          if (this.isValidUrl(url)) {
            results.push(url);
          }
          break;
        }
      }
    }

    // Also look for direct PDF links
    const pdfRegex = /href=["'](https?:\/\/[^"']+\.pdf[^"']*)/gi;
    while ((match = pdfRegex.exec(html)) !== null) {
      if (this.isValidUrl(match[1])) {
        results.push(match[1]);
      }
    }

    return results;
  }

  /**
   * Extract URLs from plain text near label keywords
   */
  private extractFromTextPatterns(text: string): string[] {
    const results: string[] = [];
    
    // Look for URLs near label-related words
    const patterns = [
      /(?:étiquette|bordereau|label|imprimer|print|télécharger|download)[^]*?(https?:\/\/[^\s<>"']{10,200})/gi,
      /(https?:\/\/[^\s<>"']{10,200})[^]*?(?:étiquette|bordereau|label|print|pdf)/gi,
    ];

    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const url = match[1];
        if (this.isValidUrl(url)) {
          results.push(url);
        }
      }
    }

    return results;
  }

  /**
   * Score a URL based on how likely it is to be a label/bordereau
   */
  private scoreUrl(url: string): number {
    const lower = url.toLowerCase();
    let score = 0;

    // PDF extension
    if (lower.includes('.pdf')) score += 3;

    // Label/shipping keywords in URL
    if (lower.includes('label')) score += 2;
    if (lower.includes('bordereau')) score += 2;
    if (lower.includes('etiquette') || lower.includes('étiquette')) score += 2;
    if (lower.includes('shipping')) score += 1;
    if (lower.includes('print')) score += 1;
    if (lower.includes('download')) score += 1;

    // Known label service domains
    if (lower.includes('colissimo.fr')) score += 2;
    if (lower.includes('chronopost.fr')) score += 2;
    if (lower.includes('mondialrelay')) score += 2;
    if (lower.includes('vinted')) score += 1;

    // Negative signals (not a label)
    if (lower.includes('unsubscribe')) score -= 5;
    if (lower.includes('tracking') || lower.includes('suivi')) score -= 1;
    if (lower.includes('mailto:')) score -= 5;

    return score;
  }

  private isValidUrl(url: string): boolean {
    if (!url || url.length < 10) return false;
    if (url.startsWith('mailto:')) return false;
    if (url.startsWith('tel:')) return false;
    return url.startsWith('http://') || url.startsWith('https://');
  }
}
