/**
 * TIFF compression decoders
 * 
 * Supports common TIFF compression types:
 * - 1: No compression
 * - 5: LZW
 * - 7: JPEG
 * - 8: Deflate (Adobe)
 * - 32773: PackBits
 * - 32946: Deflate
 */

/**
 * TIFF compression types
 */
export enum TIFFCompression {
  None = 1,
  CCITT_RLE = 2,
  CCITT_FAX3 = 3,
  CCITT_FAX4 = 4,
  LZW = 5,
  JPEG_OLD = 6,
  JPEG = 7,
  Deflate = 8,
  PackBits = 32773,
  DeflateNew = 32946,
}

/**
 * Check if a compression type is supported
 */
export function isCompressionSupported(compression: number): boolean {
  return [
    TIFFCompression.None,
    TIFFCompression.LZW,
    TIFFCompression.JPEG,
    TIFFCompression.Deflate,
    TIFFCompression.PackBits,
    TIFFCompression.DeflateNew,
  ].includes(compression);
}

/**
 * Get compression name for display
 */
export function getCompressionName(compression: number): string {
  switch (compression) {
    case TIFFCompression.None: return 'None';
    case TIFFCompression.CCITT_RLE: return 'CCITT RLE';
    case TIFFCompression.CCITT_FAX3: return 'CCITT Fax 3';
    case TIFFCompression.CCITT_FAX4: return 'CCITT Fax 4';
    case TIFFCompression.LZW: return 'LZW';
    case TIFFCompression.JPEG_OLD: return 'JPEG (Old)';
    case TIFFCompression.JPEG: return 'JPEG';
    case TIFFCompression.Deflate:
    case TIFFCompression.DeflateNew: return 'Deflate';
    case TIFFCompression.PackBits: return 'PackBits';
    default: return `Unknown (${compression})`;
  }
}

/**
 * Decompress data based on compression type
 */
export async function decompressData(
  data: ArrayBuffer | Uint8Array,
  compression: number,
  expectedSize?: number
): Promise<Uint8Array> {
  const input = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  
  switch (compression) {
    case TIFFCompression.None:
      return input;
      
    case TIFFCompression.LZW:
      return decompressLZW(input, expectedSize);
      
    case TIFFCompression.JPEG:
      return await decompressJPEG(input);
      
    case TIFFCompression.Deflate:
    case TIFFCompression.DeflateNew:
      return await decompressDeflate(input);
      
    case TIFFCompression.PackBits:
      return decompressPackBits(input, expectedSize);
      
    default:
      throw new Error(`Unsupported compression type: ${getCompressionName(compression)}`);
  }
}

/**
 * LZW decompression
 * Based on the TIFF specification and GIF LZW variant
 */
