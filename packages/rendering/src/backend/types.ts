/**
 * Backend interface types
 */

/**
 * View matrix uniform data for shaders
 * Matches ViewUniforms from @tessera/core
 */
export interface ViewUniforms {
  /** View matrix (3x3) as flat array [m00, m01, m02, m10, m11, m12, m20, m21, m22] */
  viewMatrix: Float32Array;
  /** Inverse view matrix */
  invViewMatrix: Float32Array;
  /** Viewport size in screen pixels [width, height] */
  viewportSize: [number, number];
  /** Device pixel ratio */
  dpr: number;
}

/**
 * Tile data structure
 */
export interface Tile {
  /** Tile coordinates (level, x, y) */
  level: number;
  x: number;
  y: number;
  
  /** Tile size in pixels */
  width: number;
  height: number;
  
  /** Position in image space (pixels) */
  imageX: number;
  imageY: number;
  
  /** Texture data (backend-specific) */
  texture?: any;
  
  /** ImageBitmap for upload */
  imageBitmap?: ImageBitmap;
  
  /** Whether tile is loaded */
  loaded: boolean;
  
  /** Whether tile is currently visible */
  visible: boolean;
  
  /** Last access time for LRU eviction */
  lastAccess: number;
}

/**
 * Annotation batch for rendering
 */
export interface AnnotationBatch {
  /** Batch of annotations to render */
  annotations: any[];
  /** Common style properties */
  style?: any;
}

/**
 * Overlay data for rendering
 */
export interface Overlay {
  /** Overlay type */
  type: string;
  /** Overlay data */
  data: any;
  /** Z-index */
  zIndex: number;
}

/**
 * Render backend interface
 */
export interface RenderBackend {
  /** Initialize the backend */
  init(canvas: HTMLCanvasElement): Promise<void>;
  
  /** Resize the canvas */
  resize?(width: number, height: number): void;
  
  /** Clear the canvas */
  clear(): void;
  
  /** Render tiles */
  renderTiles?(tiles: Tile[], view: ViewUniforms): void;
  
  /** Render annotations */
  renderAnnotations?(batch: AnnotationBatch, view: ViewUniforms): void;
  
  /** Render overlays */
  renderOverlays?(overlays: Overlay[], view: ViewUniforms): void;
  
  /** Upload a tile texture */
  uploadTile?(tile: Tile): Promise<void>;
  
  /** Destroy the backend and clean up resources */
  destroy?(): void;
}

