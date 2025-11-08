/**
 * Format registry for custom formats
 */

import type {
  CustomFormatRegistration,
  FormatParser,
} from './types.js';

/**
 * Format registry for managing custom formats
 */
export class FormatRegistry {
  private formats = new Map<string, FormatParser>();
  private customFormats: Array<{ registration: CustomFormatRegistration; parser: FormatParser }> = [];

  /**
   * Register a custom format
   */
  register(registration: CustomFormatRegistration): void {
    if (this.formats.has(registration.id)) {
      throw new Error(`Format '${registration.id}' is already registered`);
    }

    this.formats.set(registration.id, registration.parser);
    
    // Add to custom formats list with priority
    this.customFormats.push({
      registration,
      parser: registration.parser,
    });
    
    // Sort by priority (higher first)
    this.customFormats.sort((a, b) => {
      const priorityA = a.registration.priority ?? 0;
      const priorityB = b.registration.priority ?? 0;
      return priorityB - priorityA;
    });
  }

  /**
   * Unregister a custom format
   */
  unregister(formatId: string): boolean {
    const removed = this.formats.delete(formatId);
    if (removed) {
      this.customFormats = this.customFormats.filter(
        (item) => item.registration.id !== formatId
      );
    }
    return removed;
  }

  /**
   * Get parser for a format ID
   */
  get(formatId: string): FormatParser | undefined {
    return this.formats.get(formatId);
  }

  /**
   * Get all registered format IDs
   */
  getAllIds(): string[] {
    return Array.from(this.formats.keys());
  }

  /**
   * Find parser that can handle the source
   */
  async findParser(
    source: string | ArrayBuffer | File
  ): Promise<FormatParser | null> {
    // Check custom formats first (sorted by priority)
    for (const { parser } of this.customFormats) {
      if (await parser.canParse(source)) {
        return parser;
      }
    }

    return null;
  }

  /**
   * Check if format is registered
   */
  has(formatId: string): boolean {
    return this.formats.has(formatId);
  }

  /**
   * Clear all custom formats
   */
  clear(): void {
    this.formats.clear();
    this.customFormats = [];
  }
}

/**
 * Global format registry instance
 */
export const formatRegistry = new FormatRegistry();