function decompressLZW(input: Uint8Array, expectedSize?: number): Uint8Array {
  const output: number[] = [];
  const table: number[][] = [];
  const CLEAR_CODE = 256;
  const EOI_CODE = 257;
  
  // Initialize table with single-byte entries
  function initTable() {
    table.length = 0;
    for (let i = 0; i < 256; i++) {
      table.push([i]);
    }
    table.push([]); // CLEAR_CODE (256)
    table.push([]); // EOI_CODE (257)
  }
  
  initTable();
  
  // Bit reader
  let bitPos = 0;
  let codeSize = 9;
  
  function readCode(): number {
    // Read `codeSize` bits from input
    let code = 0;
    for (let i = 0; i < codeSize; i++) {
      const bytePos = Math.floor(bitPos / 8);
      const bitOffset = bitPos % 8;
      
      if (bytePos >= input.length) {
        return EOI_CODE;
      }
      
      // TIFF LZW uses MSB-first bit ordering
      const bit = (input[bytePos]! >> (7 - bitOffset)) & 1;
      code = (code << 1) | bit;
      bitPos++;
    }
    
    return code;
  }
  
  let oldCode = -1;
  
  while (true) {
    const code = readCode();
    
    if (code === EOI_CODE) {
      break;
    }
    
    if (code === CLEAR_CODE) {
      initTable();
      codeSize = 9;
      oldCode = -1;
      continue;
    }
    
    let entry: number[];
    
    if (code < table.length) {
      entry = table[code]!;
    } else if (code === table.length && oldCode >= 0) {
      // Special case: code not yet in table
      const oldEntry = table[oldCode]!;
      entry = [...oldEntry, oldEntry[0]!];
    } else {
      // Error case
      console.warn('[LZW] Invalid code:', code, 'table size:', table.length);
      break;
    }
    
    // Output the entry
    output.push(...entry);
    
    // Add new entry to table
    if (oldCode >= 0 && table.length < 4096) {
      const oldEntry = table[oldCode]!;
      table.push([...oldEntry, entry[0]!]);
      
      // Increase code size when table reaches power of 2
      if (table.length === (1 << codeSize) && codeSize < 12) {
        codeSize++;
      }
    }
    
    oldCode = code;
    
    // Check if we've read enough
    if (expectedSize && output.length >= expectedSize) {
      break;
    }
  }
  
  // Apply horizontal differencing predictor if needed
  // (This is typically handled separately based on TIFF tags)
  
  return new Uint8Array(output);
}

/**
 * JPEG decompression using browser's native decoder
 */
async function decompressJPEG(input: Uint8Array): Promise<Uint8Array> {
  // Create blob and decode using browser
  // Ensure we have a plain ArrayBuffer (not SharedArrayBuffer)
  const buffer = input.slice().buffer as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'image/jpeg' });
  
  try {
    const imageBitmap = await createImageBitmap(blob);
    
    // Draw to canvas to get pixel data
    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    ctx.drawImage(imageBitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, imageBitmap.width, imageBitmap.height);
    
    imageBitmap.close();
    
    return new Uint8Array(imageData.data.buffer);
  } catch (error) {
    console.error('[JPEG] Decompression failed:', error);
    throw new Error('JPEG decompression failed');
  }
}

/**
 * Deflate decompression using browser's CompressionStream
 */
async function decompressDeflate(input: Uint8Array): Promise<Uint8Array> {
  // Check if DecompressionStream is available
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream not available - Deflate decompression not supported');
  }
  
  try {
    // Create a stream from the input
    const inputStream = new ReadableStream({
      start(controller) {
        controller.enqueue(input);
        controller.close();
      }
    });
    
    // Decompress using DecompressionStream
    // TIFF uses raw deflate, not gzip or zlib
    const ds = new DecompressionStream('deflate-raw');
    const decompressedStream = inputStream.pipeThrough(ds);
    
    // Read all chunks
    const reader = decompressedStream.getReader();
    const chunks: Uint8Array[] = [];
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    
    // Concatenate chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result;
  } catch (error) {
    // If deflate-raw fails, try regular deflate (with zlib header)
    console.warn('[Deflate] Raw deflate failed, trying with zlib header:', error);
    
    try {
      const inputStream = new ReadableStream({
        start(controller) {
          controller.enqueue(input);
          controller.close();
        }
      });
      
      const ds = new DecompressionStream('deflate');
      const decompressedStream = inputStream.pipeThrough(ds);
      
      const reader = decompressedStream.getReader();
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      
      return result;
    } catch (innerError) {
      console.error('[Deflate] All decompression attempts failed:', innerError);
      throw new Error('Deflate decompression failed');
    }
  }
}

/**
 * PackBits decompression (simple RLE)
 */
function decompressPackBits(input: Uint8Array, expectedSize?: number): Uint8Array {
  const output: number[] = [];
  let pos = 0;
  
  while (pos < input.length) {
    const header = input[pos]!;
    pos++;
    
    if (header < 128) {
      // Copy next (header + 1) bytes literally
      const count = header + 1;
      for (let i = 0; i < count && pos < input.length; i++) {
        output.push(input[pos]!);
        pos++;
      }
    } else if (header > 128) {
      // Repeat next byte (257 - header) times
      const count = 257 - header;
      const value = input[pos]!;
      pos++;
      for (let i = 0; i < count; i++) {
        output.push(value);
      }
    }
    // header === 128 is a no-op
    
    // Check if we've read enough
    if (expectedSize && output.length >= expectedSize) {
      break;
    }
  }
  
  return new Uint8Array(output);
}

