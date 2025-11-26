# @tessera/devtools

Development tools for debugging the Tessera deep zoom image viewer.

## Features

- **State Inspector**: View viewer, viewport, and image state in real-time
- **Performance Monitor**: FPS counter, render times, memory usage
- **Tile Debugger**: Cache statistics, loading queue, tile boundary visualization
- **Event Logger**: Real-time event stream with filtering
- **Coordinate Picker**: Interactive tool to convert between image/screen coordinates

## Usage

```typescript
import { Viewer } from 'tessera';
import { DevTools } from '@tessera/devtools';

// Create viewer
const viewer = new Viewer({
  canvas: document.getElementById('canvas'),
  debug: true,
});

// Attach devtools
const devtools = new DevTools(viewer, {
  position: 'right',
  defaultPanel: 'state',
  hotkey: 'F12',
});

// Toggle programmatically
devtools.toggle();

// Show specific panel
devtools.showPanel('tiles');

// Enable tile boundary visualization
devtools.setTileBoundaries(true);
```

## Keyboard Shortcuts

- `F12` or `Ctrl+Shift+D`: Toggle devtools panel
- `1-5`: Switch between panels when devtools is open
- `T`: Toggle tile boundary visualization
- `C`: Enter coordinate picker mode

## Panels

### State Inspector (1)
Real-time view of:
- Viewer initialization state
- Current backend (WebGPU/WebGL2/WebGL/Canvas2D)
- Image dimensions and format
- Viewport: zoom, pan, rotation
- View matrices

### Performance (2)
- FPS counter with graph
- Frame time statistics (min/max/avg)
- Memory usage (CPU/GPU estimates)
- Render call count

### Tiles (3)
- Cache hit/miss ratio
- Tiles in cache by level
- Loading queue length
- Active loads count
- Visual tile boundary overlay

### Events (4)
- Real-time event log
- Filter by event type
- Event payload inspection
- Clear/export functionality

### Coordinates (5)
- Interactive coordinate picker
- Image ↔ Screen coordinate conversion
- Current mouse position in both spaces

