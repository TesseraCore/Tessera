/**
 * Tessera Demo Application
 * 
 * A simple demo to test the Tessera viewer functionality
 */

import { Viewer } from '@tessera/core';

// Get DOM elements
const canvas = document.getElementById('canvas');
const loadImageBtn = document.getElementById('load-image-btn');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const resetViewBtn = document.getElementById('reset-view-btn');
const backendInfo = document.getElementById('backend-info');
const backendStatus = document.getElementById('backend-status');
const readyStatus = document.getElementById('ready-status');
const imageStatus = document.getElementById('image-status');
const loading = document.getElementById('loading');
const error = document.getElementById('error');

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
 * Update status display
 */
function updateStatus() {
  if (!viewer) {
    backendStatus.textContent = '-';
    readyStatus.textContent = '-';
    imageStatus.textContent = '-';
    return;
  }

  const backend = viewer.getBackend() || 'none';
  backendStatus.textContent = backend;
  backendInfo.textContent = `Backend: ${backend}`;
  
  readyStatus.textContent = viewer.state.ready ? 'Yes' : 'No';
  
  if (viewer.state.imageSize) {
    const [width, height] = viewer.state.imageSize;
    imageStatus.textContent = `${width}×${height}`;
  } else {
    imageStatus.textContent = 'None';
  }
}

/**
 * Initialize the viewer
 */
async function initViewer() {
  try {
    showLoading();
    hideError();

    console.log('[Demo] Initializing viewer...');

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
    });

    // Set up control buttons
    loadImageBtn.addEventListener('click', loadTestImage);
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
 * Get list of sample images from the samples folder
 */
function getSampleImages() {
  // Use Vite's import.meta.glob to get all files from the samples folder
  const images = import.meta.glob('/samples/*', { 
    eager: false, 
    as: 'url'
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
 * Load a sample image from the samples directory
 */
async function loadSampleImage() {
  if (!viewer) {
    showError('Viewer not initialized');
    return;
  }

  try {
    showLoading();
    hideError();

    // Get list of available sample images
    const sampleImages = getSampleImages();
    
    if (sampleImages.length === 0) {
      // No sample images found, fallback to generated test image
      console.log('[Demo] No sample images found, generating test image');
      await loadGeneratedTestImage();
      return;
    }

    // Try to load the first available image
    let imageLoaded = false;
    
    for (const { path, filename, importFn } of sampleImages) {
      try {
        // Use the import function from glob to get the actual URL
        const imageUrl = await importFn();
        const url = typeof imageUrl === 'string' ? imageUrl : imageUrl.default;
        
        // Fetch the image
        const response = await fetch(url);
        if (!response.ok) continue;
        
        const arrayBuffer = await response.arrayBuffer();
        const format = filename.split('.').pop()?.toLowerCase() || 'png';
        
        // Get image dimensions
        const img = new Image();
        const blob = new Blob([arrayBuffer]);
        const objectUrl = URL.createObjectURL(blob);
        
        await new Promise((resolve, reject) => {
          img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(img);
          };
          img.onerror = reject;
          img.src = objectUrl;
        });

        await viewer.loadImage(arrayBuffer, format, [img.width, img.height]);
        console.log(`[Demo] Loaded sample image: ${filename}`);
        imageLoaded = true;
        break;
      } catch (err) {
        console.warn(`[Demo] Failed to load ${filename}:`, err);
        // Continue to next image
        continue;
      }
    }

    if (!imageLoaded) {
      // Fallback to generated test image
      console.log('[Demo] Failed to load any sample images, generating test image');
      await loadGeneratedTestImage();
    }
  } catch (err) {
    console.error('[Demo] Error loading sample image:', err);
    // Fallback to generated test image
    await loadGeneratedTestImage();
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

/**
 * Load a test image (tries sample images first, then generates one)
 */
async function loadTestImage() {
  await loadSampleImage();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initViewer);
} else {
  initViewer();
}

