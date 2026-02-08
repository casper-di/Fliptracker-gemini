import { Injectable } from '@nestjs/common';

@Injectable()
export class DateParserService {
  private readonly monthsFR: Record<string, number> = {
    janvier: 0, février: 1, fevrier: 1, mars: 2, avril: 3,
    mai: 4, juin: 5, juillet: 6, août: 7, aout: 7,
    septembre: 8, octobre: 9, novembre: 10, décembre: 11, decembre: 11,
  };

  private readonly monthsEN: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };

  private readonly monthsES: Record<string, number> = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  };

  /**
   * Parse date from text (supports multiple formats and languages)
   */
  parseDate(text: string, referenceDate: Date = new Date()): Date | null {
    const strategies = [
      () => this.parseRelativeDate(text, referenceDate),
      () => this.parseLongFormat(text),
      () => this.parseNumericFormat(text),
      () => this.parseISOFormat(text),
    ];

    for (const strategy of strategies) {
      const date = strategy();
      if (date && !isNaN(date.getTime())) {
        return date;
      }
    }

    return null;
  }

  /**
   * Parse relative dates: "demain", "dans 2 jours", "tomorrow"
   */
  private parseRelativeDate(text: string, reference: Date): Date | null {
    const lower = text.toLowerCase();

    // Today
    if (/aujourd'hui|today|hoy/.test(lower)) {
      return new Date(reference);
    }

    // Tomorrow
    if (/demain|tomorrow|mañana/.test(lower)) {
      const date = new Date(reference);
      date.setDate(date.getDate() + 1);
      return date;
    }

    // In X days
    const daysMatch = lower.match(/(?:dans|in|en)\s+(\d+)\s+(?:jours?|days?|días?)/);
    if (daysMatch) {
      const days = parseInt(daysMatch[1], 10);
      const date = new Date(reference);
      date.setDate(date.getDate() + days);
      return date;
    }

    return null;
  }

  /**
   * Parse long format: "15 janvier 2026", "January 15, 2026"
   */
  private parseLongFormat(text: string): Date | null {
    const lower = text.toLowerCase();

    // French: "15 janvier 2026" or "jusqu'au samedi 20 décembre 2025"
    const frMatch = lower.match(/(?:jusqu[\']?au?\s+)?(?:\w+\s+)?(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/);
    if (frMatch) {
      const day = parseInt(frMatch[1], 10);
      const month = this.monthsFR[frMatch[2]];
      const year = parseInt(frMatch[3], 10);
      if (month !== undefined) {
        return new Date(year, month, day);
      }
    }

    // English: "January 15, 2026" or "15 January 2026"
    const enMatch1 = lower.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/);
    if (enMatch1) {
      const month = this.monthsEN[enMatch1[1]];
      const day = parseInt(enMatch1[2], 10);
      const year = parseInt(enMatch1[3], 10);
      if (month !== undefined) {
        return new Date(year, month, day);
      }
    }

    const enMatch2 = lower.match(/(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/);
    if (enMatch2) {
      const day = parseInt(enMatch2[1], 10);
      const month = this.monthsEN[enMatch2[2]];
      const year = parseInt(enMatch2[3], 10);
      if (month !== undefined) {
        return new Date(year, month, day);
      }
    }

    // Spanish: "15 de enero de 2026"
    const esMatch = lower.match(/(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/);
    if (esMatch) {
      const day = parseInt(esMatch[1], 10);
      const month = this.monthsES[esMatch[2]];
      const year = parseInt(esMatch[3], 10);
      if (month !== undefined) {
        return new Date(year, month, day);
      }
    }

    return null;
  }

  /**
   * Parse numeric formats: DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY, MM/DD/YYYY
   */
  private parseNumericFormat(text: string): Date | null {
    // European format: DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY
    const euMatch = text.match(/(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})/);
    if (euMatch) {
      const day = parseInt(euMatch[1], 10);
      const month = parseInt(euMatch[2], 10) - 1;
      let year = parseInt(euMatch[3], 10);
      
      // Handle 2-digit year
      if (year < 100) {
        year += 2000;
      }

      // Validate day/month ranges
      if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
        return new Date(year, month, day);
      }
    }

    return null;
  }

  /**
   * Parse ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
   */
  private parseISOFormat(text: string): Date | null {
    const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2})?/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      return new Date(year, month, day);
    }

    return null;
  }
}
