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
    const name = currentImageName ? ` (${currentImageName})` : '';
    imageStatus.textContent = dimensions + name;
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
      
      // Use the import function from glob to get the actual URL
      const imageUrl = await importFn();
      const url = typeof imageUrl === 'string' ? imageUrl : imageUrl.default;
      
      // Fetch the image
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      
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
      currentImageName = filename;
      console.log(`[Demo] Loaded sample image: ${filename}`);
    } catch (err) {
      console.error(`[Demo] Failed to load ${selectedImage.filename}:`, err);
      showError(`Failed to load image: ${err.message}`);
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

