/**
 * @tessera/formats - Image format support
 */

// Types
export type {
  FormatMetadata,
  FormatConfig,
  FormatParser,
  CustomFormatRegistration,
} from './types.js';

// Base classes
export { BaseFormatParser } from './base.js';

// Registry
export { FormatRegistry, formatRegistry } from './registry.js';

// Factory
export {
  createTileSource,
  getAvailableFormats,
  isFormatSupported,
} from './factory.js';

// Custom format support
export {
  createCustomFormat,
  createSimpleImageFormat,
} from './custom.js';

// Built-in parsers
export { TIFFParser } from './tiff/parser.js';
export type { TIFFConfig } from './tiff/parser.js';

export { ZarrParser } from './zarr/parser.js';
export type { ZarrConfig } from './zarr/parser.js';

export { DICOMParser } from './dicom/parser.js';
export type { DICOMConfig } from './dicom/parser.js';

export { IIIFParser } from './iiif/parser.js';
export type { IIIFConfig } from './iiif/parser.js';

export { JPEGParser } from './jpeg/parser.js';
export type { JPEGConfig } from './jpeg/parser.js';

export { PNGParser } from './png/parser.js';
export type { PNGConfig } from './png/parser.js';

export { WebPParser } from './webp/parser.js';
export type { WebPConfig } from './webp/parser.js';

export { NIfTIParser } from './nifti/parser.js';
export type { NIfTIConfig } from './nifti/parser.js';

export { NRRDParser } from './nrrd/parser.js';
export type { NRRDConfig } from './nrrd/parser.js';

export { HDF5Parser } from './hdf5/parser.js';
export type { HDF5Config } from './hdf5/parser.js';

// Tile sources
export { BaseTileSource } from './sources/base-source.js';
export { HTTPTileSource } from './sources/http-source.js';
export type { HTTPTileSourceOptions } from './sources/http-source.js';
export { MemoryTileSource } from './sources/memory-source.js';
export type { MemoryTileSourceOptions } from './sources/memory-source.js';