/**
 * Apply horizontal differencing predictor
 * TIFF uses predictor=2 for horizontal differencing
 */
export function applyPredictor(
  data: Uint8Array,
  width: number,
  height: number,
  samplesPerPixel: number,
  predictor: number
): Uint8Array {
  if (predictor !== 2) {
    return data; // Only horizontal differencing supported
  }
  
  const result = new Uint8Array(data.length);
  const bytesPerRow = width * samplesPerPixel;
  
  for (let y = 0; y < height; y++) {
    const rowStart = y * bytesPerRow;
    
    // First pixel in row is unchanged
    for (let s = 0; s < samplesPerPixel; s++) {
      result[rowStart + s] = data[rowStart + s]!;
    }
    
    // Remaining pixels are differences from previous pixel
    for (let x = 1; x < width; x++) {
      for (let s = 0; s < samplesPerPixel; s++) {
        const pos = rowStart + x * samplesPerPixel + s;
        const prevPos = rowStart + (x - 1) * samplesPerPixel + s;
        result[pos] = (data[pos]! + result[prevPos]!) & 0xFF;
      }
    }
  }
  
  return result;
}

/**
 * Decode JPEG tile data to RGBA
 */
export async function decodeJPEGTile(
  data: ArrayBuffer | Uint8Array,
  expectedWidth?: number,
  expectedHeight?: number
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const input = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  // Ensure we have a plain ArrayBuffer (not SharedArrayBuffer)
  const buffer = input.slice().buffer as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'image/jpeg' });
  
  try {
    const imageBitmap = await createImageBitmap(blob);
    const width = expectedWidth ?? imageBitmap.width;
    const height = expectedHeight ?? imageBitmap.height;
    
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    ctx.drawImage(imageBitmap, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    
    imageBitmap.close();
    
    return {
      data: imageData.data,
      width,
      height,
    };
  } catch (error) {
    console.error('[JPEG Tile] Decoding failed:', error);
    throw new Error('JPEG tile decoding failed');
  }
}

/**
 * Decode raw pixel data to RGBA based on photometric interpretation
 */
