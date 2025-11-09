/**
 * URL template utilities for generating tile URLs
 */

import type { URLTemplate } from './types.js';

/**
 * Parse a URL template string into a template function
 * Supports placeholders: {level}, {x}, {y}, {tileSize}, {baseUrl}
 */
export function parseURLTemplate(template: string): URLTemplate {
  return (params) => {
    let url = template;
    
    // Replace placeholders
    url = url.replace(/\{level\}/g, String(params.level));
    url = url.replace(/\{x\}/g, String(params.x));
    url = url.replace(/\{y\}/g, String(params.y));
    url = url.replace(/\{tileSize\}/g, String(params.tileSize));
    url = url.replace(/\{baseUrl\}/g, params.baseUrl);
    
    // Replace any additional custom parameters
    for (const [key, value] of Object.entries(params)) {
      if (!['level', 'x', 'y', 'tileSize', 'baseUrl'].includes(key)) {
        url = url.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
      }
    }
    
    return url;
  };
}

/**
 * Common URL template patterns
 */
export const URLTemplates = {
  /**
   * Standard tile URL pattern: /tiles/{level}/{x}/{y}
   */
  standard: parseURLTemplate('{baseUrl}/tiles/{level}/{x}/{y}'),
  
  /**
   * Z/X/Y pattern: /{z}/{x}/{y}
   */
  zxy: parseURLTemplate('{baseUrl}/{level}/{x}/{y}'),
  
  /**
   * Query parameter pattern: /tile?level={level}&x={x}&y={y}
   */
  query: parseURLTemplate('{baseUrl}/tile?level={level}&x={x}&y={y}'),
  
  /**
   * IIIF pattern: /{x},{y},{width},{height}/{size}/0/default.jpg
   */
  iiif: (params: Parameters<URLTemplate>[0]) => {
    const tileX = params.x * params.tileSize;
    const tileY = params.y * params.tileSize;
    return `${params.baseUrl}/${tileX},${tileY},${params.tileSize},${params.tileSize}/${params.tileSize}/0/default.jpg`;
  },
  
  /**
   * TMS (Tile Map Service) pattern: /{level}/{x}/{y}.png
   */
  tms: parseURLTemplate('{baseUrl}/{level}/{x}/{y}.png'),
  
  /**
   * WMTS (Web Map Tile Service) pattern: /{level}/{y}/{x}
   */
  wmts: parseURLTemplate('{baseUrl}/{level}/{y}/{x}'),
};

/**
 * Create a custom URL template from a string
 */
export function createURLTemplate(template: string): URLTemplate {
  return parseURLTemplate(template);
}

