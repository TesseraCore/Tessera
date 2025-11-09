/**
 * Tessera Demo Application
 * 
 * A simple demo to test the Tessera viewer functionality
 */

import { Viewer } from '@tessera/core';

// Get DOM elements
const canvas = document.getElementById('canvas');
const imageSelect = document.getElementById('image-select');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const resetViewBtn = document.getElementById('reset-view-btn');
const backendInfo = document.getElementById('backend-info');
const backendStatus = document.getElementById('backend-status');
const imageStatus = document.getElementById('image-status');
const formatStatus = document.getElementById('format-status');
const zoomStatus = document.getElementById('zoom-status');
const panStatus = document.getElementById('pan-status');
const viewportStatus = document.getElementById('viewport-status');
const loading = document.getElementById('loading');
const error = document.getElementById('error');

let currentImageName = null;

let viewer = null;

/**
 * Show error message
 */
function showError(message) {
  error.textContent = message;
  error.style.display = 'block';
  loading.style.display = 'none';
}

/**
 * Hide error message
 */
function hideError() {
  error.style.display = 'none';
}

/**
 * Show loading indicator
 */
function showLoading() {
  loading.style.display = 'block';
  error.style.display = 'none';
}

/**
 * Hide loading indicator
 */
function hideLoading() {
  loading.style.display = 'none';
}

/**
 * Format number with commas for thousands
 */
function formatNumber(num) {
  return num.toLocaleString();
}

/**
 * Format zoom as percentage
 */
function formatZoom(zoom) {
  return `${(zoom * 100).toFixed(1)}%`;
}

/**
 * Format pan coordinates
 */
function formatPan(pan) {
  const [x, y] = pan;
  return `${Math.round(x)}, ${Math.round(y)}`;
}

/**
 * Update status display
 */
function updateStatus() {
  if (!viewer) {
    backendStatus.textContent = '-';
    imageStatus.textContent = '-';
    formatStatus.textContent = '-';
    zoomStatus.textContent = '-';
    panStatus.textContent = '-';
    viewportStatus.textContent = '-';
    return;
  }

  // Backend
  const backend = viewer.getBackend() || 'none';
  backendStatus.textContent = backend;
  backendInfo.textContent = `Backend: ${backend}`;
  
  // Image dimensions
  if (viewer.state.imageSize) {
    const [width, height] = viewer.state.imageSize;
    const dimensions = `${formatNumber(width)} × ${formatNumber(height)} px`;
    imageStatus.textContent = dimensions;
  } else {
    imageStatus.textContent = 'None';
  }
  
  // Format
  formatStatus.textContent = viewer.state.imageFormat?.toUpperCase() || '-';
  
  // Zoom
  const zoom = viewer.viewport.getZoom();
  zoomStatus.textContent = formatZoom(zoom);
  
  // Pan
  const pan = viewer.viewport.getPan();
  panStatus.textContent = formatPan(pan);
  
  // Viewport size
  const viewportState = viewer.viewport.getState();
  if (viewportState.width > 0 && viewportState.height > 0) {
    viewportStatus.textContent = `${formatNumber(Math.round(viewportState.width))} × ${formatNumber(Math.round(viewportState.height))} px`;
  } else {
    viewportStatus.textContent = '-';
  }
}

/**
 * Initialize the viewer
 */
