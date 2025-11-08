/**
 * Main viewer class for Tessera
 * 
 * The Viewer is the main entry point that orchestrates all subsystems including
 * rendering, annotations, tools, events, units, and calibration.
 */

import { EventEmitter } from '@tessera/events';
import { Viewport, type ViewportOptions } from './viewport.js';
import type { ViewerState, ViewerOptions, RenderBackendType } from './state.js';

// Import types from other packages (these may be stubs for now)
import type { TileManager } from '@tessera/rendering';
import type { AnnotationStore } from '@tessera/annotations';

/**
 * Viewer events
 */
export interface ViewerEvents {
  'viewer:ready': { viewer: Viewer };
  'viewer:error': { error: Error };
  'viewer:backend-changed': { backend: RenderBackendType };
  'viewer:image-loaded': { source: string | ArrayBuffer; size: [number, number]; format: string };
  'viewer:resize': { width: number; height: number };
}

/**
 * Main Viewer class
 */
export class Viewer extends EventEmitter<ViewerEvents> {
  /** Canvas element */
  readonly canvas: HTMLCanvasElement;
  
  /** Current viewer state */
  readonly state: ViewerState;
  
  /** Viewport instance */
  readonly viewport: Viewport;
  
  /** Tile manager (lazy initialized) */
  tiles: TileManager | null = null;
  
  /** Annotation store (lazy initialized) */
  annotations: AnnotationStore | null = null;
  
  /** Current rendering backend (lazy initialized) */
  private backend: any = null;
  
  /** Backend type */
  private backendType: RenderBackendType | null = null;
  
  /** Configuration options */
  private options: Required<Pick<ViewerOptions, 'preferredBackend' | 'debug'>> & { viewport: ViewportOptions };
  
  /** Animation frame ID */
  private animationFrameId: number | null = null;
  
  /** Resize observer */
  private resizeObserver: ResizeObserver | null = null;
  
  /** Whether rendering is paused */
  private paused = false;

  constructor(options: ViewerOptions) {
    super();
    
    this.canvas = options.canvas;
    this.options = {
      preferredBackend: options.preferredBackend ?? 'webgpu',
      debug: options.debug ?? false,
      viewport: options.viewport ?? {},
    };
    
    // Initialize viewport
    this.viewport = new Viewport(this.options.viewport);
    
    // Initialize state
    this.state = {
      canvas: this.canvas,
      backend: null,
      viewport: this.viewport.getState(),
      imageSource: null,
      imageSize: null,
      imageFormat: null,
      initialized: false,
      ready: false,
      error: null,
    };
    
    // Listen to viewport changes
    this.viewport.on('viewport:change', () => {
      this.updateState();
      this.requestRender();
    });
    
    this.viewport.on('viewport:resize', (payload) => {
      this.emit('viewer:resize', { width: payload.width, height: payload.height });
    });
    
    // Initialize
    this.init();
  }

  /**
   * Initialize the viewer
   */
  private async init(): Promise<void> {
    try {
      // Set up canvas
      this.setupCanvas();
      
      // Initialize rendering backend
      await this.initBackend();
      
      // Set up resize observer
      this.setupResizeObserver();
      
      // Update state
      this.updateState();
      this.state.initialized = true;
      
      if (this.options.debug) {
        console.log('[Tessera] Viewer initialized', {
          backend: this.backendType,
          canvas: `${this.canvas.width}x${this.canvas.height}`,
        });
      }
      
      this.emit('viewer:ready', { viewer: this });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.state.error = err;
      this.emit('viewer:error', { error: err });
      
      if (this.options.debug) {
        console.error('[Tessera] Viewer initialization failed:', err);
      }
    }
  }

  /**
   * Set up canvas
   */
  private setupCanvas(): void {
    // Set initial size
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio ?? 1;
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    this.viewport.setSize(rect.width, rect.height);
    this.viewport.setDPR(dpr);
  }

  /**
   * Initialize rendering backend with fallback chain
   */
  private async initBackend(): Promise<void> {
    const backends: RenderBackendType[] = [
      this.options.preferredBackend,
      'webgpu',
      'webgl2',
      'webgl',
      'canvas2d',
    ];
    
    // Remove duplicates while preserving order
    const uniqueBackends = Array.from(new Set(backends));
    
    for (const backendType of uniqueBackends) {
      try {
        if (await this.tryInitBackend(backendType)) {
          this.backendType = backendType;
          this.state.backend = backendType;
          this.updateState();
          this.emit('viewer:backend-changed', { backend: backendType });
          
          if (this.options.debug) {
            console.log(`[Tessera] Initialized ${backendType} backend`);
          }
          
          return;
        }
      } catch (error) {
        if (this.options.debug) {
          console.warn(`[Tessera] Failed to initialize ${backendType} backend:`, error);
        }
        continue;
      }
    }
    
    throw new Error('Failed to initialize any rendering backend');
  }

