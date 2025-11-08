/**
 * Ellipse primitive
 */

import type { Point } from './point.js';

export interface Ellipse {
  center: Point;
  radiusX: number;
  radiusY: number;
}