async function initViewer() {
  try {
    showLoading();
    hideError();

    // Ensure canvas element exists
    if (!canvas) {
      throw new Error('Canvas element not found');
    }

    // Wait for next frame to ensure layout is complete
    await new Promise(resolve => requestAnimationFrame(resolve));

    console.log('[Demo] Initializing viewer...');
    console.log('[Demo] Canvas element:', {
      width: canvas.width,
      height: canvas.height,
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
      boundingRect: canvas.getBoundingClientRect(),
    });

    // Create viewer instance
    viewer = new Viewer({
      canvas,
      preferredBackend: 'webgpu',
      debug: true,
    });

    // Set up event listeners
    viewer.on('viewer:ready', () => {
      console.log('[Demo] Viewer ready');
      hideLoading();
      updateStatus();
    });

    viewer.on('viewer:error', ({ error: err }) => {
      console.error('[Demo] Viewer error:', err);
      showError(`Viewer Error: ${err.message}`);
      updateStatus();
    });

    viewer.on('viewer:backend-changed', ({ backend }) => {
      console.log('[Demo] Backend changed:', backend);
      updateStatus();
    });

    viewer.on('viewer:image-loaded', ({ size, format }) => {
      console.log('[Demo] Image loaded:', { size, format });
      hideLoading();
      updateStatus();
    });

    viewer.on('viewer:resize', ({ width, height }) => {
      console.log('[Demo] Viewer resized:', { width, height });
      updateStatus();
    });

    // Listen to viewport changes to update status
    viewer.viewport.on('viewport:change', () => {
      updateStatus();
    });

    // Populate image dropdown
    await populateImageDropdown();

    // Set up control buttons
    imageSelect.addEventListener('change', async (e) => {
      const selectedPath = e.target.value;
      if (selectedPath) {
        await loadSelectedImage(selectedPath);
      } else {
        currentImageName = null;
        updateStatus();
      }
    });
    zoomInBtn.addEventListener('click', () => {
      if (viewer) {
        viewer.viewport.zoomIn();
      }
    });
    zoomOutBtn.addEventListener('click', () => {
      if (viewer) {
        viewer.viewport.zoomOut();
      }
    });
    resetViewBtn.addEventListener('click', () => {
      if (viewer) {
        viewer.viewport.reset();
      }
    });

    // Set up mouse controls for panning
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('mousemove', (e) => {
      if (isDragging && viewer) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        // Convert screen delta to image-space delta
        const imageDelta = viewer.viewport.screenToImage([dx, dy]);
        const zeroPoint = viewer.viewport.screenToImage([0, 0]);
        viewer.viewport.panBy([
          imageDelta[0] - zeroPoint[0],
          imageDelta[1] - zeroPoint[1],
        ]);
        lastX = e.clientX;
        lastY = e.clientY;
      }
    });

    canvas.addEventListener('mouseup', () => {
      isDragging = false;
      canvas.style.cursor = 'grab';
    });

    canvas.addEventListener('mouseleave', () => {
      isDragging = false;
      canvas.style.cursor = 'grab';
    });

    // Set up wheel zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (viewer) {
        const rect = canvas.getBoundingClientRect();
        const centerX = e.clientX - rect.left;
        const centerY = e.clientY - rect.top;
        const center = viewer.viewport.screenToImage([centerX, centerY]);
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        viewer.viewport.zoomBy(delta, center);
      }
    });

    // Initial status update
    updateStatus();

  } catch (err) {
    console.error('[Demo] Failed to initialize viewer:', err);
    showError(`Failed to initialize viewer: ${err.message}`);
  }
}

/**
 * Try to read basic TIFF dimensions from ArrayBuffer
 * This is a minimal implementation that reads the IFD (Image File Directory) header
 */
