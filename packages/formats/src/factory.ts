/**
 * Tile source factory for creating tile sources from various formats
 */

import type { TileSource } from '@tessera/rendering';
import type { FormatConfig, FormatParser } from './types.js';
import { formatRegistry } from './registry.js';
import { TIFFParser } from './tiff/parser.js';
import { ZarrParser } from './zarr/parser.js';
import { DICOMParser } from './dicom/parser.js';
import { IIIFParser } from './iiif/parser.js';
import { JPEGParser } from './jpeg/parser.js';
import { PNGParser } from './png/parser.js';
import { WebPParser } from './webp/parser.js';
import { NIfTIParser } from './nifti/parser.js';
import { NRRDParser } from './nrrd/parser.js';
import { HDF5Parser } from './hdf5/parser.js';

/**
 * Built-in format parsers
 */
const builtInParsers = new Map<string, FormatParser>([
  ['tiff', new TIFFParser()],
  ['zarr', new ZarrParser()],
  ['dicom', new DICOMParser()],
  ['iiif', new IIIFParser()],
  ['jpeg', new JPEGParser()],
  ['jpg', new JPEGParser()],
  ['png', new PNGParser()],
  ['webp', new WebPParser()],
  ['nifti', new NIfTIParser()],
  ['nii', new NIfTIParser()],
  ['nrrd', new NRRDParser()],
  ['hdf5', new HDF5Parser()],
]);

/**
 * Create a tile source from a format source
 */
export async function createTileSource(
  source: string | ArrayBuffer | File,
  options?: {
    format?: string;
    config?: FormatConfig;
  }
): Promise<TileSource> {
  let parser: FormatParser | undefined;

  // If format is specified, use it
  if (options?.format) {
    parser = builtInParsers.get(options.format.toLowerCase());
    if (!parser) {
      parser = formatRegistry.get(options.format);
    }
    
    if (!parser) {
      throw new Error(`Unknown format: ${options.format}`);
    }
  } else {
    // Try to auto-detect format
    // First check custom formats (higher priority)
    const customParser = await formatRegistry.findParser(source);
    parser = customParser ?? undefined;
    
    // Then check built-in formats
    if (!parser) {
      for (const [, formatParser] of builtInParsers) {
        if (await formatParser.canParse(source)) {
          parser = formatParser;
          break;
        }
      }
    }
    
    if (!parser) {
      throw new Error('Unable to detect format. Please specify format explicitly.');
    }
  }

  return parser.parse(source, options?.config);
}

/**
 * Get available format IDs
 */
export function getAvailableFormats(): string[] {
  const builtIn = Array.from(builtInParsers.keys());
  const custom = formatRegistry.getAllIds();
  return [...new Set([...builtIn, ...custom])];
}

/**
 * Check if a format is supported
 */
export function isFormatSupported(formatId: string): boolean {
  return (
    builtInParsers.has(formatId.toLowerCase()) ||
    formatRegistry.has(formatId)
  );
}