  /**
   * Try to initialize a specific backend
   */
  private async tryInitBackend(backendType: RenderBackendType): Promise<boolean> {
    // Dynamic import to avoid loading all backends at once
    switch (backendType) {
      case 'webgpu':
        if (typeof navigator !== 'undefined' && 'gpu' in navigator && (navigator as any).gpu) {
          const { WebGPUBackend } = await import('@tessera/rendering');
          this.backend = new WebGPUBackend();
          await this.backend.init?.(this.canvas);
          return true;
        }
        return false;
        
      case 'webgl2':
        try {
          const { WebGL2Backend } = await import('@tessera/rendering');
          this.backend = new WebGL2Backend();
          await this.backend.init?.(this.canvas);
          return true;
        } catch {
          return false;
        }
        
      case 'webgl':
        try {
          const { WebGLBackend } = await import('@tessera/rendering');
          this.backend = new WebGLBackend();
          await this.backend.init?.(this.canvas);
          return true;
        } catch {
          return false;
        }
        
      case 'canvas2d':
        const { Canvas2DBackend } = await import('@tessera/rendering');
        this.backend = new Canvas2DBackend();
        await this.backend.init?.(this.canvas);
        return true;
        
      default:
        return false;
    }
  }

  /**
   * Set up resize observer
   */
  private setupResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') {
      // Fallback for browsers without ResizeObserver
      window.addEventListener('resize', () => this.handleResize());
      return;
    }
    
    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    
    this.resizeObserver.observe(this.canvas);
  }

  /**
   * Handle canvas resize
   */
  private handleResize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio ?? 1;
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    this.viewport.setSize(rect.width, rect.height);
    this.viewport.setDPR(dpr);
    
    // Notify backend of resize
    if (this.backend?.resize) {
      this.backend.resize(this.canvas.width, this.canvas.height);
    }
    
    this.requestRender();
  }

  /**
   * Load an image
   */
  async loadImage(
    source: string | ArrayBuffer,
    format?: string,
    size?: [number, number]
  ): Promise<void> {
    try {
      this.state.imageSource = source;
      this.state.imageFormat = format ?? null;
      
      // If size is provided, use it; otherwise we'll need to detect it
      if (size) {
        this.state.imageSize = size;
        this.viewport.setImageSize(size[0], size[1]);
      }
      
      // TODO: Initialize tile manager with image source
      // For now, just update state
      
      this.updateState();
      this.state.ready = true;
      
      this.emit('viewer:image-loaded', {
        source,
        size: this.state.imageSize ?? [0, 0],
        format: this.state.imageFormat ?? 'unknown',
      });
      
      this.requestRender();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.state.error = err;
      this.emit('viewer:error', { error: err });
      throw err;
    }
  }

  /**
   * Get the current rendering backend type
   */
  getBackend(): RenderBackendType | null {
    return this.backendType;
  }

  /**
   * Request a render frame
   */
  requestRender(): void {
    if (this.paused || this.animationFrameId !== null) {
      return;
    }
    
    this.animationFrameId = requestAnimationFrame(() => {
      this.animationFrameId = null;
      this.render();
    });
  }

  /**
   * Render the current frame
   */
  private render(): void {
    if (!this.backend || !this.state.ready) {
      return;
    }
    
    try {
      // Clear the canvas
      if (this.backend.clear) {
        this.backend.clear();
      }
      
      // Get view uniforms from viewport
      const viewUniforms = this.viewport.getViewUniforms();
      
      // Render tiles if available
      if (this.tiles && this.backend.renderTiles) {
        // TODO: Get visible tiles from tile manager
        // const visibleTiles = this.tiles.getVisibleTiles(viewUniforms);
        // this.backend.renderTiles(visibleTiles, viewUniforms);
      }
      
      // Render annotations if available
      if (this.annotations && this.backend.renderAnnotations) {
        // TODO: Get visible annotations and batch them
        // const visibleAnnotations = this.annotations.query(viewportBBox);
        // const batch = this.batchAnnotations(visibleAnnotations);
        // this.backend.renderAnnotations(batch, viewUniforms);
      }
      
      // Render overlays if available
      if (this.backend.renderOverlays) {
        // TODO: Render UI overlays (handles, previews, etc.)
        // this.backend.renderOverlays(overlays, viewUniforms);
      }
      
      // Use viewUniforms to avoid unused variable warning
      void viewUniforms;
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.state.error = err;
      this.emit('viewer:error', { error: err });
      
      if (this.options.debug) {
        console.error('[Tessera] Render error:', err);
      }
    }
  }

  /**
   * Pause rendering
   */
  pause(): void {
    this.paused = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Resume rendering
   */
  resume(): void {
    this.paused = false;
    this.requestRender();
  }

  /**
   * Update internal state from viewport
   */
  private updateState(): void {
    this.state.viewport = this.viewport.getState();
  }

  /**
   * Destroy the viewer and clean up resources
   */
  destroy(): void {
    // Cancel any pending renders
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Disconnect resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    
    // Clean up backend
    if (this.backend?.destroy) {
      this.backend.destroy();
    }
    this.backend = null;
    this.backendType = null;
    
    // Clean up subsystems
    this.tiles = null;
    this.annotations = null;
    
    // Remove all listeners
    this.removeAllListeners();
    this.viewport.removeAllListeners();
    
    if (this.options.debug) {
      console.log('[Tessera] Viewer destroyed');
    }
  }
}
