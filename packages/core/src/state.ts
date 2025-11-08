/**
 * State management for Tessera viewer
 */

import type { ViewportState } from './viewport.js';

/**
 * Rendering backend type
 */
export type RenderBackendType = 'webgpu' | 'webgl2' | 'webgl' | 'canvas2d';

/**
 * Viewer state
 */
export interface ViewerState {
  /** Canvas element */
  canvas: HTMLCanvasElement | null;
  /** Current rendering backend */
  backend: RenderBackendType | null;
  /** Viewport state */
  viewport: ViewportState;
  /** Image source URL or data */
  imageSource: string | ArrayBuffer | null;
  /** Image dimensions in pixels [width, height] */
  imageSize: [number, number] | null;
  /** Image format (tiff, zarr, dicom, iiif, etc.) */
  imageFormat: string | null;
  /** Whether the viewer is initialized */
  initialized: boolean;
  /** Whether the viewer is ready to render */
  ready: boolean;
  /** Error state */
  error: Error | null;
}

/**
 * Viewer configuration options
 */
export interface ViewerOptions {
  /** Canvas element to render to */
  canvas: HTMLCanvasElement;
  /** Preferred rendering backend (will fallback if unavailable) */
  preferredBackend?: RenderBackendType;
  /** Viewport options */
  viewport?: import('./viewport.js').ViewportOptions;
  /** Enable debug logging */
  debug?: boolean;
}
