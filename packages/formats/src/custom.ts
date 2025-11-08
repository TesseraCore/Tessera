/**
 * Custom format support and utilities
 */

import { BaseFormatParser } from './base.js';
import type { FormatConfig, FormatMetadata, FormatParser } from './types.js';
import type { TileSource } from '@tessera/rendering';
import { formatRegistry } from './registry.js';

/**
 * Options for creating a custom format parser
 */
export interface CustomFormatOptions {
  /** Format identifier (must be unique) */
  id: string;
  /** Human-readable format name */
  name: string;
  /** Format description */
  description?: string;
  /** Supported MIME types */
  mimeTypes?: string[];
  /** File extensions */
  extensions?: string[];
  /** Whether format supports tiling */
  supportsTiling?: boolean;
  /** Whether format supports multi-resolution pyramids */
  supportsPyramids?: boolean;
  /** Whether format supports multi-channel images */
  supportsMultiChannel?: boolean;
  /** Priority for format detection (higher = checked first) */
  priority?: number;
  /** Function to check if parser can handle the source */
  canParse: (source: string | ArrayBuffer | File) => Promise<boolean>;
  /** Function to parse format and create tile source */
  parse: (
    source: string | ArrayBuffer | File,
    config?: FormatConfig
  ) => Promise<TileSource>;
}

/**
 * Create a custom format parser from options
 */
export function createCustomFormat(options: CustomFormatOptions): FormatParser {
  const metadata: FormatMetadata = {
    id: options.id,
    name: options.name,
    description: options.description,
    mimeTypes: options.mimeTypes,
    extensions: options.extensions,
    supportsTiling: options.supportsTiling ?? false,
    supportsPyramids: options.supportsPyramids ?? false,
    supportsMultiChannel: options.supportsMultiChannel ?? false,
  };

  class CustomFormatParser extends BaseFormatParser {
    readonly metadata = metadata;

    async canParse(source: string | ArrayBuffer | File): Promise<boolean> {
      return options.canParse(source);
    }

    async parse(
      source: string | ArrayBuffer | File,
      config?: FormatConfig
    ): Promise<TileSource> {
      return options.parse(source, config);
    }
  }

  const parser = new CustomFormatParser();

  // Register the custom format
  formatRegistry.register({
    id: options.id,
    parser,
    priority: options.priority,
  });

  return parser;
}

/**
 * Example: Create a custom format parser for a simple image URL format
 */
export function createSimpleImageFormat(
  id: string,
  extensions: string[],
  mimeTypes: string[]
): FormatParser {
  return createCustomFormat({
    id,
    name: id.toUpperCase(),
    extensions,
    mimeTypes,
    supportsTiling: false,
    supportsPyramids: false,
    supportsMultiChannel: false,
    canParse: async (source) => {
      if (typeof source === 'string') {
        const url = source.toLowerCase();
        return extensions.some((ext) => url.endsWith(`.${ext}`));
      }
      if (source instanceof File) {
        const name = source.name.toLowerCase();
        return extensions.some((ext) => name.endsWith(`.${ext}`));
      }
      return false;
    },
    parse: async (source, config) => {
      if (typeof source !== 'string') {
        throw new Error(`${id} parser only supports URL sources`);
      }

      // Create a simple HTTP tile source for the image
      const { HTTPTileSource } = await import('./sources/http-source.js');
      return new HTTPTileSource({
        baseUrl: source,
        tileSize: config?.tileSize ?? 256,
        headers: config?.headers,
        getTileUrl: () => source,
        getImageSize: async () => {
          const img = new Image();
          img.src = source;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          return [img.width, img.height];
        },
        getLevelCount: async () => 1,
      });
    },
  });
}