async function getTIFFDimensions(arrayBuffer) {
  try {
    const view = new DataView(arrayBuffer);
    
    // Check minimum size
    if (arrayBuffer.byteLength < 8) {
      return null;
    }
    
    // Read byte order (II = little-endian, MM = big-endian)
    const byte0 = view.getUint8(0);
    const byte1 = view.getUint8(1);
    const isLittleEndian = byte0 === 0x49 && byte1 === 0x49;
    
    if (!isLittleEndian && !(byte0 === 0x4d && byte1 === 0x4d)) {
      return null; // Not a valid TIFF
    }
    
    // Read TIFF magic number (should be 42)
    const magic = view.getUint16(2, isLittleEndian);
    if (magic !== 42) {
      return null;
    }
    
    // Read offset to first IFD
    const ifdOffset = view.getUint32(4, isLittleEndian);
    
    if (ifdOffset < 8 || ifdOffset >= arrayBuffer.byteLength) {
      return null;
    }
    
    // Read number of directory entries
    const entryCount = view.getUint16(ifdOffset, isLittleEndian);
    if (entryCount === 0 || entryCount > 100) {
      return null; // Sanity check
    }
    
    let width = null;
    let height = null;
    
    // Read directory entries (each is 12 bytes)
    for (let i = 0; i < entryCount; i++) {
      const entryOffset = ifdOffset + 2 + (i * 12);
      if (entryOffset + 12 > arrayBuffer.byteLength) {
        break;
      }
      
      const tag = view.getUint16(entryOffset, isLittleEndian);
      const type = view.getUint16(entryOffset + 2, isLittleEndian);
      const count = view.getUint32(entryOffset + 4, isLittleEndian);
      
      // Tag 256 = ImageWidth, Tag 257 = ImageLength (height)
      if (tag === 256 && type === 3 && count === 1) {
        // SHORT type, value is in the value field
        width = view.getUint16(entryOffset + 8, isLittleEndian);
      } else if (tag === 256 && type === 4 && count === 1) {
        // LONG type, value is in the value field
        width = view.getUint32(entryOffset + 8, isLittleEndian);
      } else if (tag === 257 && type === 3 && count === 1) {
        // SHORT type
        height = view.getUint16(entryOffset + 8, isLittleEndian);
      } else if (tag === 257 && type === 4 && count === 1) {
        // LONG type
        height = view.getUint32(entryOffset + 8, isLittleEndian);
      }
      
      if (width && height) {
        break; // Found both dimensions
      }
    }
    
    if (width && height && width > 0 && height > 0) {
      return [width, height];
    }
    
    return null;
  } catch (err) {
    console.warn('[Demo] Failed to read TIFF dimensions:', err);
    return null;
  }
}

/**
 * Get list of sample images from the samples folder
 */
function getSampleImages() {
  // Use Vite's import.meta.glob to get all files from the samples folder
  // With ?url query, Vite returns a module with default export containing the URL string
  const images = import.meta.glob('/samples/*', { 
    eager: false, 
    query: '?url'
  });
  
  // Filter out .gitkeep and README.md, then return array of { path, filename, importFn } objects
  return Object.entries(images)
    .filter(([path]) => {
      const filename = path.split('/').pop() || '';
      // Exclude .gitkeep and README.md files
      return filename !== '.gitkeep' && filename !== 'README.md' && !filename.endsWith('.md');
    })
    .map(([path, importFn]) => {
      // Extract filename from path
      const filename = path.split('/').pop() || '';
      return { path, filename, importFn };
    });
}

/**
 * Populate the image dropdown with available sample images
 */
async function populateImageDropdown() {
  const sampleImages = getSampleImages();
  
  // Clear existing options except the first one
  imageSelect.innerHTML = '<option value="">Select an image...</option>';
  
  // Add a "Generated Test Image" option
  const generatedOption = document.createElement('option');
  generatedOption.value = '__generated__';
  generatedOption.textContent = 'Generated Test Image';
  imageSelect.appendChild(generatedOption);
  
  // Add sample images to dropdown
  for (const { path, filename } of sampleImages) {
    const option = document.createElement('option');
    option.value = path;
    option.textContent = filename;
    imageSelect.appendChild(option);
  }
}

/**
 * Load a selected image from the dropdown
 */
