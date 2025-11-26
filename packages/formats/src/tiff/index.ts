/**
 * TIFF format support
 */

export { TIFFParser } from './parser.js';
export type { TIFFConfig } from './parser.js';

export {
  TIFFCompression,
  isCompressionSupported,
  getCompressionName,
  decompressData,
  applyPredictor,
  decodeJPEGTile,
  decodeToRGBA,
} from './compression.js';


