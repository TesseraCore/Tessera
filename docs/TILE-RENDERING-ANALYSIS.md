# Tile Rendering Pipeline Analysis

## Overview

This document analyzes what components are needed for a proper tiled image viewer (like OpenSeadragon, OpenLayers, or map platforms) and compares it to the current Tessera implementation.

## How Tiled Image Viewers Work

### The Complete Pipeline

A tiled image viewer needs these components working together:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TILE RENDERING PIPELINE                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. IMAGE SOURCE                                                     │
│     └── File/URL → Format Parser → Image Pyramid Structure           │
│                                                                      │
│  2. PYRAMID LEVELS                                                   │
│     └── Level 0: Full resolution (e.g., 100000x100000)              │
│     └── Level 1: 1/2 resolution (50000x50000)                       │
│     └── Level 2: 1/4 resolution (25000x25000)                       │
│     └── ... until thumbnail size                                     │
│                                                                      │
│  3. TILE GRID                                                        │
│     └── Each level divided into tiles (typically 256x256 or 512x512)│
│     └── Tiles addressed by (level, x, y)                            │
│                                                                      │
│  4. VIEWPORT → VISIBLE TILES                                         │
│     └── Transform viewport corners to image space                    │
│     └── Select appropriate pyramid level for current zoom            │
│     └── Calculate which tiles in grid are visible                    │
│                                                                      │
│  5. TILE LOADING                                                     │
│     └── Queue visible tiles for loading                             │
│     └── Prioritize by distance to center                            │
│     └── Decode tile data (JPEG, PNG, raw pixels, etc.)              │
│     └── Convert to GPU texture / ImageBitmap                        │
│                                                                      │
│  6. TILE CACHING                                                     │
│     └── LRU cache for loaded tiles                                  │
│     └── Memory limits and eviction                                  │
│                                                                      │
│  7. RENDERING                                                        │
│     └── Apply view matrix transformation                            │
│     └── Draw each tile at its image-space position                  │
│     └── Handle edge cases (partial tiles, gaps)                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Current Implementation Status

### ✅ What's Implemented (but may need fixes)

| Component | Status | Notes |
|-----------|--------|-------|
| Viewer class | ✅ Exists | Basic structure in place |
| Viewport | ✅ Exists | Zoom, pan, view matrix working |
| Backend abstraction | ✅ Exists | WebGPU, Canvas2D, etc. |
| TileManager | ⚠️ Partial | Exists but has bugs |
| TileCache | ✅ Exists | LRU cache implemented |
| Format parsers | ⚠️ Partial | TIFF parser exists, issues with some files |
| Coordinate transforms | ✅ Exists | imageToScreen, screenToImage |

### ❌ Critical Issues Found

#### 1. **Level Selection is Broken**
**File:** `packages/rendering/src/tiles/manager.ts`

```typescript
// Current implementation:
private selectLevel(zoom: number): number {
  const baseLevel = Math.floor(Math.log2(zoom));
  return Math.max(0, Math.min(this.levelCount - 1, baseLevel));
}
```

**Problem:** For zoom < 2, `Math.log2(zoom)` returns negative or 0. For a single-level image (levelCount=1), this always returns 0. The logic is inverted - higher zoom should use higher resolution (lower level number), but the math is wrong.

**Fix needed:**
```typescript
private selectLevel(zoom: number): number {
  // At zoom 1.0, we want level 0 (full resolution) if 1 pixel = 1 pixel
  // At zoom 0.5, we could use level 1 (half resolution)
  // At zoom 0.25, we could use level 2 (quarter resolution)
  // Formula: level = max(0, ceil(-log2(zoom)))
  const level = Math.max(0, Math.ceil(-Math.log2(zoom)));
  return Math.min(this.levelCount - 1, level);
}
```

#### 2. **MemoryTileSource Returns Full Image for ALL Tiles**
**File:** `packages/formats/src/sources/memory-source.ts`

```typescript
// Current implementation always returns full image at (0,0):
return {
  level: 0,
  x,
  y,
  width: this.width,
  height: this.height,
  imageX: 0,  // Always at top-left
  imageY: 0,  // Always at top-left
  imageBitmap: this.imageBitmap,
  // ...
};
```

**Problem:** When TileManager requests tiles (0,0), (1,0), (0,1), etc., they ALL return the same full image at position (0,0). This means multiple copies of the full image stack on top of each other.

