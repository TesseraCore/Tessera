/**
 * Viewport management for Tessera viewer
 * 
 * Manages the viewport state including zoom, pan, rotation, and coordinate transformations.
 * All coordinates are in image-space (pixels) unless otherwise specified.
 */

import { EventEmitter } from '@tessera/events';

/**
 * Viewport configuration options
 */
export interface ViewportOptions {
  /** Initial zoom level (1.0 = 100%, 2.0 = 200%, etc.) */
  initialZoom?: number;
  /** Initial pan offset in image pixels [x, y] */
  initialPan?: [number, number];
  /** Initial rotation in radians */
  initialRotation?: number;
  /** Minimum zoom level */
  minZoom?: number;
  /** Maximum zoom level */
  maxZoom?: number;
  /** Zoom step multiplier for wheel events */
  zoomStep?: number;
  /** Enable rotation */
  enableRotation?: boolean;
  /** Constrain pan to image bounds */
  constrainPan?: boolean;
}

/**
 * Viewport state
 */
export interface ViewportState {
  /** Current zoom level */
  zoom: number;
  /** Pan offset in image pixels [x, y] */
  pan: [number, number];
  /** Rotation in radians */
  rotation: number;
  /** Viewport width in screen pixels */
  width: number;
  /** Viewport height in screen pixels */
  height: number;
  /** Device pixel ratio */
  dpr: number;
  /** Image dimensions in pixels [width, height] */
  imageSize: [number, number] | null;
}

/**
 * View matrix uniform data for shaders
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
 * Viewport events
 */
export interface ViewportEvents {
  'viewport:change': ViewportState;
  'viewport:zoom': { zoom: number; center: [number, number] };
  'viewport:pan': { pan: [number, number] };
  'viewport:rotate': { rotation: number };
  'viewport:resize': { width: number; height: number };
}

/**
 * Viewport class for managing view transformations
 */
export class Viewport extends EventEmitter<ViewportEvents> {
  private state: ViewportState;
  private options: Required<ViewportOptions>;
  private viewMatrix = new Float32Array(9);
  private invViewMatrix = new Float32Array(9);

  constructor(options: ViewportOptions = {}) {
    super();
    
    this.options = {
      initialZoom: options.initialZoom ?? 1.0,
      initialPan: options.initialPan ?? [0, 0],
      initialRotation: options.initialRotation ?? 0,
      minZoom: options.minZoom ?? 0.01,
      maxZoom: options.maxZoom ?? 1000,
      zoomStep: options.zoomStep ?? 1.1,
      enableRotation: options.enableRotation ?? true,
      constrainPan: options.constrainPan ?? true,
    };

    this.state = {
      zoom: this.options.initialZoom,
      pan: [...this.options.initialPan] as [number, number],
      rotation: this.options.initialRotation,
      width: 0,
      height: 0,
      dpr: typeof window !== 'undefined' ? window.devicePixelRatio ?? 1 : 1,
      imageSize: null,
    };

    this.updateViewMatrix();
  }

  /**
   * Get current viewport state
   */
  getState(): Readonly<ViewportState> {
    return { ...this.state };
  }

  /**
   * Set viewport size (call when canvas resizes)
   */
  setSize(width: number, height: number): void {
    if (this.state.width !== width || this.state.height !== height) {
      this.state.width = width;
      this.state.height = height;
      this.updateViewMatrix();
      this.emit('viewport:resize', { width, height });
      this.emit('viewport:change', this.getState());
    }
  }

  /**
   * Set image dimensions (required for pan constraints)
   */
  setImageSize(width: number, height: number): void {
    this.state.imageSize = [width, height];
    if (this.options.constrainPan) {
      this.constrainPan();
    }
    this.updateViewMatrix();
    this.emit('viewport:change', this.getState());
  }

  /**
   * Set device pixel ratio
   */
  setDPR(dpr: number): void {
    this.state.dpr = dpr;
    this.updateViewMatrix();
    this.emit('viewport:change', this.getState());
  }

