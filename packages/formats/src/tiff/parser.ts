/**
 * TIFF/OME-TIFF parser
 */

import { BaseFormatParser } from '../base.js';
import type { FormatConfig, FormatMetadata } from '../types.js';
import type { TileSource } from '@tessera/rendering';
import { HTTPTileSource } from '../sources/http-source.js';
import { MemoryTileSource } from '../sources/memory-source.js';
import UTIF from 'utif';

/**
 * TIFF parser configuration
 */
export interface TIFFConfig extends FormatConfig {
  /** Base URL for TIFF files */
  baseUrl?: string;
  /** Tile size (default: 256) */
  tileSize?: number;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Use HTTP tiles if URL provided */
  useHTTP?: boolean;
}

/**
 * TIFF/OME-TIFF parser
 */
export class TIFFParser extends BaseFormatParser {
  readonly metadata: FormatMetadata = {
    id: 'tiff',
    name: 'TIFF/OME-TIFF',
    description: 'Tagged Image File Format and OME-TIFF (Open Microscopy Environment TIFF)',
    mimeTypes: ['image/tiff', 'image/tif'],
    extensions: ['tiff', 'tif', 'ome.tiff', 'ome.tif'],
    supportsTiling: true,
    supportsPyramids: true,
    supportsMultiChannel: true,
  };

  async canParse(source: string | ArrayBuffer | File): Promise<boolean> {
    if (typeof source === 'string') {
      const url = source.toLowerCase();
      return (
        url.endsWith('.tiff') ||
        url.endsWith('.tif') ||
        url.endsWith('.ome.tiff') ||
        url.endsWith('.ome.tif')
      );
    }
    
    if (source instanceof File) {
      const name = source.name.toLowerCase();
      return (
        name.endsWith('.tiff') ||
        name.endsWith('.tif') ||
        name.endsWith('.ome.tiff') ||
        name.endsWith('.ome.tif')
      );
    }

    // Check magic bytes: II (little-endian) or MM (big-endian) followed by 42
    if (source instanceof ArrayBuffer) {
      const view = new DataView(source);
      if (source.byteLength < 4) return false;
      const byte0 = view.getUint8(0);
      const byte1 = view.getUint8(1);
      const byte2 = view.getUint16(2, true);
      return (
        (byte0 === 0x49 && byte1 === 0x49 && byte2 === 42) ||
        (byte0 === 0x4d && byte1 === 0x4d && byte2 === 42)
      );
    }

    return false;
  }

