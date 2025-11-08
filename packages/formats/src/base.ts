/**
 * Base format parser implementation
 */

import type { TileSource, TileSourceOptions } from '@tessera/rendering';
import type { FormatConfig, FormatMetadata, FormatParser } from './types.js';

/**
 * Abstract base class for format parsers
 */
export abstract class BaseFormatParser implements FormatParser {
  abstract readonly metadata: FormatMetadata;

  /**
   * Check if parser can handle the given source
   */
  abstract canParse(source: string | ArrayBuffer | File): Promise<boolean>;

  /**
   * Parse format and create tile source
   */
  abstract parse(
    source: string | ArrayBuffer | File,
    config?: FormatConfig
  ): Promise<TileSource>;

  /**
   * Get format metadata
   */
  async getMetadata(source: string | ArrayBuffer | File): Promise<FormatMetadata> {
    return this.metadata;
  }

  /**
   * Create tile source options from config
   */
  protected createTileSourceOptions(
    config?: FormatConfig
  ): Partial<TileSourceOptions> {
    return {
      tileSize: config?.tileSize ?? 256,
      headers: config?.headers,
      ...config,
    };
  }

}

