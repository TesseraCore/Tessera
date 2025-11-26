/**
 * TIFF/OME-TIFF parser
 */

import { BaseFormatParser } from '../base.js';
import type { FormatConfig, FormatMetadata } from '../types.js';
import type { TileSource } from '@tessera/rendering';
import { HTTPTileSource } from '../sources/http-source.js';
import { MemoryTileSource } from '../sources/memory-source.js';
import { TIFFTileSource } from '../sources/tiff-source.js';
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
  /** Image dimensions if already known [width, height] */
  dimensions?: [number, number];
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
      
      // Validate array buffer
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Invalid TIFF file: Empty or invalid ArrayBuffer');
      }
      
      // Group UTIF's verbose unknown tag warnings into a collapsible block
      // These are expected for custom/private TIFF tags
      const originalWarn = console.warn.bind(console);
      const unknownTagWarnings: Array<string> = [];
      let groupActive = false;
      
      // Start a collapsed group BEFORE overriding console.warn
      // This ensures all warnings go into the group
      console.groupCollapsed('[TIFF] Unknown TIFF tag warnings (custom/private tags, safe to ignore)');
      groupActive = true;
      
      // Override console.warn to capture and suppress unknown tag warnings
      console.warn = (...args: any[]) => {
        // Convert all arguments to a string for checking
        const fullMessage = args.map(arg => {
          if (typeof arg === 'string') return arg;
          if (arg && typeof arg === 'object') return JSON.stringify(arg);
          return String(arg);
        }).join(' ');
        
        // Capture "unknown TIFF tag type" warnings from UTIF
        if (fullMessage.includes('unknown TIFF tag type') || fullMessage.includes('unknown TIFF tag')) {
          // Store the full warning to log later
          unknownTagWarnings.push(fullMessage);
          // Don't log it now - we'll log all at once at the end
          return; // Suppress the warning
        }
        // Allow other warnings through normally (they'll appear in the group)
        originalWarn.apply(console, args);
      };
      
      let ifds: any[];
      try {
        // Decode TIFF using UTIF (warnings will be captured)
        ifds = UTIF.decode(arrayBuffer);
        
        // Restore console.warn after decoding
        console.warn = originalWarn;
        
        // Log all captured warnings within the group
        if (unknownTagWarnings.length > 0) {
          const uniqueTags = new Set<string>();
          unknownTagWarnings.forEach(warning => {
            const tagMatch = warning.match(/tag type:\s*(\d+)/);
            if (tagMatch && tagMatch[1]) {
              uniqueTags.add(tagMatch[1]);
            }
            // Log each warning
            console.warn(warning);
          });
          
          console.debug(`\nTotal: ${unknownTagWarnings.length} warnings, ${uniqueTags.size} unique tag types`);
          console.debug('These are custom/private TIFF tags (e.g., OME metadata) and don\'t affect image rendering.');
        } else {
          // If no warnings, just close the empty group
          console.debug('No unknown tag warnings.');
        }
        
        // End the group
        console.groupEnd();
        groupActive = false;
        
        if (!ifds || ifds.length === 0) {
          throw new Error('Failed to decode TIFF file: No image data found');
        }
      } catch (error) {
        // Always restore console.warn even on error
        console.warn = originalWarn;
        
        // Still log the warnings even if there was an error
        if (groupActive) {
          if (unknownTagWarnings.length > 0) {
            const uniqueTags = new Set<string>();
            unknownTagWarnings.forEach(warning => {
              const tagMatch = warning.match(/tag type:\s*(\d+)/);
              if (tagMatch && tagMatch[1]) {
                uniqueTags.add(tagMatch[1]);
              }
              console.warn(warning);
            });
            
            console.debug(`Total: ${unknownTagWarnings.length} warnings, ${uniqueTags.size} unique tag types`);
          }
          console.groupEnd();
          groupActive = false;
        }
        
        throw error;
      }
      
      // Walk the IFD chain manually - this is more reliable for BigTIFF
      const manualIFDs = this.walkAllIFDs(arrayBuffer);
      
      // For whole slide images (WSI), there are often multiple IFDs:
      // - Label image (small text label of the slide)
      // - Macro image (overview thumbnail)
      // - Main pyramid image (the actual high-res tiled image we want)
      // - Lower resolution levels of the pyramid
      // 
      // We need to find the LARGEST tiled IFD, which is the base of the pyramid (main image).
      // This avoids accidentally selecting the label or macro image.
      
      interface IFDCandidate {
        ifd: any;
        manualTags: Record<string, any> | null;
        index: number;
        width: number;
        height: number;
        pixelCount: number;
        isTiled: boolean;
        tileWidth?: number;
        tileHeight?: number;
      }
      
      const candidates: IFDCandidate[] = [];
      
      // Use manually walked IFDs as the primary source (more reliable for BigTIFF)
      // Fall back to UTIF data if manual walking fails
      const ifdCount = Math.max(manualIFDs.length, ifds?.length ?? 0);
      
      for (let i = 0; i < ifdCount; i++) {
        const manualData = manualIFDs[i];
        const utifIFD = ifds?.[i];
        
        // Get dimensions - prefer manual data
        let testWidth = manualData?.width;
        let testHeight = manualData?.height;
        
        // Fall back to UTIF if manual data missing
        if (!testWidth || !testHeight) {
          if (utifIFD) {
            testWidth = this.getIFDTag(utifIFD, 256) || utifIFD.width;
            testHeight = this.getIFDTag(utifIFD, 257) || utifIFD.height;
            
            if (Array.isArray(testWidth)) testWidth = testWidth[0];
            if (Array.isArray(testHeight)) testHeight = testHeight[0];
            
            // Try decoding the IFD to populate dimensions if not available
            if (!testWidth || !testHeight) {
              try {
                UTIF.decodeImage(arrayBuffer, utifIFD);
                testWidth = utifIFD.width;
                testHeight = utifIFD.height;
              } catch (e) {
                // Ignore decode errors
              }
            }
          }
        }
        
        if (testWidth && testHeight && testWidth > 0 && testHeight > 0) {
          // Check if this IFD has tiling info - prefer manual data
          const testTileWidth = manualData?.tileWidth || (utifIFD ? this.getIFDTag(utifIFD, 322) : undefined);
          const testTileHeight = manualData?.tileHeight || (utifIFD ? this.getIFDTag(utifIFD, 323) : undefined);
          const testTileOffsets = manualData?.tileOffsets || (utifIFD ? this.getIFDTag(utifIFD, 324) : undefined);
          const testTileByteCounts = manualData?.tileByteCounts || (utifIFD ? this.getIFDTag(utifIFD, 325) : undefined);
          
          const isTiled = !!(testTileWidth && testTileHeight && testTileOffsets && testTileByteCounts);
          
          candidates.push({
            ifd: utifIFD,
            manualTags: manualData || null,
            index: i,
            width: testWidth,
            height: testHeight,
            pixelCount: testWidth * testHeight,
            isTiled,
            tileWidth: testTileWidth,
            tileHeight: testTileHeight,
          });
        }
      }
      
      // Sort candidates: prefer tiled images, then by pixel count (largest first)
      candidates.sort((a, b) => {
        // Tiled images come first
        if (a.isTiled && !b.isTiled) return -1;
        if (!a.isTiled && b.isTiled) return 1;
        // Then by pixel count (largest first)
        return b.pixelCount - a.pixelCount;
      });
      
      let ifd = ifds[0];
      let foundValidIFD = false;
      
      if (candidates.length > 0) {
        const best = candidates[0]!;
        ifd = best.ifd;
        foundValidIFD = true;
        
        // Log all IFD analysis in a collapsed group with table
        console.groupCollapsed(`[TIFF] 📊 Parsed ${manualIFDs.length} IFDs → Selected IFD ${best.index} (${best.width}×${best.height}, ${(best.pixelCount / 1e6).toFixed(1)} MP, ${best.isTiled ? 'tiled' : 'non-tiled'})`);
        
        // Create table data for all candidates
        const tableData = candidates.map(c => ({
          'IFD': c.index,
          'Dimensions': `${c.width}×${c.height}`,
          'Megapixels': (c.pixelCount / 1e6).toFixed(1),
          'Tiled': c.isTiled ? '✓' : '✗',
          'Tile Size': c.isTiled ? `${c.tileWidth}×${c.tileHeight}` : '-',
          'Selected': c.index === best.index ? '★' : '',
        }));
        console.table(tableData);
        console.groupEnd();
      }
      
      // Get dimensions from the best candidate if we found one
      let width: number | undefined = config?.dimensions?.[0];
      let height: number | undefined = config?.dimensions?.[1];
      let selectedCandidate: IFDCandidate | null = null;
      
      
      // Use dimensions from the selected candidate (most reliable)
      if (candidates.length > 0 && candidates[0]) {
        selectedCandidate = candidates[0];
        width = selectedCandidate.width;
        height = selectedCandidate.height;
      }
      
      if (!foundValidIFD && ifds && ifds.length > 0) {
        // Fallback: use first IFD anyway
        ifd = ifds[0];
        console.debug('[TIFF] No IFD with valid dimensions found, using first IFD (will try to read dimensions manually)');
      }
      
      // Get tags from the selected candidate's manual data (from walkAllIFDs)
      const selectedManualTags = selectedCandidate?.manualTags || {};
      
      
      // Check if the selected candidate is tiled
      // Use the candidate's tiling info (from walkAllIFDs or UTIF)
      const tileWidth = selectedCandidate?.tileWidth || selectedManualTags.tileWidth || (ifd ? this.getIFDTag(ifd, 322) : undefined);
      const tileHeight = selectedCandidate?.tileHeight || selectedManualTags.tileHeight || (ifd ? this.getIFDTag(ifd, 323) : undefined);
      const tileOffsets = selectedManualTags.tileOffsets || (ifd ? this.getIFDTag(ifd, 324) : undefined);
      const tileByteCounts = selectedManualTags.tileByteCounts || (ifd ? this.getIFDTag(ifd, 325) : undefined);


      if (tileWidth && tileHeight && tileOffsets && tileByteCounts && width && height) {
        // This is a tiled TIFF - use TIFFTileSource
        // Get compression and color settings from manual tags or UTIF
        const compression = selectedManualTags.compression || (ifd ? this.getIFDTag(ifd, 259) : undefined) || 1;
        const photometric = selectedManualTags.photometric || (ifd ? this.getIFDTag(ifd, 262) : undefined) || 2;
        const samplesPerPixel = selectedManualTags.samplesPerPixel || (ifd ? this.getIFDTag(ifd, 277) : undefined) || 3;
        const bitsPerSample = selectedManualTags.bitsPerSample || (ifd ? this.getIFDTag(ifd, 258) : undefined) || 8;
        const predictor = (ifd ? this.getIFDTag(ifd, 317) : undefined) || 1;
        

        const tilesAcross = Math.ceil(width / tileWidth);
        const tilesDown = Math.ceil(height / tileHeight);

        // Ensure arrays are arrays
        const offsetsArray = Array.isArray(tileOffsets) ? tileOffsets : [tileOffsets];
        const countsArray = Array.isArray(tileByteCounts) ? tileByteCounts : [tileByteCounts];

        return new TIFFTileSource({
          arrayBuffer,
          width,
          height,
          tileWidth,
          tileHeight,
          tileOffsets: offsetsArray,
          tileByteCounts: countsArray,
          tilesAcross,
          tilesDown,
          compression,
          photometric,
          samplesPerPixel,
          bitsPerSample,
          predictor,
        });
      }

      // Not a tiled TIFF - decode the full image
      
      // Check if this is a strip-based TIFF (tag 273 = StripOffsets, tag 279 = StripByteCounts)
      const stripOffsets = this.getIFDTag(ifd, 273);
      const stripByteCounts = this.getIFDTag(ifd, 279);
      // Note: rowsPerStrip is available for advanced strip reading but not currently used
      // const rowsPerStrip = this.getIFDTag(ifd, 278) || height;
      
      // Try to decode image data - try all IFDs if the first one fails
      let decodedIFD: any = null;
      for (let i = 0; i < ifds.length; i++) {
        const testIFD = ifds[i];
        try {
          UTIF.decodeImage(arrayBuffer, testIFD);
          if (testIFD.data) {
            decodedIFD = testIFD;
            ifd = testIFD; // Use this IFD
            break;
          }
        } catch (decodeError) {
          console.warn(`[TIFF] Error decoding IFD ${i}:`, decodeError);
          // Continue to next IFD
        }
      }
      
      // If no IFD decoded successfully, try the original IFD one more time
      if (!decodedIFD) {
        try {
          UTIF.decodeImage(arrayBuffer, ifd);
          if (ifd.data) {
            decodedIFD = ifd;
          }
        } catch (decodeError) {
          console.warn('[TIFF] Error decoding original IFD:', decodeError);
        }
      }
      
      // After decoding, check if dimensions were populated
      if (!width || !height) {
        width = ifd.width;
        height = ifd.height;
      }
      
      // Try again after decodeImage (it might set width/height)
      if (!width || !height) {
        width = ifd.width;
        height = ifd.height;
      }
      
      // Final check - try reading from tags again after decode
      if (!width || !height) {
        if ((ifd as any).t256 !== undefined) {
          const tag256 = (ifd as any).t256;
          width = Array.isArray(tag256) ? tag256[0] : tag256;
        }
        if ((ifd as any).t257 !== undefined) {
          const tag257 = (ifd as any).t257;
          height = Array.isArray(tag257) ? tag257[0] : tag257;
        }
      }
      
      // Also try numeric keys again
      if (!width || !height) {
        if (ifd[256] !== undefined) {
          width = Array.isArray(ifd[256]) ? ifd[256][0] : ifd[256];
        }
        if (ifd[257] !== undefined) {
          height = Array.isArray(ifd[257]) ? ifd[257][0] : ifd[257];
        }
      }
      
      // If still no dimensions, check manual tags again (in case they weren't checked earlier)
      if (!width || !height || width <= 0 || height <= 0) {
        if (selectedManualTags.width && selectedManualTags.height && selectedManualTags.width > 0 && selectedManualTags.height > 0) {
          width = selectedManualTags.width;
          height = selectedManualTags.height;
        } else {
          // Last resort: try manual parsing (doesn't support BigTIFF)
          console.debug('[TIFF] Attempting manual dimension parsing...');
          const manualDims = this.readTIFFDimensions(arrayBuffer);
          if (manualDims) {
            width = manualDims[0];
            height = manualDims[1];
          } else {
            console.debug('[TIFF] Manual parser failed to find dimensions (may be BigTIFF)');
          }
        }
      }
      
      // Try to infer dimensions from decoded image data if available
      if ((!width || !height || width <= 0 || height <= 0) && ifd.data) {
        const dataLength = ifd.data.length;
        
        // Try common bytes-per-pixel values
        for (const bpp of [1, 2, 3, 4]) {
          const totalPixels = dataLength / bpp;
          const sqrt = Math.sqrt(totalPixels);
          
          // Check if it's a reasonable square image
          if (Number.isInteger(sqrt) && sqrt > 0 && sqrt < 100000) {
            width = sqrt;
            height = sqrt;
            break;
          }
          
          // Also try common aspect ratios (not just square)
          const commonRatios = [
            [1, 1],      // Square
            [4, 3],      // 4:3
            [16, 9],     // 16:9
            [3, 2],      // 3:2
            [2, 1],      // 2:1
          ];
          
          for (const ratio of commonRatios) {
            const wRatio = ratio[0];
            const hRatio = ratio[1];
            if (wRatio === undefined || hRatio === undefined) continue;
            
            const aspectRatio = wRatio / hRatio;
            const h = Math.sqrt(totalPixels / aspectRatio);
            const w = h * aspectRatio;
            
            if (Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0 && w < 100000 && h < 100000) {
              width = w;
              height = h;
              break;
            }
          }
          
          if (width && height) break;
        }
      }
      
      // Last resort: try to decode image and check if UTIF populates dimensions
      if ((!width || !height || width <= 0 || height <= 0) && !ifd.data) {
        try {
          UTIF.decodeImage(arrayBuffer, ifd);
          if (ifd.width && ifd.height) {
            width = ifd.width;
            height = ifd.height;
          }
        } catch (e) {
          // Ignore decode errors for dimension detection
        }
      }
      
      if (!width || !height || width <= 0 || height <= 0) {
        // If dimensions were provided in config, use them as fallback
        if (config?.dimensions) {
          width = config.dimensions[0];
          height = config.dimensions[1];
        }
        
        // If still no dimensions, throw error
        if (!width || !height || width <= 0 || height <= 0) {
          // Log available IFD properties for debugging
          const ifdKeys = Object.keys(ifd).slice(0, 30); // More keys for debugging
          const ifdValues: string[] = [];
          for (const key of ifdKeys.slice(0, 10)) {
            const value = (ifd as any)[key];
            if (typeof value === 'number' || typeof value === 'string') {
              ifdValues.push(`${key}=${value}`);
            }
          }
          
          const t256Value = (ifd as any).t256;
          const t257Value = (ifd as any).t257;
          const tag256Value = ifd[256];
          const tag257Value = ifd[257];
          
          const debugInfo = [
            `IFD properties: ${ifdKeys.join(', ')}`,
            ifdValues.length > 0 ? `Sample values: ${ifdValues.join(', ')}` : '',
            t256Value !== undefined ? `t256=${t256Value}` : '',
            t257Value !== undefined ? `t257=${t257Value}` : '',
            tag256Value !== undefined ? `[256]=${tag256Value}` : '',
            tag257Value !== undefined ? `[257]=${tag257Value}` : '',
            ifd.data ? `data length: ${ifd.data.length}` : 'no data',
          ].filter(Boolean).join('. ');
          
          throw new Error(
            `Invalid TIFF dimensions: ${width}x${height}. ${debugInfo}`
          );
        }
      }
      
      // If we have dimensions but no decoded data, this might be a compressed TIFF
      // that UTIF can't decode. For now, we'll create a placeholder tile source
      // that can be used for viewing (though the image won't render until we support
      // the compression format)
      if (!ifd.data) {
        if (width && height && width > 0 && height > 0) {
          // Try to get compression info using multiple methods
          const compression = selectedManualTags.compression || this.getIFDTag(ifd, 259) || ifd.compression || (ifd as any).compression;
          const photometric = selectedManualTags.photometric || this.getIFDTag(ifd, 262) || ifd.photometric || (ifd as any).photometric;
          const samplesPerPixel = selectedManualTags.samplesPerPixel || this.getIFDTag(ifd, 277) || ifd.spp || (ifd as any).spp;
          const bitsPerSample = selectedManualTags.bitsPerSample || this.getIFDTag(ifd, 258) || ifd.bps || (ifd as any).bps;
          const manualWidth = selectedManualTags.width;
          const manualHeight = selectedManualTags.height;
          
          // If compression is 1 (uncompressed) and we have strip offsets, try manual decoding
          const hasStripOffsets = selectedManualTags.stripOffsets || stripOffsets;
          const hasStripByteCounts = selectedManualTags.stripByteCounts || stripByteCounts;
          
          if (compression === 1 && hasStripOffsets && hasStripByteCounts && manualWidth && manualHeight) {
            console.debug('[TIFF] Attempting manual decode of uncompressed strip-based TIFF...');
            try {
              const stripOffsetsToUse = selectedManualTags.stripOffsets || stripOffsets;
              const stripByteCountsToUse = selectedManualTags.stripByteCounts || stripByteCounts;
              
              // Normalize bitsPerSample - ensure it's an array and values are reasonable
              // bitsPerSample from selectedManualTags might be wrong, so validate it
              let normalizedBitsPerSample: number[] = [8, 8, 8]; // Default for RGB
              
              if (bitsPerSample) {
                if (Array.isArray(bitsPerSample)) {
                  // Check if values are reasonable (typically 1, 4, 8, 16, 32)
                  const validBits = bitsPerSample.filter(b => typeof b === 'number' && b > 0 && b <= 32);
                  if (validBits.length > 0) {
                    normalizedBitsPerSample = validBits;
                  } else {
                    console.debug(`[TIFF] bitsPerSample values seem invalid: ${JSON.stringify(bitsPerSample)}, using default [8, 8, 8]`);
                  }
                } else if (typeof bitsPerSample === 'number' && bitsPerSample > 0 && bitsPerSample <= 32) {
                  normalizedBitsPerSample = [bitsPerSample];
                } else {
                  console.warn(`[TIFF] bitsPerSample is invalid type: ${typeof bitsPerSample}, value: ${bitsPerSample}, using default [8, 8, 8]`);
                }
              } else {
                console.warn(`[TIFF] bitsPerSample is missing, using default [8, 8, 8]`);
              }
              
              // Ensure we have the right number of values for samplesPerPixel
              const spp = samplesPerPixel || 3;
              if (normalizedBitsPerSample.length !== spp) {
                if (normalizedBitsPerSample.length === 1) {
                  // Replicate single value for all samples
                  normalizedBitsPerSample = Array(spp).fill(normalizedBitsPerSample[0]);
                } else {
                  // Use first value for all samples
                  normalizedBitsPerSample = Array(spp).fill(normalizedBitsPerSample[0] || 8);
                }
              }
              
              console.debug(`[TIFF] Using bitsPerSample: ${JSON.stringify(normalizedBitsPerSample)}, samplesPerPixel: ${spp}`);

              const decodedData = this.decodeUncompressedStrips(
                arrayBuffer,
                stripOffsetsToUse,
                stripByteCountsToUse,
                manualWidth,
                manualHeight,
                samplesPerPixel || 3,
                normalizedBitsPerSample,
                photometric || 2
              );
              
              if (decodedData) {
                // Verify decodedData has content
                const hasContent = decodedData.some((val, idx) => idx % 4 !== 3 && val > 0);
                
                if (!hasContent) {
                  console.debug(`[TIFF] Decoded data is empty, will try other methods`);
                  // Don't return empty ImageData - fall through to placeholder
                } else {
                  // Successfully decoded - use the data
                  // Create a new Uint8ClampedArray to ensure it has the correct buffer type
                  const imageDataArray = new Uint8ClampedArray(decodedData);
                  const imageData = new ImageData(imageDataArray, manualWidth, manualHeight);
                  
                  
                  // Update the dimensions in the config if they were provided but wrong
                  
                  return new MemoryTileSource({
                    imageData: imageData,
                    width: manualWidth,
                    height: manualHeight,
                    tileSize,
                  });
                }
              }
            } catch (decodeError) {
              console.debug('[TIFF] Manual decode failed:', decodeError);
            }
          }
          
          // If we get here, manual decoding didn't work or wasn't attempted
          // Only warn if we can't decode at all
          console.warn('[TIFF] No pixel data decoded, and manual decoding failed. This TIFF may use unsupported compression.');
          
          // Create a placeholder MemoryTileSource with a blank image
          // This allows the viewer to work with the dimensions even if we can't decode the pixels
          const placeholderData = new Uint8ClampedArray(width * height * 4);
          // Fill with a checkerboard pattern to indicate it's a placeholder
          for (let i = 0; i < width * height; i++) {
            const x = i % width;
            const y = Math.floor(i / width);
            const checker = ((x >> 4) + (y >> 4)) % 2;
            placeholderData[i * 4] = checker ? 200 : 100;
            placeholderData[i * 4 + 1] = checker ? 200 : 100;
            placeholderData[i * 4 + 2] = checker ? 200 : 100;
            placeholderData[i * 4 + 3] = 255;
          }
          
          const imageData = new ImageData(placeholderData, width, height);
          const canvas = new OffscreenCanvas(width, height);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.putImageData(imageData, 0, 0);
            const imageBitmap = await createImageBitmap(canvas);
            
            
            return new MemoryTileSource({
              imageData: imageBitmap,
              width,
              height,
              tileSize,
            });
          } else {
            console.error('[TIFF] Failed to get canvas context for placeholder');
          }
        }
        
        // If we don't even have dimensions, throw an error
        throw new Error('Failed to decode TIFF: No pixel data found. This TIFF may use a compression format that is not yet supported.');
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
          const gray = sourceData[i] ?? 0;
          rgbaData[i * 4] = gray;     // R
          rgbaData[i * 4 + 1] = gray; // G
          rgbaData[i * 4 + 2] = gray; // B
          rgbaData[i * 4 + 3] = 255;  // A
        }
      } else if (bytesPerPixel === 2) {
        // Grayscale + Alpha: GA -> RGBA (G, G, G, A)
        for (let i = 0; i < totalPixels; i++) {
          const gray = sourceData[i * 2] ?? 0;
          const alpha = sourceData[i * 2 + 1] ?? 255;
          rgbaData[i * 4] = gray;     // R
          rgbaData[i * 4 + 1] = gray; // G
          rgbaData[i * 4 + 2] = gray; // B
          rgbaData[i * 4 + 3] = alpha; // A
        }
      } else if (bytesPerPixel === 3) {
        // RGB: RGB -> RGBA (R, G, B, 255)
        for (let i = 0; i < totalPixels; i++) {
          rgbaData[i * 4] = sourceData[i * 3] ?? 0;     // R
          rgbaData[i * 4 + 1] = sourceData[i * 3 + 1] ?? 0; // G
          rgbaData[i * 4 + 2] = sourceData[i * 3 + 2] ?? 0; // B
          rgbaData[i * 4 + 3] = 255;              // A
        }
      } else if (bytesPerPixel === 4) {
        // RGBA: already in correct format
        rgbaData.set(sourceData.subarray(0, totalPixels * 4));
      }
      
      // Create ImageData with RGBA format
      const imageData = new ImageData(rgbaData, width, height);
      
      // Pass ImageData directly instead of converting to ImageBitmap
      // This avoids issues with OffscreenCanvas ImageBitmaps not being drawable to regular canvases
      // MemoryTileSource will handle the conversion using a regular canvas when needed
      
      return new MemoryTileSource({
        imageData: imageData,  // Pass ImageData directly
        width,
        height,
        tileSize,
        levelCount: 1,
      });
    }

    throw new Error('Unsupported TIFF source type');
  }

  /**
   * Get a TIFF tag value from IFD
   */
  private getIFDTag(ifd: any, tagNumber: number): any {
    // Try 't' prefix (UTIF format)
    const tTag = (ifd as any)[`t${tagNumber}`];
    if (tTag !== undefined) {
      return Array.isArray(tTag) ? tTag : tTag;
    }
    
    // Try numeric key
    const numTag = ifd[tagNumber];
    if (numTag !== undefined) {
      return Array.isArray(numTag) ? numTag : numTag;
    }
    
    return undefined;
  }

  /**
   * Walk the entire IFD chain and return all IFDs with their tags
   * This is essential for BigTIFF files where UTIF may not find all IFDs
   */
  private walkAllIFDs(arrayBuffer: ArrayBuffer): Array<Record<string, any>> {
    const allIFDs: Array<Record<string, any>> = [];
    
    try {
      const view = new DataView(arrayBuffer);
      
      // Check byte order
      const byte0 = view.getUint8(0);
      const byte1 = view.getUint8(1);
      const isLittleEndian = byte0 === 0x49 && byte1 === 0x49;
      const isBigEndian = byte0 === 0x4d && byte1 === 0x4d;
      
      if (!isLittleEndian && !isBigEndian) {
        console.warn('[TIFF] Invalid byte order');
        return allIFDs;
      }
      
      // Read magic number
      const magic = view.getUint16(2, isLittleEndian);
      if (magic !== 42 && magic !== 43) {
        console.warn('[TIFF] Invalid magic number:', magic);
        return allIFDs;
      }
      
      const isBigTIFF = magic === 43;
      
      // Get first IFD offset
      let ifdOffset: number;
      if (isBigTIFF) {
        // BigTIFF header: bytes 4-5 = offset size (should be 8), bytes 6-7 = always 0
        // bytes 8-15 = first IFD offset (64-bit)
        const offsetSize = view.getUint16(4, isLittleEndian);
        if (offsetSize !== 8) {
          console.warn('[TIFF] Unexpected BigTIFF offset size:', offsetSize);
        }
        // Read 64-bit offset
        const low = view.getUint32(8, isLittleEndian);
        const high = view.getUint32(12, isLittleEndian);
        ifdOffset = high === 0 ? low : low; // For files < 4GB, high will be 0
      } else {
        ifdOffset = view.getUint32(4, isLittleEndian);
      }
      
      // Walk the IFD chain
      let ifdIndex = 0;
      const maxIFDs = 100; // Safety limit
      
      while (ifdOffset !== 0 && ifdOffset < arrayBuffer.byteLength && ifdIndex < maxIFDs) {
        const ifdTags = this.readIFDAtOffset(view, ifdOffset, isLittleEndian, isBigTIFF, arrayBuffer.byteLength);
        if (!ifdTags) break;
        
        ifdTags.ifdIndex = ifdIndex;
        allIFDs.push(ifdTags);
        
        // Get next IFD offset
        ifdOffset = ifdTags._nextIFDOffset || 0;
        ifdIndex++;
      }
      
      
    } catch (error) {
      console.error('[TIFF] Error walking IFD chain:', error);
    }
    
    return allIFDs;
  }

  /**
   * Read tags from a single IFD at the given offset
   */
  private readIFDAtOffset(
    view: DataView,
    ifdOffset: number,
    isLittleEndian: boolean,
    isBigTIFF: boolean,
    bufferLength: number
  ): Record<string, any> | null {
    const tags: Record<string, any> = {};
    
    try {
      // Read number of directory entries
      let entryCount: number;
      let entrySize: number;
      let entriesStart: number;
      
      if (isBigTIFF) {
        // BigTIFF: 8-byte entry count
        const countLow = view.getUint32(ifdOffset, isLittleEndian);
        const countHigh = view.getUint32(ifdOffset + 4, isLittleEndian);
        entryCount = countHigh === 0 ? countLow : countLow;
        entrySize = 20; // BigTIFF entries are 20 bytes
        entriesStart = ifdOffset + 8;
      } else {
        entryCount = view.getUint16(ifdOffset, isLittleEndian);
        entrySize = 12; // Standard TIFF entries are 12 bytes
        entriesStart = ifdOffset + 2;
      }
      
      if (entryCount === 0 || entryCount > 10000) {
        console.warn(`[TIFF] Invalid entry count at offset ${ifdOffset}:`, entryCount);
        return null;
      }
      
      // Read each IFD entry
      for (let i = 0; i < entryCount; i++) {
        const entryStart = entriesStart + (i * entrySize);
        if (entryStart + entrySize > bufferLength) break;
        
        const tag = view.getUint16(entryStart, isLittleEndian);
        const type = view.getUint16(entryStart + 2, isLittleEndian);
        let count: number;
        let valueOffset: number;
        
        if (isBigTIFF) {
          // BigTIFF: 8-byte count, 8-byte value/offset
          const countLow = view.getUint32(entryStart + 4, isLittleEndian);
          count = countLow; // Assume count fits in 32 bits
          
          // Value offset is at entry + 12 (8 bytes)
          const valueLow = view.getUint32(entryStart + 12, isLittleEndian);
          valueOffset = valueLow;
        } else {
          count = view.getUint32(entryStart + 4, isLittleEndian);
          valueOffset = view.getUint32(entryStart + 8, isLittleEndian);
        }
        
        // Calculate value size based on type
        const typeSizes: Record<number, number> = {
          1: 1,  // BYTE
          2: 1,  // ASCII
          3: 2,  // SHORT
          4: 4,  // LONG
          5: 8,  // RATIONAL
          6: 1,  // SBYTE
          7: 1,  // UNDEFINED
          8: 2,  // SSHORT
          9: 4,  // SLONG
          10: 8, // SRATIONAL
          11: 4, // FLOAT
          12: 8, // DOUBLE
          16: 8, // LONG8 (BigTIFF)
          17: 8, // SLONG8 (BigTIFF)
          18: 8, // IFD8 (BigTIFF)
        };
        
        const typeSize = typeSizes[type] || 1;
        const totalSize = typeSize * count;
        const inlineThreshold = isBigTIFF ? 8 : 4;
        
        // Determine where to read the value from
        let valuePosition: number;
        if (totalSize <= inlineThreshold) {
          // Value is inline in the entry
          valuePosition = entryStart + (isBigTIFF ? 12 : 8);
        } else {
          // Value is at the offset
          valuePosition = valueOffset;
        }
        
        // Read the value
        let value: any = null;
        
        if (count === 1) {
          if (type === 3) { // SHORT
            value = view.getUint16(valuePosition, isLittleEndian);
          } else if (type === 4) { // LONG
            value = view.getUint32(valuePosition, isLittleEndian);
          } else if (type === 16) { // LONG8
            value = view.getUint32(valuePosition, isLittleEndian); // Lower 32 bits
          }
        } else if (count > 1 && valuePosition < bufferLength) {
          const maxArraySize = 50000;
          if ((type === 3 || type === 4 || type === 16) && count <= maxArraySize) {
            value = [];
            for (let j = 0; j < count && valuePosition + j * typeSize < bufferLength; j++) {
              const pos = valuePosition + j * typeSize;
              if (type === 3) {
                value.push(view.getUint16(pos, isLittleEndian));
              } else if (type === 4) {
                value.push(view.getUint32(pos, isLittleEndian));
              } else if (type === 16) {
                value.push(view.getUint32(pos, isLittleEndian)); // Lower 32 bits
              }
            }
          }
        }
        
        // Store tags we care about
        if (tag === 256) tags.width = value;
        else if (tag === 257) tags.height = value;
        else if (tag === 259) tags.compression = value;
        else if (tag === 262) tags.photometric = value;
        else if (tag === 258) tags.bitsPerSample = value;
        else if (tag === 277) tags.samplesPerPixel = value;
        else if (tag === 273) tags.stripOffsets = value;
        else if (tag === 279) tags.stripByteCounts = value;
        else if (tag === 322) tags.tileWidth = value;
        else if (tag === 323) tags.tileHeight = value;
        else if (tag === 324) tags.tileOffsets = value;
        else if (tag === 325) tags.tileByteCounts = value;
      }
      
      // Read next IFD offset (at end of entries)
      const nextOffsetPos = entriesStart + (entryCount * entrySize);
      if (nextOffsetPos + (isBigTIFF ? 8 : 4) <= bufferLength) {
        if (isBigTIFF) {
          const low = view.getUint32(nextOffsetPos, isLittleEndian);
          const high = view.getUint32(nextOffsetPos + 4, isLittleEndian);
          tags._nextIFDOffset = high === 0 ? low : 0; // Skip >4GB offsets for now
        } else {
          tags._nextIFDOffset = view.getUint32(nextOffsetPos, isLittleEndian);
        }
      }
      
      return tags;
      
    } catch (error) {
      console.error(`[TIFF] Error reading IFD at offset ${ifdOffset}:`, error);
      return null;
    }
  }

  /**
   * Decode uncompressed strip-based TIFF data
   */
  private decodeUncompressedStrips(
    arrayBuffer: ArrayBuffer,
    stripOffsets: number | number[],
    stripByteCounts: number | number[],
    width: number,
    height: number,
    samplesPerPixel: number,
    bitsPerSample: number | number[],
    _photometric: number  // Reserved for future photometric interpretation handling
  ): Uint8ClampedArray | null {
    try {
      const view = new DataView(arrayBuffer);
      // Note: isLittleEndian could be used for 16-bit value decoding in future
      // const isLittleEndian = view.getUint8(0) === 0x49 && view.getUint8(1) === 0x49;
      
      const offsets = Array.isArray(stripOffsets) ? stripOffsets : [stripOffsets];
      const counts = Array.isArray(stripByteCounts) ? stripByteCounts : [stripByteCounts];
      const bps = Array.isArray(bitsPerSample) ? bitsPerSample : [bitsPerSample];
      
      // Calculate bytes per sample from bits per sample
      // bitsPerSample is typically [8, 8, 8] for RGB or [8] for grayscale
      // We need the maximum bits per sample to determine bytes per sample
      const maxBitsPerSample = Math.max(...bps);
      const bytesPerSample = Math.ceil(maxBitsPerSample / 8);
      const bytesPerPixel = samplesPerPixel * bytesPerSample;
      
      // Create output RGBA array
      const output = new Uint8ClampedArray(width * height * 4);
      
      let row = 0;
      let pixelsRead = 0;
      
      for (let i = 0; i < offsets.length && row < height; i++) {
        const offset = offsets[i];
        const byteCount = counts[i];
        
        if (offset === undefined || byteCount === undefined) {
          console.warn(`[TIFF] Strip ${i} has undefined offset or byteCount`);
          continue;
        }
        
        const stripHeight = Math.floor(byteCount / (width * bytesPerPixel));
        
        if (offset + byteCount > arrayBuffer.byteLength) {
          console.warn(`[TIFF] Strip ${i} offset out of bounds: ${offset} + ${byteCount} > ${arrayBuffer.byteLength}`);
          continue;
        }
        
        // Read strip data
        for (let y = 0; y < stripHeight && row < height; y++) {
          for (let x = 0; x < width; x++) {
            const pixelOffset = offset + (y * width + x) * bytesPerPixel;
            const outputOffset = (row * width + x) * 4;
            
            if (pixelOffset + bytesPerPixel > arrayBuffer.byteLength) {
              console.warn(`[TIFF] Pixel out of bounds at strip ${i}, row ${y}, col ${x}`);
              continue;
            }
            
            if (samplesPerPixel === 3 && bytesPerSample === 1) {
              // RGB
              output[outputOffset] = view.getUint8(pixelOffset);
              output[outputOffset + 1] = view.getUint8(pixelOffset + 1);
              output[outputOffset + 2] = view.getUint8(pixelOffset + 2);
              output[outputOffset + 3] = 255;
              pixelsRead++;
            } else if (samplesPerPixel === 1 && bytesPerSample === 1) {
              // Grayscale
              const gray = view.getUint8(pixelOffset);
              output[outputOffset] = gray;
              output[outputOffset + 1] = gray;
              output[outputOffset + 2] = gray;
              output[outputOffset + 3] = 255;
              pixelsRead++;
            } else {
              console.warn(`[TIFF] Unsupported pixel format: samplesPerPixel=${samplesPerPixel}, bytesPerSample=${bytesPerSample}`);
            }
          }
          row++;
        }
      }
      
      // Verify we read some pixels
      if (pixelsRead === 0) {
        console.error(`[TIFF] decodeUncompressedStrips: No pixels were read!`);
        return null;
      }
      
      // Check if output has content
      const hasContent = output.some((val, idx) => idx % 4 !== 3 && val > 0);
      if (!hasContent) {
        console.error(`[TIFF] decodeUncompressedStrips: Output array has no content!`);
        return null;
      }
      
      return output;
    } catch (error) {
      console.error('[TIFF] Error decoding uncompressed strips:', error);
      return null;
    }
  }

  /**
   * Manually read TIFF dimensions from header as fallback
   */
  private readTIFFDimensions(arrayBuffer: ArrayBuffer): [number, number] | null {
    try {
      const view = new DataView(arrayBuffer);
      
      if (arrayBuffer.byteLength < 8) {
        console.warn('[TIFF] ArrayBuffer too small:', arrayBuffer.byteLength);
        return null;
      }
      
      // Read byte order
      const byte0 = view.getUint8(0);
      const byte1 = view.getUint8(1);
      const isLittleEndian = byte0 === 0x49 && byte1 === 0x49;
      const isBigEndian = byte0 === 0x4d && byte1 === 0x4d;
      
      if (!isLittleEndian && !isBigEndian) {
        console.warn('[TIFF] Invalid byte order:', byte0, byte1);
        return null;
      }
      
      // Read TIFF magic number
      // 42 = standard TIFF, 43 = BigTIFF (64-bit offsets)
      const magic = view.getUint16(2, isLittleEndian);
      if (magic !== 42 && magic !== 43) {
        console.warn('[TIFF] Invalid magic number:', magic, '(expected 42 or 43)');
        return null;
      }
      
      const isBigTIFF = magic === 43;
      
      if (isBigTIFF) {
        // BigTIFF uses 64-bit offsets - more complex to parse
        // The walkAllIFDs method handles BigTIFF better, so we skip manual dimension parsing
        console.debug('[TIFF] BigTIFF format detected, manual dimension parser not fully supported (use walkAllIFDs instead)');
        return null;
      }
      
      // Read offset to first IFD
      const ifdOffset = view.getUint32(4, isLittleEndian);
      if (ifdOffset < 8 || ifdOffset >= arrayBuffer.byteLength) {
        console.warn('[TIFF] Invalid IFD offset:', ifdOffset, 'buffer size:', arrayBuffer.byteLength);
        return null;
      }
      
      // Read number of directory entries
      const entryCount = view.getUint16(ifdOffset, isLittleEndian);
      if (entryCount === 0 || entryCount > 100) {
        console.warn('[TIFF] Invalid entry count:', entryCount);
        return null;
      }
      
      let width: number | null = null;
      let height: number | null = null;
      
      // Read directory entries
      for (let i = 0; i < entryCount; i++) {
        const entryOffset = ifdOffset + 2 + (i * 12);
        if (entryOffset + 12 > arrayBuffer.byteLength) {
          console.warn('[TIFF] Entry offset out of bounds:', entryOffset);
          break;
        }
        
        const tag = view.getUint16(entryOffset, isLittleEndian);
        const type = view.getUint16(entryOffset + 2, isLittleEndian);
        const count = view.getUint32(entryOffset + 4, isLittleEndian);
        
        // Tag 256 = ImageWidth, Tag 257 = ImageLength (height)
        if (tag === 256) {
          if (type === 3 && count === 1) {
            // SHORT type (2 bytes)
            width = view.getUint16(entryOffset + 8, isLittleEndian);
          } else if (type === 4 && count === 1) {
            // LONG type (4 bytes)
            width = view.getUint32(entryOffset + 8, isLittleEndian);
          } else if (count > 1) {
            // Value is stored elsewhere, read offset
            const valueOffset = view.getUint32(entryOffset + 8, isLittleEndian);
            if (valueOffset < arrayBuffer.byteLength && type === 3) {
              width = view.getUint16(valueOffset, isLittleEndian);
            } else if (valueOffset < arrayBuffer.byteLength && type === 4) {
              width = view.getUint32(valueOffset, isLittleEndian);
            }
          }
        } else if (tag === 257) {
          if (type === 3 && count === 1) {
            // SHORT type
            height = view.getUint16(entryOffset + 8, isLittleEndian);
          } else if (type === 4 && count === 1) {
            // LONG type
            height = view.getUint32(entryOffset + 8, isLittleEndian);
          } else if (count > 1) {
            // Value is stored elsewhere, read offset
            const valueOffset = view.getUint32(entryOffset + 8, isLittleEndian);
            if (valueOffset < arrayBuffer.byteLength && type === 3) {
              height = view.getUint16(valueOffset, isLittleEndian);
            } else if (valueOffset < arrayBuffer.byteLength && type === 4) {
              height = view.getUint32(valueOffset, isLittleEndian);
            }
          }
        }
        
        if (width && height) {
          break;
        }
      }
      
      if (width && height && width > 0 && height > 0) {
        return [width, height];
      }
      
      console.warn('[TIFF] Could not find width/height in IFD. Found width:', width, 'height:', height);
      return null;
    } catch (error) {
      console.error('[TIFF] Error reading dimensions from header:', error);
      return null;
    }
  }
}