export function decodeToRGBA(
  data: Uint8Array,
  width: number,
  height: number,
  samplesPerPixel: number,
  bitsPerSample: number | number[],
  photometric: number
): Uint8ClampedArray {
  const totalPixels = width * height;
  const rgba = new Uint8ClampedArray(totalPixels * 4);
  
  // Get bits per sample as number
  const bps = Array.isArray(bitsPerSample) ? bitsPerSample[0]! : bitsPerSample;
  const bytesPerSample = Math.ceil(bps / 8);
  
  // Photometric interpretations:
  // 0: WhiteIsZero (grayscale, inverted)
  // 1: BlackIsZero (grayscale)
  // 2: RGB
  // 3: Palette (indexed color)
  // 4: Transparency mask
  // 5: CMYK
  // 6: YCbCr
  
  if (photometric === 0 || photometric === 1) {
    // Grayscale
    const invert = photometric === 0;
    const maxVal = (1 << bps) - 1;
    
    for (let i = 0; i < totalPixels; i++) {
      let gray: number;
      
      if (bytesPerSample === 1) {
        gray = data[i * samplesPerPixel]!;
      } else if (bytesPerSample === 2) {
        const offset = i * samplesPerPixel * 2;
        gray = data[offset]! | (data[offset + 1]! << 8);
        gray = Math.floor((gray / maxVal) * 255);
      } else {
        gray = data[i * samplesPerPixel]!;
      }
      
      if (invert) {
        gray = 255 - gray;
      }
      
      rgba[i * 4] = gray;
      rgba[i * 4 + 1] = gray;
      rgba[i * 4 + 2] = gray;
      rgba[i * 4 + 3] = 255;
      
      // Handle alpha if present
      if (samplesPerPixel >= 2) {
        rgba[i * 4 + 3] = data[i * samplesPerPixel + 1]!;
      }
    }
  } else if (photometric === 2) {
    // RGB
    const maxVal = (1 << bps) - 1;
    
    for (let i = 0; i < totalPixels; i++) {
      if (bytesPerSample === 1) {
        rgba[i * 4] = data[i * samplesPerPixel]!;
        rgba[i * 4 + 1] = data[i * samplesPerPixel + 1]!;
        rgba[i * 4 + 2] = data[i * samplesPerPixel + 2]!;
      } else if (bytesPerSample === 2) {
        const offset = i * samplesPerPixel * 2;
        rgba[i * 4] = Math.floor((((data[offset]! | (data[offset + 1]! << 8))) / maxVal) * 255);
        rgba[i * 4 + 1] = Math.floor((((data[offset + 2]! | (data[offset + 3]! << 8))) / maxVal) * 255);
        rgba[i * 4 + 2] = Math.floor((((data[offset + 4]! | (data[offset + 5]! << 8))) / maxVal) * 255);
      } else {
        rgba[i * 4] = data[i * samplesPerPixel]!;
        rgba[i * 4 + 1] = data[i * samplesPerPixel + 1]!;
        rgba[i * 4 + 2] = data[i * samplesPerPixel + 2]!;
      }
      
      // Handle alpha if present
      if (samplesPerPixel >= 4) {
        rgba[i * 4 + 3] = data[i * samplesPerPixel + 3]!;
      } else {
        rgba[i * 4 + 3] = 255;
      }
    }
  } else if (photometric === 5) {
    // CMYK - convert to RGB
    for (let i = 0; i < totalPixels; i++) {
      const c = data[i * samplesPerPixel]!;
      const m = data[i * samplesPerPixel + 1]!;
      const y = data[i * samplesPerPixel + 2]!;
      const k = data[i * samplesPerPixel + 3]!;
      
      // CMYK to RGB conversion
      rgba[i * 4] = Math.round((255 - c) * (255 - k) / 255);
      rgba[i * 4 + 1] = Math.round((255 - m) * (255 - k) / 255);
      rgba[i * 4 + 2] = Math.round((255 - y) * (255 - k) / 255);
      rgba[i * 4 + 3] = 255;
    }
  } else if (photometric === 6) {
    // YCbCr - convert to RGB
    for (let i = 0; i < totalPixels; i++) {
      const Y = data[i * samplesPerPixel]!;
      const Cb = data[i * samplesPerPixel + 1]!;
      const Cr = data[i * samplesPerPixel + 2]!;
      
      // YCbCr to RGB conversion
      const r = Y + 1.402 * (Cr - 128);
      const g = Y - 0.34414 * (Cb - 128) - 0.71414 * (Cr - 128);
      const b = Y + 1.772 * (Cb - 128);
      
      rgba[i * 4] = Math.max(0, Math.min(255, Math.round(r)));
      rgba[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(g)));
      rgba[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(b)));
      rgba[i * 4 + 3] = 255;
    }
  } else {
    // Default: assume RGB
    console.warn(`[TIFF] Unsupported photometric interpretation: ${photometric}, treating as RGB`);
    
    for (let i = 0; i < totalPixels; i++) {
      rgba[i * 4] = data[i * samplesPerPixel]!;
      rgba[i * 4 + 1] = data[i * samplesPerPixel + 1]!;
      rgba[i * 4 + 2] = data[i * samplesPerPixel + 2]!;
      rgba[i * 4 + 3] = samplesPerPixel >= 4 ? data[i * samplesPerPixel + 3]! : 255;
    }
  }
  
  return rgba;
}

