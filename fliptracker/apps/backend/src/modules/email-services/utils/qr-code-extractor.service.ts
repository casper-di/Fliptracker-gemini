import { Injectable } from '@nestjs/common';

@Injectable()
export class QRCodeExtractorService {
  /**
   * Extract QR code URL or base64 data from email HTML
   */
  extractQRCode(html: string): string | null {
    console.log('[QRCodeExtractor] Starting extraction, HTML length:', html.length);
    console.log('[QRCodeExtractor] HTML preview (first 500 chars):', html.substring(0, 500));
    
    // Check if there's an img tag with QR in the HTML
    const hasImgTag = /<img/i.test(html);
    const hasQRText = /qr|code|barcode/i.test(html);
    const hasAvisageng = /avisageng-colis-webexternal|pickup-services/.test(html);
    console.log('[QRCodeExtractor] HTML content check:', { hasImgTag, hasQRText, hasAvisageng });
    
    // If HTML contains "avisageng" or "pickup-services", search specifically for it
    if (hasAvisageng) {
      console.log('[QRCodeExtractor] Detected Chronopost Pickup email, using direct URL extraction');
      const directUrlMatch = html.match(/https?:\/\/[^"'\s]*(?:avisageng-colis-webexternal|pickup-services)[^"'\s]*/i);
      if (directUrlMatch) {
        console.log('[QRCodeExtractor] ✅ Direct URL extraction successful:', directUrlMatch[0].substring(0, 100));
        return directUrlMatch[0].trim();
      }
    }
    
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
      // Pattern 5: Even simpler - just look for src with pickup/barcode/aztec in URL
      /<img[^>]*src=["']([^"']*(?:barcode|aztec|pickup|qr)[^"']*)["']/i,
    ];

    for (let i = 0; i < patterns.length; i++) {
      const match = html.match(patterns[i]);
      if (match && match[1]) {
        console.log(`[QRCodeExtractor] extractFromAltAttribute pattern ${i + 1} matched:`, match[1].substring(0, 100));
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

    // Reject known non-QR images (logos, icons, trackers)
    const rejectPatterns = [
      /logo/i,
      /icon/i,
      /banner/i,
      /header/i,
      /footer/i,
      /email_open_track/i,
      /pixel/i,
      /spacer/i,
      /assets\/.*\.(png|jpg|gif)$/i, // Generic asset images (logos in /assets/ folder)
    ];
    
    if (rejectPatterns.some(p => p.test(url))) {
      console.log('[QRCodeExtractor] Validation failed: URL matches reject pattern (logo/icon/etc.):', url.substring(0, 100));
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
