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
import { BIFFParser } from './biff/parser.js';
import { NDPIParser } from './ndpi/parser.js';
import { SVSParser } from './svs/parser.js';
import { SCNParser } from './scn/parser.js';
import { JPEG2000Parser } from './jpeg2000/parser.js';
import { JPEGXLParser } from './jpegxl/parser.js';
import { HEICParser } from './heic/parser.js';
import { GeoJSONParser } from './geojson/parser.js';
// Note: APIParser is available for custom API-based tile sources but not registered by default
// import { APIParser } from './api/parser.js';

/**
 * Built-in format parsers
 */
const builtInParsers = new Map<string, FormatParser>([
  ['tiff', new TIFFParser()],
  ['tif', new TIFFParser()],
  ['ome-tiff', new TIFFParser()],
  ['ome.tiff', new TIFFParser()],
  ['zarr', new ZarrParser()],
  ['dicom', new DICOMParser()],
  ['dcm', new DICOMParser()],
  ['iiif', new IIIFParser()],
  ['jpeg', new JPEGParser()],
  ['jpg', new JPEGParser()],
  ['png', new PNGParser()],
  ['webp', new WebPParser()],
  ['nifti', new NIfTIParser()],
  ['nii', new NIfTIParser()],
  ['nrrd', new NRRDParser()],
  ['hdf5', new HDF5Parser()],
  ['h5', new HDF5Parser()],
  ['biff', new BIFFParser()],
  ['bf', new BIFFParser()],
  ['ndpi', new NDPIParser()],
  ['svs', new SVSParser()],
  ['scn', new SCNParser()],
  ['jpeg2000', new JPEG2000Parser()],
  ['jp2', new JPEG2000Parser()],
  ['jpx', new JPEG2000Parser()],
  ['j2k', new JPEG2000Parser()],
  ['j2c', new JPEG2000Parser()],
  ['jpegxl', new JPEGXLParser()],
  ['jxl', new JPEGXLParser()],
  ['heic', new HEICParser()],
  ['heif', new HEICParser()],
  ['hif', new HEICParser()],
  ['geojson', new GeoJSONParser()],
  // API protocols are handled separately via APIParser
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

