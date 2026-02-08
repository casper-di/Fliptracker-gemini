import { Injectable } from '@nestjs/common';

@Injectable()
export class QRCodeExtractorService {
  /**
   * Extract QR code URL or base64 data from email HTML
   */
  extractQRCode(html: string): string | null {
    console.log('[QRCodeExtractor] Starting extraction, HTML length:', html.length);
    console.log('[QRCodeExtractor] HTML preview (first 500 chars):', html.substring(0, 500));
    
    const strategies = [
      () => this.extractFromAltAttribute(html),
      () => this.extractFromContext(html),
      () => this.extractBase64(html),
      () => this.extractFromSrcset(html),
      () => this.extractFromDataSrc(html),
    ];

    for (let i = 0; i < strategies.length; i++) {
      const strategyName = ['altAttribute', 'context', 'base64', 'srcset', 'dataSrc'][i];
      console.log(`[QRCodeExtractor] Trying strategy ${i + 1}/${strategies.length}: ${strategyName}`);
      
      const qrCode = strategies[i]();
      console.log(`[QRCodeExtractor] Strategy ${strategyName} result:`, qrCode ? `Found: ${qrCode.substring(0, 100)}...` : 'null');
      
      if (qrCode) {
        const isValid = this.isValidQRCodeUrl(qrCode);
        console.log(`[QRCodeExtractor] Validation result:`, isValid);
        
        if (isValid) {
          console.log('[QRCodeExtractor] ✅ Valid QR code found:', qrCode);
          return qrCode;
        } else {
          console.log('[QRCodeExtractor] ❌ Invalid QR code, continuing to next strategy');
        }
      }
    }

    console.log('[QRCodeExtractor] ⚠️ No valid QR code found');
    return null;
  }

  /**
   * Extract from img with alt="QR code" or similar
   */
  private extractFromAltAttribute(html: string): string | null {
    const patterns = [
      // Pattern 1: alt before src
      /<img[^>]*alt=["'](?:QR|qr|code|barcode|Code|QR\s*code|QR\s*Code)[^"']*["'][^>]*src=["']([^"']+)["']/i,
      // Pattern 2: src before alt (most common)
      /<img[^>]*src=["']([^"']+)["'][^>]*alt=["'](?:QR|qr|code|barcode|Code|QR\s*code|QR\s*Code)[^"']*["']/i,
      // Pattern 3: Very simple - any img with src and alt containing "QR" or "code"
      /<img[^>]+src=["']([^"']+)["'][^>]+alt=["'][^"']*(?:QR|qr|code)[^"']*["']/i,
      /<img[^>]+alt=["'][^"']*(?:QR|qr|code)[^"']*["'][^>]+src=["']([^"']+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        console.log('[QRCodeExtractor] extractFromAltAttribute matched:', match[1].substring(0, 100));
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Extract from context (near "QR" text)
   */
  private extractFromContext(html: string): string | null {
    const contextPattern = /(?:QR|qr|code|barcode)[\s\S]{0,200}?<img[^>]*(?:src|data-src)=["']([^"']+)["']/i;
    const match = html.match(contextPattern);
    if (match && match[1]) {
      console.log('[QRCodeExtractor] extractFromContext (contextPattern) matched:', match[1].substring(0, 100));
      return match[1].trim();
    }

    // Try reverse pattern (alt first, then src) for Chronopost emails
    const altFirstPattern = /<img[^>]*alt=["'](?:QR code|Pickup Pass|code qr)[^"']*["'][^>]*(?:src|data-src)=["']([^"']+)["']/i;
    const altMatch = html.match(altFirstPattern);
    if (altMatch && altMatch[1]) {
      console.log('[QRCodeExtractor] extractFromContext (altFirstPattern) matched:', altMatch[1].substring(0, 100));
      return altMatch[1].trim();
    }

    // Try barcode API URLs (avisageng-colis-webexternal, etc.)
    const barcodeApiPattern = /<img[^>]*(?:src|data-src)=["']([^"']*(?:barcode|aztec|pickup-services)[^"']*)[^>]*alt=["'](?:QR code|Pickup Pass|code|qr)[^"']*["']/i;
    const apiMatch = html.match(barcodeApiPattern);
    if (apiMatch && apiMatch[1]) {
      console.log('[QRCodeExtractor] extractFromContext (barcodeApiPattern) matched:', apiMatch[1].substring(0, 100));
      return apiMatch[1].trim();
    }

    console.log('[QRCodeExtractor] extractFromContext: no match');
    return null;
  }

  /**
   * Extract base64 inline images
   */
  private extractBase64(html: string): string | null {
    const base64Pattern = /<img[^>]*src=["'](data:image\/(?:png|jpg|jpeg|gif|webp);base64,[A-Za-z0-9+/=]{50,})["']/i;
    const match = html.match(base64Pattern);
    if (match && match[1]) {
      return match[1];
    }

    return null;
  }

  /**
   * Extract from srcset attribute
   */
  private extractFromSrcset(html: string): string | null {
    const srcsetPattern = /<img[^>]*srcset=["']([^"'\s]+)[^"']*["'][^>]*(?:alt=["'][^"']*(?:qr|QR|code)[^"']*["'])?/i;
    const match = html.match(srcsetPattern);
    if (match && match[1]) {
      // Take first URL from srcset
      const firstUrl = match[1].split(',')[0].trim().split(' ')[0];
      return firstUrl;
    }

    return null;
  }

  /**
   * Extract from data-src (lazy loading)
   */
  private extractFromDataSrc(html: string): string | null {
    const dataSrcPattern = /<img[^>]*data-src=["']([^"']+)["'][^>]*(?:alt=["'][^"']*(?:qr|QR|code)[^"']*["'])?/i;
    const match = html.match(dataSrcPattern);
    if (match && match[1]) {
      return match[1].trim();
    }

    return null;
  }

  /**
   * Validate if extracted value looks like a valid QR code URL/data
   */
  private isValidQRCodeUrl(url: string): boolean {
    if (!url || url.length < 10) {
      console.log('[QRCodeExtractor] Validation failed: URL too short or empty');
      return false;
    }

    // Valid base64 data URI
    if (/^data:image\/[^;]+;base64,/.test(url)) {
      console.log('[QRCodeExtractor] Validation passed: base64 data URI');
      return true;
    }

    // Valid HTTP(S) URL
    if (/^https?:\/\/.+/.test(url)) {
      console.log('[QRCodeExtractor] Validation passed: HTTP(S) URL');
      return true;
    }

    // Relative URL with image extension
    if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url)) {
      console.log('[QRCodeExtractor] Validation passed: image extension');
      return true;
    }

    console.log('[QRCodeExtractor] Validation failed: no matching pattern for:', url.substring(0, 100));
    return false;
  }
}