  /**
   * Get current zoom level
   */
  getZoom(): number {
    return this.state.zoom;
  }

  /**
   * Set zoom level
   */
  setZoom(zoom: number, center?: [number, number]): void {
    const oldZoom = this.state.zoom;
    const clampedZoom = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, zoom));
    
    if (clampedZoom !== this.state.zoom) {
      // If center is provided, zoom around that point
      if (center) {
        const [cx, cy] = center;
        const [px, py] = this.state.pan;
        
        // Calculate new pan to keep the center point fixed
        const zoomRatio = clampedZoom / oldZoom;
        const newPanX = cx - (cx - px) * zoomRatio;
        const newPanY = cy - (cy - py) * zoomRatio;
        
        this.state.pan = [newPanX, newPanY];
      }
      
      this.state.zoom = clampedZoom;
      this.updateViewMatrix();
      
      if (this.options.constrainPan) {
        this.constrainPan();
      }
      
      this.emit('viewport:zoom', { zoom: this.state.zoom, center: center ?? [0, 0] });
      this.emit('viewport:change', this.getState());
    }
  }

  /**
   * Zoom by a factor relative to current zoom
   */
  zoomBy(factor: number, center?: [number, number]): void {
    this.setZoom(this.state.zoom * factor, center);
  }

  /**
   * Zoom in by one step
   */
  zoomIn(center?: [number, number]): void {
    this.zoomBy(this.options.zoomStep, center);
  }

  /**
   * Zoom out by one step
   */
  zoomOut(center?: [number, number]): void {
    this.zoomBy(1 / this.options.zoomStep, center);
  }

  /**
   * Get current pan offset
   */
  getPan(): [number, number] {
    return [...this.state.pan] as [number, number];
  }

  /**
   * Set pan offset
   */
  setPan(pan: [number, number]): void {
    this.state.pan = [...pan] as [number, number];
    
    if (this.options.constrainPan) {
      this.constrainPan();
    }
    
    this.updateViewMatrix();
    this.emit('viewport:pan', { pan: this.getPan() });
    this.emit('viewport:change', this.getState());
  }

  /**
   * Pan by a delta
   */
  panBy(delta: [number, number]): void {
    this.setPan([this.state.pan[0] + delta[0], this.state.pan[1] + delta[1]]);
  }

  /**
   * Get current rotation in radians
   */
  getRotation(): number {
    return this.state.rotation;
  }

  /**
   * Set rotation in radians
   */
  setRotation(rotation: number): void {
    if (!this.options.enableRotation) return;
    
    // Normalize rotation to [0, 2π)
    this.state.rotation = ((rotation % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
    this.updateViewMatrix();
    this.emit('viewport:rotate', { rotation: this.state.rotation });
    this.emit('viewport:change', this.getState());
  }

  /**
   * Rotate by a delta
   */
  rotateBy(delta: number): void {
    this.setRotation(this.state.rotation + delta);
  }

  /**
   * Reset viewport to initial state
   */
  reset(): void {
    this.state.zoom = this.options.initialZoom;
    this.state.pan = [...this.options.initialPan] as [number, number];
    this.state.rotation = this.options.initialRotation;
    this.updateViewMatrix();
    this.emit('viewport:change', this.getState());
  }

  /**
   * Fit image to viewport
   * 
   * Adjusts zoom so the entire image fits within the viewport,
   * and centers the image. The image will be fully visible with
   * letterboxing/pillarboxing if aspect ratios don't match.
   */
  fitToView(): void {
    if (!this.state.imageSize) return;
    
    const [imgWidth, imgHeight] = this.state.imageSize;
    const [vpWidth, vpHeight] = [this.state.width, this.state.height];
    
    if (vpWidth === 0 || vpHeight === 0 || imgWidth === 0 || imgHeight === 0) return;
    
    // Calculate zoom to fit entire image in viewport
    const scaleX = vpWidth / imgWidth;
    const scaleY = vpHeight / imgHeight;
    const scale = Math.min(scaleX, scaleY);
    
    // Set zoom (bypassing setZoom to avoid emitting multiple events)
    this.state.zoom = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, scale));
    
    // Center the image - pan [0, 0] centers because updateViewMatrix 
    // already translates by -imgWidth/2, -imgHeight/2
    this.state.pan = [0, 0];
    
    this.updateViewMatrix();
    this.emit('viewport:zoom', { zoom: this.state.zoom, center: [0, 0] });
    this.emit('viewport:pan', { pan: this.getPan() });
    this.emit('viewport:change', this.getState());
  }

  /**
   * Convert image coordinates to screen coordinates
   */
  imageToScreen(point: [number, number]): [number, number] {
    const [x, y] = point;
    const m00 = this.viewMatrix[0] ?? 0;
    const m01 = this.viewMatrix[1] ?? 0;
    const m02 = this.viewMatrix[2] ?? 0;
    const m10 = this.viewMatrix[3] ?? 0;
    const m11 = this.viewMatrix[4] ?? 0;
    const m12 = this.viewMatrix[5] ?? 0;
    
    const sx = m00 * x + m01 * y + m02;
    const sy = m10 * x + m11 * y + m12;
    
    return [sx, sy];
  }

  /**
   * Convert screen coordinates to image coordinates
   */
  screenToImage(point: [number, number]): [number, number] {
    const [x, y] = point;
    const m00 = this.invViewMatrix[0] ?? 0;
    const m01 = this.invViewMatrix[1] ?? 0;
    const m02 = this.invViewMatrix[2] ?? 0;
    const m10 = this.invViewMatrix[3] ?? 0;
    const m11 = this.invViewMatrix[4] ?? 0;
    const m12 = this.invViewMatrix[5] ?? 0;
    
    const ix = m00 * x + m01 * y + m02;
    const iy = m10 * x + m11 * y + m12;
    
    return [ix, iy];
  }

  /**
   * Get view uniforms for shaders
   */
  getViewUniforms(): ViewUniforms {
    return {
      viewMatrix: new Float32Array(this.viewMatrix),
      invViewMatrix: new Float32Array(this.invViewMatrix),
      viewportSize: [this.state.width, this.state.height],
      dpr: this.state.dpr,
    };
  }

  /**
   * Get the view matrix (3x3)
   */
  getViewMatrix(): Float32Array {
    return new Float32Array(this.viewMatrix);
  }

  /**
   * Get the inverse view matrix (3x3)
   */
  getInverseViewMatrix(): Float32Array {
    return new Float32Array(this.invViewMatrix);
  }

  /**
   * Update the view matrix based on current state
   */
  private updateViewMatrix(): void {
    const { zoom, pan, rotation, width, height, dpr } = this.state;
    
    // View matrix transforms image coordinates to screen coordinates
    // Order: translate to center, rotate, scale, translate pan, translate to viewport center
    
    const cx = width / (2 * dpr);
    const cy = height / (2 * dpr);
    
    // Start with identity
    const m = this.viewMatrix;
    m[0] = 1; m[1] = 0; m[2] = 0;
    m[3] = 0; m[4] = 1; m[5] = 0;
    m[6] = 0; m[7] = 0; m[8] = 1;
    
    // Translate to viewport center
    this.translate(m, cx, cy);
    
    // Apply zoom
    this.scale(m, zoom, zoom);
    
    // Apply rotation
    if (rotation !== 0) {
      this.rotate(m, rotation);
    }
    
    // Apply pan
    this.translate(m, pan[0], pan[1]);
    
    // Translate to image center (if image size is known)
    if (this.state.imageSize) {
      const [imgWidth, imgHeight] = this.state.imageSize;
      this.translate(m, -imgWidth / 2, -imgHeight / 2);
    }
    
    // Calculate inverse matrix
    this.invert(this.viewMatrix, this.invViewMatrix);
  }

  /**
   * Constrain pan to image bounds
   */
  private constrainPan(): void {
    if (!this.state.imageSize || !this.options.constrainPan) return;
    
    const [imgWidth, imgHeight] = this.state.imageSize;
    const { zoom, width, height, dpr } = this.state;
    
    const vpWidth = width / dpr;
    const vpHeight = height / dpr;
    
    // Calculate bounds
    const minPanX = vpWidth / 2 / zoom - imgWidth / 2;
    const maxPanX = imgWidth / 2 - vpWidth / 2 / zoom;
    const minPanY = vpHeight / 2 / zoom - imgHeight / 2;
    const maxPanY = imgHeight / 2 - vpHeight / 2 / zoom;
    
    // Clamp pan
    const pan0 = this.state.pan[0];
    const pan1 = this.state.pan[1];
    if (pan0 !== undefined && pan1 !== undefined) {
      this.state.pan[0] = Math.max(minPanX, Math.min(maxPanX, pan0));
      this.state.pan[1] = Math.max(minPanY, Math.min(maxPanY, pan1));
    }
  }

  /**
   * Matrix operations (3x3 matrices stored as flat arrays)
   */
  private translate(m: Float32Array, tx: number, ty: number): void {
    const m0 = m[0] ?? 0;
    const m1 = m[1] ?? 0;
    const m3 = m[3] ?? 0;
    const m4 = m[4] ?? 0;
    m[2] = (m[2] ?? 0) + m0 * tx + m1 * ty;
    m[5] = (m[5] ?? 0) + m3 * tx + m4 * ty;
  }

  private scale(m: Float32Array, sx: number, sy: number): void {
    m[0] = (m[0] ?? 0) * sx;
    m[1] = (m[1] ?? 0) * sy;
    m[3] = (m[3] ?? 0) * sx;
    m[4] = (m[4] ?? 0) * sy;
  }

  private rotate(m: Float32Array, angle: number): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const m00 = m[0] ?? 0;
    const m01 = m[1] ?? 0;
    const m10 = m[3] ?? 0;
    const m11 = m[4] ?? 0;
    
    m[0] = m00 * cos - m01 * sin;
    m[1] = m00 * sin + m01 * cos;
    m[3] = m10 * cos - m11 * sin;
    m[4] = m10 * sin + m11 * cos;
  }

  private invert(m: Float32Array, out: Float32Array): void {
    const m00 = m[0] ?? 0;
    const m01 = m[1] ?? 0;
    const m02 = m[2] ?? 0;
    const m10 = m[3] ?? 0;
    const m11 = m[4] ?? 0;
    const m12 = m[5] ?? 0;
    const m20 = m[6] ?? 0;
    const m21 = m[7] ?? 0;
    const m22 = m[8] ?? 0;
    
    const det = m00 * (m11 * m22 - m21 * m12) -
                m01 * (m10 * m22 - m20 * m12) +
                m02 * (m10 * m21 - m20 * m11);
    
    if (Math.abs(det) < 1e-10) {
      // Singular matrix, return identity
      out[0] = 1; out[1] = 0; out[2] = 0;
      out[3] = 0; out[4] = 1; out[5] = 0;
      out[6] = 0; out[7] = 0; out[8] = 1;
      return;
    }
    
    const invDet = 1 / det;
    
    out[0] = (m11 * m22 - m21 * m12) * invDet;
    out[1] = (m02 * m21 - m01 * m22) * invDet;
    out[2] = (m01 * m12 - m02 * m11) * invDet;
    out[3] = (m12 * m20 - m10 * m22) * invDet;
    out[4] = (m00 * m22 - m02 * m20) * invDet;
    out[5] = (m02 * m10 - m00 * m12) * invDet;
    out[6] = (m10 * m21 - m11 * m20) * invDet;
    out[7] = (m01 * m20 - m00 * m21) * invDet;
    out[8] = (m00 * m11 - m01 * m10) * invDet;
  }
}
