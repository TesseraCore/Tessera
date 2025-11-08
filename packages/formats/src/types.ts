/**
 * Format types and interfaces
 */

import type { TileSource } from '@tessera/rendering';

/**
 * Format metadata
 */
export interface FormatMetadata {
  /** Format identifier */
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
  supportsTiling: boolean;
  /** Whether format supports multi-resolution pyramids */
  supportsPyramids: boolean;
  /** Whether format supports multi-channel images */
  supportsMultiChannel: boolean;
}

/**
 * Format configuration options
 */
export interface FormatConfig {
  /** Format-specific options */
  [key: string]: any;
}

/**
 * Format parser interface
 */
export interface FormatParser {
  /** Format metadata */
  readonly metadata: FormatMetadata;
  
  /** Check if parser can handle the given source */
  canParse(source: string | ArrayBuffer | File): Promise<boolean>;
  
  /** Parse format and create tile source */
  parse(
    source: string | ArrayBuffer | File,
    config?: FormatConfig
  ): Promise<TileSource>;
  
  /** Get format metadata */
  getMetadata(source: string | ArrayBuffer | File): Promise<FormatMetadata>;
}

/**
 * Custom format registration
 */
export interface CustomFormatRegistration {
  /** Format identifier */
  id: string;
  /** Format parser implementation */
  parser: FormatParser;
  /** Priority (higher = checked first) */
  priority?: number;
}