async function loadSelectedImage(selectedPath) {
  if (!viewer) {
    showError('Viewer not initialized');
    return;
  }

  try {
    showLoading();
    hideError();

    // Handle generated test image option
    if (selectedPath === '__generated__') {
      await loadGeneratedTestImage();
      return;
    }

    // Get list of available sample images
    const sampleImages = getSampleImages();
    const selectedImage = sampleImages.find(img => img.path === selectedPath);
    
    if (!selectedImage) {
      showError('Selected image not found');
      return;
    }

    try {
      const { path, filename, importFn } = selectedImage;
      
      if (!importFn || typeof importFn !== 'function') {
        throw new Error(`Invalid import function for ${filename}`);
      }
      
      // Use the import function from glob to get the actual URL
      // With ?url query, Vite returns a module object with default export containing the URL string
      console.log(`[Demo] Importing image URL for: ${filename} (path: ${path})`);
      const imageUrl = await importFn();
      
      console.log(`[Demo] Import result for ${filename}:`, imageUrl, typeof imageUrl);
      
      // Handle different return types from Vite
      // With ?url query, Vite returns { default: '/url/to/file' }
      let url;
      if (typeof imageUrl === 'string') {
        url = imageUrl;
      } else if (imageUrl && typeof imageUrl === 'object') {
        if ('default' in imageUrl) {
          url = imageUrl.default;
        } else {
          // Try to get the first property value
          const keys = Object.keys(imageUrl);
          if (keys.length > 0) {
            url = imageUrl[keys[0]];
          }
        }
      }
      
      if (!url || typeof url !== 'string') {
        console.error(`[Demo] Invalid URL for ${filename}:`, { imageUrl, url });
        throw new Error(`Failed to get image URL for ${filename}. Got: ${JSON.stringify(imageUrl)}`);
      }
      
      console.log(`[Demo] Loading image: ${filename} from ${url}`);
      
      // Fetch the image
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const format = filename.split('.').pop()?.toLowerCase() || 'png';
      
      // Handle TIFF files differently (browsers don't support TIFF natively)
      if (format === 'tiff' || format === 'tif') {
        // Try to read basic TIFF dimensions from header
        const dimensions = await getTIFFDimensions(arrayBuffer);
        if (dimensions) {
          await viewer.loadImage(arrayBuffer, format, dimensions);
          currentImageName = filename;
          console.log(`[Demo] Loaded TIFF image: ${filename} (${dimensions[0]}x${dimensions[1]})`);
        } else {
          // Fallback: use placeholder dimensions
          console.warn(`[Demo] Could not read TIFF dimensions, using placeholder`);
          await viewer.loadImage(arrayBuffer, format, [2048, 2048]);
          currentImageName = filename;
        }
        return;
      }
      
      // For other formats, use Image API to get dimensions
      const img = new Image();
      const blob = new Blob([arrayBuffer]);
      const objectUrl = URL.createObjectURL(blob);
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(img);
        };
        img.onerror = (e) => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error(`Failed to load image: ${filename}`));
        };
        img.src = objectUrl;
      });

      await viewer.loadImage(arrayBuffer, format, [img.width, img.height]);
      currentImageName = filename;
      console.log(`[Demo] Loaded sample image: ${filename} (${img.width}x${img.height})`);
    } catch (err) {
      console.error(`[Demo] Failed to load ${selectedImage.filename}:`, err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      showError(`Failed to load image: ${errorMessage}`);
    }
  } catch (err) {
    console.error('[Demo] Error loading selected image:', err);
    showError(`Error: ${err.message}`);
  }
}

/**
 * Load a generated test image
 */
async function loadGeneratedTestImage() {
  if (!viewer) {
    showError('Viewer not initialized');
    return;
  }

  try {
    showLoading();
    hideError();

    // Create a simple test image using canvas
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 2048;
    testCanvas.height = 2048;
    const ctx = testCanvas.getContext('2d');

    // Create a checkerboard pattern
    const tileSize = 64;
    for (let y = 0; y < testCanvas.height; y += tileSize) {
      for (let x = 0; x < testCanvas.width; x += tileSize) {
        const isEven = ((x / tileSize) + (y / tileSize)) % 2 === 0;
        ctx.fillStyle = isEven ? '#ffffff' : '#000000';
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }

    // Add some colored squares for visual interest
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(512, 512, 256, 256);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(1280, 512, 256, 256);
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(512, 1280, 256, 256);
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(1280, 1280, 256, 256);

    // Convert canvas to blob
    testCanvas.toBlob(async (blob) => {
      if (!blob) {
        showError('Failed to create test image');
        return;
      }

      try {
        const arrayBuffer = await blob.arrayBuffer();
        await viewer.loadImage(arrayBuffer, 'png', [testCanvas.width, testCanvas.height]);
        currentImageName = 'Generated Test Image';
        console.log('[Demo] Generated test image loaded');
      } catch (err) {
        console.error('[Demo] Failed to load test image:', err);
        showError(`Failed to load image: ${err.message}`);
      }
    }, 'image/png');
  } catch (err) {
    console.error('[Demo] Error creating test image:', err);
    showError(`Error: ${err.message}`);
  }
}


// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initViewer);
} else {
  initViewer();
}