**Fix needed:** MemoryTileSource should either:
1. Actually slice the image into tiles (proper tiling)
2. OR only return a tile for (0,0) request and return null for others

#### 3. **WebGPU Backend Uses Canvas2D Fallback**
**File:** `packages/rendering/src/backend/webgpu.ts`

The WebGPU backend creates a Canvas2D, draws tiles to it, then copies to WebGPU. This defeats the purpose of WebGPU.

**What's missing:**
- GPU texture management
- Tile texture atlas
- GPU-based tile compositing shader
- Proper renderTiles pipeline

#### 4. **Tile Position Calculation is Wrong for Non-Tiled Images**
When a full image is loaded (not pre-tiled), the system still tries to calculate a tile grid, but the math doesn't account for images that aren't divided into tiles.

#### 5. **No Pyramid Generation for Non-Pyramidal Sources**
For images without built-in pyramids (like simple PNG/JPEG), there's no code to generate pyramid levels dynamically. This means:
- Zooming out far on a large image is slow (no LOD)
- Large images consume too much memory

## What Needs to be Built/Fixed

### Priority 1: Fix Core Tile Rendering (Blocking Issue)

1. **Fix MemoryTileSource** - Either implement proper tiling or handle single-tile case
2. **Fix level selection** - Correct the pyramid level calculation
3. **Fix tile grid calculation** - Handle edge cases properly

### Priority 2: Complete WebGPU Implementation

1. **Tile texture atlas** - Pack tiles into GPU texture atlases
2. **Tile compositing shader** - Render tiles using GPU
3. **Proper resource management** - Texture upload, caching, eviction

### Priority 3: Pyramid Support

1. **Multi-level tile source** - Support for pyramidal TIFF, etc.
2. **Dynamic pyramid generation** - For non-pyramidal sources
3. **Level blending** - Smooth transitions between levels

### Priority 4: Advanced Features

1. **Tile prefetching** - Load tiles before they're visible
2. **Progressive loading** - Show lower-res while high-res loads
3. **Request cancellation** - Cancel tiles no longer needed
4. **Tile interpolation** - Handle zoom between levels

## Recommended Fix Order

### Phase 1: Make Basic Rendering Work (Immediate)

1. Fix `MemoryTileSource` to handle single-tile images correctly
2. Fix `TileManager.getVisibleTiles()` to return correct tiles
3. Fix `Canvas2DBackend.renderTiles()` to draw tiles correctly
4. Test with a simple PNG image

### Phase 2: Fix TIFF Loading

1. Audit TIFF parser for common issues
2. Test with various TIFF types (tiled, striped, compressed)
3. Ensure ImageBitmap is created correctly

### Phase 3: Implement Proper Tiling

1. Implement tile slicing in MemoryTileSource
2. Implement proper pyramid level selection
3. Add tile-based rendering for large images

### Phase 4: Complete WebGPU

1. Implement GPU tile rendering
2. Add texture atlas management
3. Add proper shader pipeline

## Comparison with OpenSeadragon

| Feature | OpenSeadragon | Tessera Current |
|---------|--------------|-----------------|
| Tile loading | ✅ Works | ❌ Issues |
| Multi-level pyramids | ✅ Full support | ⚠️ Level 0 only |
| Dynamic tiling | ✅ Yes | ❌ No |
| GPU rendering | ❌ Canvas2D only | ⚠️ Placeholder |
| Format support | ✅ DZI, IIIF, etc. | ⚠️ TIFF (partial) |
| Pan/zoom | ✅ Smooth | ⚠️ Works but no tiles |

## Files to Modify

1. `/packages/rendering/src/tiles/manager.ts` - Fix level selection, tile visibility
2. `/packages/formats/src/sources/memory-source.ts` - Fix single-tile handling
3. `/packages/rendering/src/backend/canvas2d.ts` - Verify tile rendering
4. `/packages/rendering/src/backend/webgpu.ts` - Implement proper GPU rendering
5. `/packages/core/src/viewer.ts` - Fix render loop and tile display

## Quick Test

To verify the issue, load a simple PNG image in the demo:
1. The image dimensions should show correctly
2. The image should render centered in the viewport
3. Zoom and pan should work smoothly

Currently, only the first point works. The rendering shows either nothing or just a placeholder.


