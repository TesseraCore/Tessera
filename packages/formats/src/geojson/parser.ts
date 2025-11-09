/**
 * GeoJSON parser (for overlays and annotations)
 * Note: This is not a tile source format, but rather a format for overlays
 */

import { BaseFormatParser } from '../base.js';
import type { FormatConfig, FormatMetadata } from '../types.js';
import type { TileSource } from '@tessera/rendering';

/**
 * GeoJSON parser configuration
 */
export interface GeoJSONConfig extends FormatConfig {
  /** Base URL for GeoJSON files */
  baseUrl?: string;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * GeoJSON parser
 * Note: GeoJSON is typically used for overlays/annotations, not as a tile source.
 * This parser provides a way to load GeoJSON data that can be used with the
 * annotation system.
 */
export class GeoJSONParser extends BaseFormatParser {
  readonly metadata: FormatMetadata = {
    id: 'geojson',
    name: 'GeoJSON',
    description: 'GeoJSON format for geographic data overlays',
    mimeTypes: ['application/geo+json', 'application/json'],
    extensions: ['geojson', 'json'],
    supportsTiling: false,
    supportsPyramids: false,
    supportsMultiChannel: false,
  };

  async canParse(source: string | ArrayBuffer | File): Promise<boolean> {
    if (typeof source === 'string') {
      const url = source.toLowerCase();
      return url.endsWith('.geojson') || url.endsWith('.json');
    }

    if (source instanceof File) {
      const name = source.name.toLowerCase();
      return name.endsWith('.geojson') || name.endsWith('.json');
    }

    // Check if ArrayBuffer contains GeoJSON
    if (source instanceof ArrayBuffer) {
      try {
        const text = new TextDecoder().decode(source.slice(0, 100));
        return text.includes('"type"') && (
          text.includes('"Feature"') ||
          text.includes('"FeatureCollection"') ||
          text.includes('"Point"') ||
          text.includes('"Polygon"')
        );
      } catch {
        return false;
      }
    }

    return false;
  }

  async parse(
    source: string | ArrayBuffer | File,
    config?: GeoJSONConfig
  ): Promise<TileSource> {
    // GeoJSON is not a tile source format
    // This is a placeholder that throws an informative error
    // In practice, GeoJSON would be parsed separately and used with the annotation system
    throw new Error(
      'GeoJSON is not a tile source format. ' +
      'Use the @tessera/import package to import GeoJSON as annotations instead.'
    );
  }

  /**
   * Parse GeoJSON data (separate from tile source creation)
   */
  async parseGeoJSON(
    source: string | ArrayBuffer | File
  ): Promise<GeoJSON.FeatureCollection> {
    let text: string;

    if (typeof source === 'string') {
      const response = await fetch(source);
      text = await response.text();
    } else if (source instanceof File) {
      text = await source.text();
    } else {
      text = new TextDecoder().decode(source);
    }

    return JSON.parse(text) as GeoJSON.FeatureCollection;
  }
}

// GeoJSON type definitions
declare namespace GeoJSON {
  export interface FeatureCollection {
    type: 'FeatureCollection';
    features: Feature[];
  }

  export interface Feature {
    type: 'Feature';
    geometry: Geometry;
    properties?: Record<string, any>;
  }

  export type Geometry =
    | Point
    | LineString
    | Polygon
    | MultiPoint
    | MultiLineString
    | MultiPolygon
    | GeometryCollection;

  export interface Point {
    type: 'Point';
    coordinates: [number, number];
  }

  export interface LineString {
    type: 'LineString';
    coordinates: [number, number][];
  }

  export interface Polygon {
    type: 'Polygon';
    coordinates: [number, number][][];
  }

  export interface MultiPoint {
    type: 'MultiPoint';
    coordinates: [number, number][];
  }

  export interface MultiLineString {
    type: 'MultiLineString';
    coordinates: [number, number][][];
  }

  export interface MultiPolygon {
    type: 'MultiPolygon';
    coordinates: [number, number][][][];
  }

  export interface GeometryCollection {
    type: 'GeometryCollection';
    geometries: Geometry[];
  }
}