  async parse(
    source: string | ArrayBuffer | File,
    config?: TIFFConfig
  ): Promise<TileSource> {
    const tileSize = config?.tileSize ?? 256;

    if (typeof source === 'string') {
      // HTTP-based TIFF source
      const baseUrl = config?.baseUrl ?? source;
      
      return new HTTPTileSource({
        baseUrl,
        tileSize,
        headers: config?.headers,
        getTileUrl: (level, x, y) => {
          // TIFF tile URL pattern (adjust based on your server)
          return `${baseUrl}/tile/${level}/${x}/${y}`;
        },
        getImageSize: async () => {
          // TODO: Fetch TIFF header to get dimensions
          // For now, return placeholder
          return [0, 0];
        },
        getLevelCount: async () => {
          // TODO: Parse TIFF to get pyramid levels
          return 1;
        },
      });
    }

    // Memory-based TIFF source
    if (source instanceof File || source instanceof ArrayBuffer) {
      // Convert File to ArrayBuffer if needed
      const arrayBuffer = source instanceof File 
        ? await source.arrayBuffer()
        : source;
      
      // Decode TIFF using UTIF
      const ifds = UTIF.decode(arrayBuffer);
      if (!ifds || ifds.length === 0) {
        throw new Error('Failed to decode TIFF file: No image data found');
      }
      
      // Use the first IFD (Image File Directory)
      const ifd = ifds[0];
      
      // Decode the image data
      UTIF.decodeImage(arrayBuffer, ifd);
      
      // Get image dimensions
      const width = ifd.width;
      const height = ifd.height;
      
      if (!width || !height || width <= 0 || height <= 0) {
        throw new Error(`Invalid TIFF dimensions: ${width}x${height}`);
      }
      
      if (!ifd.data) {
        throw new Error('Failed to decode TIFF: No pixel data found');
      }
      
      const totalPixels = width * height;
      
      // Convert to Uint8Array first (handle 16-bit data)
      let sourceData: Uint8Array;
      if (ifd.data instanceof Uint8Array || ifd.data instanceof Uint8ClampedArray) {
        sourceData = ifd.data;
      } else if (ifd.data instanceof Uint16Array) {
        // Convert 16-bit to 8-bit by scaling down
        sourceData = new Uint8Array(ifd.data.length);
        for (let i = 0; i < ifd.data.length; i++) {
          sourceData[i] = Math.min(255, Math.floor((ifd.data[i] / 65535) * 255));
        }
      } else {
        // Fallback: try to get as Uint8Array
        const buffer = ifd.data.buffer || ifd.data;
        sourceData = new Uint8Array(buffer, 0, ifd.data.length);
      }
      
      // Now calculate bytes per pixel based on the 8-bit data length
      // UTIF can return: 1 (grayscale), 2 (grayscale+alpha), 3 (RGB), or 4 (RGBA) bytes per pixel
      const actualByteLength = sourceData.length;
      const bytesPerPixelFloat = actualByteLength / totalPixels;
      
      // Round to nearest integer and check if it's close (handle floating point precision)
      const bytesPerPixel = Math.round(bytesPerPixelFloat);
      const tolerance = 0.01; // Allow small floating point errors
      
      if (
        bytesPerPixel < 1 || 
        bytesPerPixel > 4 || 
        Math.abs(bytesPerPixelFloat - bytesPerPixel) > tolerance
      ) {
        throw new Error(
          `Invalid TIFF pixel format: ${actualByteLength} bytes for ${totalPixels} pixels ` +
          `(${bytesPerPixelFloat.toFixed(2)} bytes per pixel). Expected 1, 2, 3, or 4 bytes per pixel.`
        );
      }
      
      // Convert decoded TIFF data to RGBA format for ImageData
      // ImageData requires RGBA (4 bytes per pixel)
      const rgbaData = new Uint8ClampedArray(totalPixels * 4);
      
      // Convert to RGBA format
      if (bytesPerPixel === 1) {
        // Grayscale: G -> RGBA (G, G, G, 255)
        for (let i = 0; i < totalPixels; i++) {
          const gray = sourceData[i];
          rgbaData[i * 4] = gray;     // R
          rgbaData[i * 4 + 1] = gray; // G
          rgbaData[i * 4 + 2] = gray; // B
          rgbaData[i * 4 + 3] = 255;  // A
        }
      } else if (bytesPerPixel === 2) {
        // Grayscale + Alpha: GA -> RGBA (G, G, G, A)
        for (let i = 0; i < totalPixels; i++) {
          const gray = sourceData[i * 2];
          const alpha = sourceData[i * 2 + 1];
          rgbaData[i * 4] = gray;     // R
          rgbaData[i * 4 + 1] = gray; // G
          rgbaData[i * 4 + 2] = gray; // B
          rgbaData[i * 4 + 3] = alpha; // A
        }
      } else if (bytesPerPixel === 3) {
        // RGB: RGB -> RGBA (R, G, B, 255)
        for (let i = 0; i < totalPixels; i++) {
          rgbaData[i * 4] = sourceData[i * 3];     // R
          rgbaData[i * 4 + 1] = sourceData[i * 3 + 1]; // G
          rgbaData[i * 4 + 2] = sourceData[i * 3 + 2]; // B
          rgbaData[i * 4 + 3] = 255;              // A
        }
      } else if (bytesPerPixel === 4) {
        // RGBA: already in correct format
        rgbaData.set(sourceData.subarray(0, totalPixels * 4));
      }
      
      // Create ImageData with RGBA format
      const imageData = new ImageData(rgbaData, width, height);
      
      // Convert ImageData to ImageBitmap
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get 2D context for TIFF decoding');
      }
      
      ctx.putImageData(imageData, 0, 0);
      const imageBitmap = await createImageBitmap(canvas);
      
      return new MemoryTileSource({
        imageData: imageBitmap,
        width,
        height,
        tileSize,
        levelCount: 1,
      });
    }

    throw new Error('Unsupported TIFF source type');
  }
}

