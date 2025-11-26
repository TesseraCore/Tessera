/**
 * Tessera DevTools
 * 
 * Development and debugging tools for the Tessera deep zoom image viewer.
 * Provides real-time inspection of viewer state, performance metrics,
 * tile management, event logging, and coordinate conversion tools.
 */

import type { Viewer } from 'tessera';
import { DEVTOOLS_STYLES } from './styles.js';
import { ICONS } from './icons.js';

/**
 * DevTools configuration options
 */
export interface DevToolsOptions {
  /** Position of the devtools panel */
  position?: 'right' | 'bottom' | 'left' | 'floating';
  /** Default panel to show */
  defaultPanel?: 'state' | 'performance' | 'tiles' | 'events' | 'coordinates';
  /** Hotkey to toggle devtools (default: 'F12') */
  hotkey?: string;
  /** Show floating toggle button */
  showToggleButton?: boolean;
  /** Start with devtools open */
  startOpen?: boolean;
  /** Maximum events to keep in log */
  maxEvents?: number;
  /** FPS sample size for averaging */
  fpsSampleSize?: number;
  /** Jank threshold in ms (default: 16.67 for 60fps) */
  jankThreshold?: number;
  /** Severe jank threshold in ms (default: 33.33 for 30fps) */
  severeJankThreshold?: number;
  /** Maximum tile load entries to track */
  maxTileLoadEntries?: number;
  /** Performance recording max duration in seconds */
  maxRecordingDuration?: number;
}

/**
 * Event log entry
 */
interface EventLogEntry {
  id: number;
  timestamp: number;
  type: string;
  payload: unknown;
}

/**
 * Performance sample
 */
interface PerformanceSample {
  timestamp: number;
  frameTime: number;
  fps: number;
}

/**
 * Jank entry (frame that exceeded budget)
 */
interface JankEntry {
  id: number;
  timestamp: number;
  frameTime: number;
  isSevere: boolean;
}

/**
 * Tile load timing entry
 */
interface TileLoadEntry {
  id: string;
  level: number;
  x: number;
  y: number;
  startTime: number;
  fetchTime?: number;
  decodeTime?: number;
  uploadTime?: number;
  totalTime?: number;
  status: 'loading' | 'complete' | 'error';
}

/**
 * Performance alert
 */
interface PerformanceAlert {
  id: number;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: number;
}

/**
 * Performance recording snapshot
 */
interface RecordingSnapshot {
  timestamp: number;
  fps: number;
  frameTime: number;
  memoryUsage: { cpu: number; gpu: number; heap?: number };
  tileStats: { cached: number; loading: number; queue: number };
  alerts: PerformanceAlert[];
}

/**
 * Network statistics
 */
interface NetworkStats {
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  totalBytes: number;
  avgLoadTime: number;
  bandwidth: number; // bytes per second
}

/**
 * DevTools panel for debugging Tessera viewer
 */
export class DevTools {
  private viewer: Viewer;
  private options: Required<DevToolsOptions>;
  
  // DOM elements
  private root: HTMLElement | null = null;
  private toggleButton: HTMLElement | null = null;
  private styleElement: HTMLStyleElement | null = null;
  
  // State
  private isOpen = false;
  private activePanel: string = 'state';
  private eventLog: EventLogEntry[] = [];
  private eventIdCounter = 0;
  private eventFilter = '';
  private performanceSamples: PerformanceSample[] = [];
  private rafId: number | null = null;
  private updateIntervalId: number | null = null;
  
  // Tile visualization
  private showTileBoundaries = false;
  private tileOverlayContainer: HTMLElement | null = null;
  
  // Coordinate picker
  private lastMousePos: { screen: [number, number]; image: [number, number] } | null = null;
  
  // Event cleanup functions
  private cleanupFns: (() => void)[] = [];
  
  // Performance tracking
  private jankEntries: JankEntry[] = [];
  private jankIdCounter = 0;
  private frameTimeBuckets: number[] = new Array(20).fill(0); // 0-5ms, 5-10ms, ... 95-100ms
  private tileLoadEntries: TileLoadEntry[] = [];
  private alerts: PerformanceAlert[] = [];
  private alertIdCounter = 0;
  
  // Network tracking
  private networkStats: NetworkStats = {
    totalRequests: 0,
    completedRequests: 0,
    failedRequests: 0,
    totalBytes: 0,
    avgLoadTime: 0,
    bandwidth: 0,
  };
  private recentLoadTimes: number[] = [];
  
  // Recording state
  private isRecording = false;
  private recordingStartTime = 0;
  private recordingSnapshots: RecordingSnapshot[] = [];
  
  // Memory tracking
  private memorySamples: { timestamp: number; heap: number; cpu: number; gpu: number }[] = [];

  constructor(viewer: Viewer, options: DevToolsOptions = {}) {
    this.viewer = viewer;
    this.options = {
      position: options.position ?? 'right',
      defaultPanel: options.defaultPanel ?? 'state',
      hotkey: options.hotkey ?? 'F12',
      showToggleButton: options.showToggleButton ?? true,
      startOpen: options.startOpen ?? false,
      maxEvents: options.maxEvents ?? 500,
      fpsSampleSize: options.fpsSampleSize ?? 120,
      jankThreshold: options.jankThreshold ?? 16.67,
      severeJankThreshold: options.severeJankThreshold ?? 33.33,
      maxTileLoadEntries: options.maxTileLoadEntries ?? 50,
      maxRecordingDuration: options.maxRecordingDuration ?? 60,
    };
    
    this.activePanel = this.options.defaultPanel;
    this.init();
  }

  /**
   * Initialize DevTools
   */
  private init(): void {
    this.injectStyles();
    this.createToggleButton();
    this.createPanel();
    this.setupEventListeners();
    
    // Only start performance monitoring if panel starts open
    // This prevents CPU drain when DevTools is closed
    if (this.options.startOpen) {
      this.startPerformanceMonitoring();
      this.open();
    }
  }

  /**
   * Inject DevTools CSS styles
   */
  private injectStyles(): void {
    if (document.getElementById('tessera-devtools-styles')) {
      return;
    }
    
    this.styleElement = document.createElement('style');
    this.styleElement.id = 'tessera-devtools-styles';
    this.styleElement.textContent = DEVTOOLS_STYLES;
    document.head.appendChild(this.styleElement);
  }

  /**
   * Create floating toggle button
   */
  private createToggleButton(): void {
    if (!this.options.showToggleButton) {
      return;
    }
    
    this.toggleButton = document.createElement('button');
    this.toggleButton.className = 'dt-toggle-btn';
    this.toggleButton.innerHTML = ICONS.devtools;
    this.toggleButton.title = `Toggle DevTools (${this.options.hotkey})`;
    this.toggleButton.addEventListener('click', () => this.toggle());
    document.body.appendChild(this.toggleButton);
  }

  /**
   * Create the main DevTools panel
   */
  private createPanel(): void {
    this.root = document.createElement('div');
    this.root.className = `tessera-devtools dt-${this.options.position} dt-hidden`;
    
    this.root.innerHTML = `
      <div class="dt-container">
        ${this.renderHeader()}
        ${this.renderTabs()}
        <div class="dt-content">
          ${this.renderStatePanel()}
          ${this.renderPerformancePanel()}
          ${this.renderTilesPanel()}
          ${this.renderEventsPanel()}
          ${this.renderCoordinatesPanel()}
        </div>
      </div>
    `;
    
    document.body.appendChild(this.root);
    this.attachPanelListeners();
  }

  /**
   * Render header section
   */
  private renderHeader(): string {
    return `
      <div class="dt-header">
        <div class="dt-logo">
          ${ICONS.logo}
          <span>TESSERA</span>
        </div>
        <span class="dt-version">DevTools</span>
        <div class="dt-header-actions">
          <button class="dt-btn dt-btn-close" data-action="close" title="Close (${this.options.hotkey})">
            ${ICONS.close}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render tab navigation
   */
  private renderTabs(): string {
    const tabs = [
      { id: 'state', label: 'State', icon: ICONS.state },
      { id: 'performance', label: 'Perf', icon: ICONS.performance },
      { id: 'tiles', label: 'Tiles', icon: ICONS.tiles },
      { id: 'events', label: 'Events', icon: ICONS.events },
      { id: 'coordinates', label: 'Coords', icon: ICONS.coordinates },
    ];
    
    return `
      <div class="dt-tabs">
        ${tabs.map((tab, i) => `
          <button 
            class="dt-tab ${tab.id === this.activePanel ? 'dt-tab-active' : ''}" 
            data-panel="${tab.id}"
            title="${tab.label} (${i + 1})"
          >
            ${tab.label}
            ${tab.id === 'events' ? '<span class="dt-tab-badge" id="dt-event-count">0</span>' : ''}
            ${tab.id === 'performance' ? '<span class="dt-tab-badge" id="dt-alert-count" style="display:none">0</span>' : ''}
          </button>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render State Inspector panel
   */
  private renderStatePanel(): string {
    return `
      <div class="dt-panel ${this.activePanel === 'state' ? 'dt-panel-active' : ''}" data-panel="state">
        <div class="dt-panel-scroll">
          <div class="dt-section">
            <div class="dt-section-title">${ICONS.state} Viewer State</div>
            <div id="dt-viewer-state"></div>
          </div>
          <div class="dt-section">
            <div class="dt-section-title">${ICONS.coordinates} Viewport</div>
            <div id="dt-viewport-state"></div>
          </div>
          <div class="dt-section">
            <div class="dt-section-title">${ICONS.tiles} Image Info</div>
            <div id="dt-image-state"></div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render Performance panel
   */
  private renderPerformancePanel(): string {
    return `
      <div class="dt-panel ${this.activePanel === 'performance' ? 'dt-panel-active' : ''}" data-panel="performance">
        <div class="dt-toolbar">
          <button class="dt-toolbar-btn" id="dt-record-btn">
            ${ICONS.record} Record
          </button>
          <button class="dt-toolbar-btn" id="dt-export-perf-btn">
            ${ICONS.export} Export
          </button>
          <button class="dt-toolbar-btn" id="dt-clear-perf-btn">
            ${ICONS.clear} Clear
          </button>
        </div>
        <div class="dt-panel-scroll">
          <!-- Recording indicator -->
          <div class="dt-recording" id="dt-recording-indicator" style="display:none">
            <div class="dt-recording-dot"></div>
            <span class="dt-recording-text">Recording...</span>
            <span class="dt-recording-time" id="dt-recording-time">0:00</span>
          </div>
          
          <!-- Alerts -->
          <div class="dt-alerts" id="dt-alerts"></div>
          
          <!-- Frame Rate -->
          <div class="dt-section">
            <div class="dt-section-title">${ICONS.performance} Frame Rate</div>
            <div class="dt-stats-grid">
              <div class="dt-stat-card">
                <div class="dt-stat-label">FPS</div>
                <div class="dt-stat-value" id="dt-fps">--</div>
              </div>
              <div class="dt-stat-card">
                <div class="dt-stat-label">Frame Time</div>
                <div class="dt-stat-value" id="dt-frame-time">--<span class="dt-stat-unit">ms</span></div>
              </div>
            </div>
            <div class="dt-fps-graph">
              <canvas class="dt-fps-canvas" id="dt-fps-canvas"></canvas>
            </div>
          </div>
          
          <!-- Frame Budget -->
          <div class="dt-section">
            <div class="dt-section-title">${ICONS.gauge} Frame Budget (16.67ms)</div>
            <div class="dt-budget-bar" id="dt-budget-bar">
              <div class="dt-budget-fill" id="dt-budget-fill"></div>
              <div class="dt-budget-text" id="dt-budget-text">--</div>
            </div>
          </div>
          
          <!-- Frame Time Histogram -->
          <div class="dt-section">
            <div class="dt-section-title">${ICONS.histogram} Frame Time Distribution</div>
            <div class="dt-histogram">
              <canvas class="dt-histogram-canvas" id="dt-histogram-canvas"></canvas>
            </div>
            <div class="dt-percentile-row">
              <div class="dt-percentile">
                <div class="dt-percentile-label">P50</div>
                <div class="dt-percentile-value" id="dt-p50">--<span class="dt-stat-unit">ms</span></div>
              </div>
              <div class="dt-percentile">
                <div class="dt-percentile-label">P95</div>
                <div class="dt-percentile-value" id="dt-p95">--<span class="dt-stat-unit">ms</span></div>
              </div>
              <div class="dt-percentile">
                <div class="dt-percentile-label">P99</div>
                <div class="dt-percentile-value" id="dt-p99">--<span class="dt-stat-unit">ms</span></div>
              </div>
            </div>
          </div>
          
          <!-- Jank Detection -->
          <div class="dt-section">
            <div class="dt-section-title">${ICONS.zap} Jank Detection</div>
            <div class="dt-stats-grid">
              <div class="dt-stat-card">
                <div class="dt-stat-label">Dropped Frames</div>
                <div class="dt-stat-value" id="dt-dropped-frames">0</div>
              </div>
              <div class="dt-stat-card">
                <div class="dt-stat-label">Longest Frame</div>
                <div class="dt-stat-value" id="dt-longest-frame">--<span class="dt-stat-unit">ms</span></div>
              </div>
            </div>
            <div class="dt-jank-list" id="dt-jank-list">
              <div class="dt-empty">No jank detected</div>
            </div>
          </div>
          
          <!-- Memory -->
          <div class="dt-section">
            <div class="dt-section-title">${ICONS.memory} Memory</div>
            <div class="dt-stats-grid dt-stats-grid-3">
              <div class="dt-stat-card">
                <div class="dt-stat-label">JS Heap</div>
                <div class="dt-stat-value" id="dt-heap-memory">--<span class="dt-stat-unit">MB</span></div>
              </div>
              <div class="dt-stat-card">
                <div class="dt-stat-label">CPU Cache</div>
                <div class="dt-stat-value" id="dt-cpu-memory">--<span class="dt-stat-unit">MB</span></div>
              </div>
              <div class="dt-stat-card">
                <div class="dt-stat-label">GPU Est.</div>
                <div class="dt-stat-value" id="dt-gpu-memory">--<span class="dt-stat-unit">MB</span></div>
              </div>
            </div>
            <div class="dt-memory-chart">
              <canvas class="dt-memory-canvas" id="dt-memory-canvas"></canvas>
            </div>
          </div>
          
          <!-- Render Phase Breakdown -->
          <div class="dt-section">
            <div class="dt-section-title">${ICONS.layers} Render Phases</div>
            <div class="dt-phase-chart" id="dt-phase-chart">
              <div class="dt-phase-bar-container" id="dt-phase-bars"></div>
              <div class="dt-phase-legend" id="dt-phase-legend"></div>
            </div>
          </div>
          
          <!-- Network Performance -->
          <div class="dt-section">
            <div class="dt-section-title">${ICONS.network} Network</div>
            <div class="dt-stats-grid">
              <div class="dt-stat-card">
                <div class="dt-stat-label">Avg Load Time</div>
                <div class="dt-stat-value" id="dt-avg-load-time">--<span class="dt-stat-unit">ms</span></div>
              </div>
              <div class="dt-stat-card">
                <div class="dt-stat-label">Bandwidth</div>
                <div class="dt-stat-value" id="dt-bandwidth">--<span class="dt-stat-unit">MB/s</span></div>
              </div>
            </div>
            <div class="dt-network-stats" id="dt-network-stats"></div>
          </div>
          
          <!-- Statistics -->
          <div class="dt-section">
            <div class="dt-section-title">${ICONS.events} Statistics</div>
            <div id="dt-perf-stats"></div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render Tiles panel
   */
  private renderTilesPanel(): string {
    return `
      <div class="dt-panel ${this.activePanel === 'tiles' ? 'dt-panel-active' : ''}" data-panel="tiles">
        <div class="dt-toolbar">
          <button class="dt-toolbar-btn" id="dt-toggle-tile-overlay">
            ${ICONS.eye} Show Bounds
          </button>
          <button class="dt-toolbar-btn" id="dt-clear-cache">
            ${ICONS.clear} Clear Cache
          </button>
        </div>
        <div class="dt-panel-scroll">
          <div class="dt-section">
            <div class="dt-section-title">${ICONS.tiles} Cache Stats</div>
            <div class="dt-stats-grid">
              <div class="dt-stat-card">
                <div class="dt-stat-label">Cached Tiles</div>
                <div class="dt-stat-value" id="dt-tile-count">--</div>
              </div>
              <div class="dt-stat-card">
                <div class="dt-stat-label">Hit Rate</div>
                <div class="dt-stat-value" id="dt-hit-rate">--<span class="dt-stat-unit">%</span></div>
              </div>
              <div class="dt-stat-card">
                <div class="dt-stat-label">Loading</div>
                <div class="dt-stat-value" id="dt-loading-count">--</div>
              </div>
              <div class="dt-stat-card">
                <div class="dt-stat-label">Queue</div>
                <div class="dt-stat-value" id="dt-queue-length">--</div>
              </div>
            </div>
          </div>
          
          <!-- Tile Loading Waterfall -->
          <div class="dt-section">
            <div class="dt-section-title">${ICONS.waterfall} Tile Loading Waterfall</div>
            <div class="dt-waterfall" id="dt-waterfall">
              <div class="dt-waterfall-header">
                <div class="dt-waterfall-header-name">Tile</div>
                <div class="dt-waterfall-header-timeline">
                  <span>0ms</span>
                  <span>Timeline</span>
                  <span id="dt-waterfall-max">500ms</span>
                </div>
              </div>
              <div class="dt-waterfall-scroll" id="dt-waterfall-scroll">
                <div class="dt-empty">No tile loads recorded</div>
              </div>
            </div>
            <div class="dt-phase-legend" style="margin-top: 8px;">
              <div class="dt-phase-legend-item">
                <div class="dt-phase-legend-color" style="background: var(--dt-info);"></div>
                <span>Fetch</span>
              </div>
              <div class="dt-phase-legend-item">
                <div class="dt-phase-legend-color" style="background: var(--dt-purple);"></div>
                <span>Decode</span>
              </div>
              <div class="dt-phase-legend-item">
                <div class="dt-phase-legend-color" style="background: var(--dt-accent);"></div>
                <span>Upload</span>
              </div>
            </div>
          </div>
          
          <div class="dt-section">
            <div class="dt-section-title">${ICONS.state} Tiles by Level</div>
            <div id="dt-tiles-by-level"></div>
          </div>
          <div class="dt-section">
            <div class="dt-section-title">${ICONS.performance} Memory Usage</div>
            <div id="dt-tile-memory"></div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render Events panel
   */
  private renderEventsPanel(): string {
    return `
      <div class="dt-panel ${this.activePanel === 'events' ? 'dt-panel-active' : ''}" data-panel="events">
        <div class="dt-toolbar">
          <input 
            type="text" 
            class="dt-toolbar-input" 
            id="dt-event-filter"
            placeholder="Filter events..."
          />
          <button class="dt-toolbar-btn" id="dt-clear-events">
            ${ICONS.clear}
          </button>
          <button class="dt-toolbar-btn" id="dt-export-events">
            ${ICONS.export}
          </button>
        </div>
        <div class="dt-panel-scroll">
          <div class="dt-event-list" id="dt-event-list">
            <div class="dt-empty">Listening for events...</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render Coordinates panel
   */
  private renderCoordinatesPanel(): string {
    return `
      <div class="dt-panel ${this.activePanel === 'coordinates' ? 'dt-panel-active' : ''}" data-panel="coordinates">
        <div class="dt-panel-scroll">
          <div class="dt-coord-picker">
            <div class="dt-coord-display">
              <div class="dt-coord-box">
                <div class="dt-coord-box-title">Screen Position</div>
                <div class="dt-coord-value" id="dt-screen-pos">--, --</div>
              </div>
              <div class="dt-coord-box">
                <div class="dt-coord-box-title">Image Position</div>
                <div class="dt-coord-value" id="dt-image-pos">--, --</div>
              </div>
            </div>
            <div class="dt-coord-hint" id="dt-coord-hint">
              Move mouse over canvas to see coordinates
            </div>
          </div>
          <div class="dt-section">
            <div class="dt-section-title">${ICONS.state} View Matrix</div>
            <div id="dt-view-matrix"></div>
          </div>
          <div class="dt-section">
            <div class="dt-section-title">${ICONS.coordinates} Inverse Matrix</div>
            <div id="dt-inv-matrix"></div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners to panel elements
   */
  private attachPanelListeners(): void {
    if (!this.root) return;
    
    // Tab switching
    const tabs = this.root.querySelectorAll('.dt-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const panel = tab.getAttribute('data-panel');
        if (panel) {
          this.showPanel(panel);
        }
      });
    });
    
    // Close button
    const closeBtn = this.root.querySelector('[data-action="close"]');
    closeBtn?.addEventListener('click', () => this.close());
    
    // Event filter
    const eventFilter = this.root.querySelector('#dt-event-filter') as HTMLInputElement;
    eventFilter?.addEventListener('input', () => {
      this.eventFilter = eventFilter.value.toLowerCase();
      this.updateEventsPanel();
    });
    
    // Clear events
    const clearEventsBtn = this.root.querySelector('#dt-clear-events');
    clearEventsBtn?.addEventListener('click', () => {
      this.eventLog = [];
      this.updateEventsPanel();
    });
    
    // Export events
    const exportEventsBtn = this.root.querySelector('#dt-export-events');
    exportEventsBtn?.addEventListener('click', () => this.exportEvents());
    
    // Toggle tile overlay
    const toggleTileBtn = this.root.querySelector('#dt-toggle-tile-overlay');
    toggleTileBtn?.addEventListener('click', () => {
      this.setTileBoundaries(!this.showTileBoundaries);
      toggleTileBtn.innerHTML = this.showTileBoundaries 
        ? `${ICONS.eyeOff} Hide Bounds`
        : `${ICONS.eye} Show Bounds`;
    });
    
    // Clear cache
    const clearCacheBtn = this.root.querySelector('#dt-clear-cache');
    clearCacheBtn?.addEventListener('click', () => {
      if (this.viewer.tiles) {
        this.viewer.tiles.clearCache();
        this.updateTilesPanel();
      }
    });
    
    // Performance recording
    const recordBtn = this.root.querySelector('#dt-record-btn');
    recordBtn?.addEventListener('click', () => this.toggleRecording());
    
    // Export performance
    const exportPerfBtn = this.root.querySelector('#dt-export-perf-btn');
    exportPerfBtn?.addEventListener('click', () => this.exportPerformanceData());
    
    // Clear performance
    const clearPerfBtn = this.root.querySelector('#dt-clear-perf-btn');
    clearPerfBtn?.addEventListener('click', () => this.clearPerformanceData());
  }

  /**
   * Setup global event listeners
   */
  private setupEventListeners(): void {
    // Keyboard shortcuts
    const keyHandler = (e: KeyboardEvent) => {
      // Toggle with hotkey
      if (e.key === this.options.hotkey || 
          (e.ctrlKey && e.shiftKey && e.key === 'D')) {
        e.preventDefault();
        this.toggle();
        return;
      }
      
      // Panel shortcuts when open
      if (this.isOpen) {
        const panelKeys: Record<string, string> = {
          '1': 'state',
          '2': 'performance',
          '3': 'tiles',
          '4': 'events',
          '5': 'coordinates',
        };
        
        if (panelKeys[e.key]) {
          this.showPanel(panelKeys[e.key]!);
        }
        
        // T for tile boundaries
        if (e.key === 't' || e.key === 'T') {
          this.setTileBoundaries(!this.showTileBoundaries);
        }
        
        // R for recording
        if (e.key === 'r' || e.key === 'R') {
          this.toggleRecording();
        }
      }
    };
    
    document.addEventListener('keydown', keyHandler);
    this.cleanupFns.push(() => document.removeEventListener('keydown', keyHandler));
    
    // Listen to viewer events
    const viewerEventHandler = this.viewer.onAll((event) => {
      this.logEvent(event.type, event.payload);
    });
    this.cleanupFns.push(viewerEventHandler);
    
    // Listen to viewport events
    const viewportEventHandler = this.viewer.viewport.onAll((event) => {
      this.logEvent(event.type, event.payload);
    });
    this.cleanupFns.push(viewportEventHandler);
    
    // Mouse move for coordinate tracking
    const mouseMoveHandler = (e: MouseEvent) => {
      if (!this.isOpen || this.activePanel !== 'coordinates') return;
      
      const rect = this.viewer.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      
      // Only update if mouse is over canvas
      if (screenX >= 0 && screenX <= rect.width && screenY >= 0 && screenY <= rect.height) {
        const imagePos = this.viewer.viewport.screenToImage([screenX, screenY]);
        this.lastMousePos = {
          screen: [screenX, screenY],
          image: imagePos,
        };
        this.updateCoordinatesDisplay();
      }
    };
    
    document.addEventListener('mousemove', mouseMoveHandler);
    this.cleanupFns.push(() => document.removeEventListener('mousemove', mouseMoveHandler));
  }

  /**
   * Start performance monitoring loop
   */
  private startPerformanceMonitoring(): void {
    let lastTime = performance.now();
    let longestFrame = 0;
    
    const measureFrame = () => {
      const now = performance.now();
      const frameTime = now - lastTime;
      lastTime = now;
      
      if (frameTime > 0 && frameTime < 1000) { // Ignore anomalies
        const fps = 1000 / frameTime;
        
        this.performanceSamples.push({
          timestamp: now,
          frameTime,
          fps,
        });
        
        // Keep only recent samples
        if (this.performanceSamples.length > this.options.fpsSampleSize) {
          this.performanceSamples.shift();
        }
        
        // Track longest frame
        if (frameTime > longestFrame) {
          longestFrame = frameTime;
        }
        
        // Jank detection
        if (frameTime > this.options.jankThreshold) {
          const isSevere = frameTime > this.options.severeJankThreshold;
          this.jankEntries.unshift({
            id: this.jankIdCounter++,
            timestamp: now,
            frameTime,
            isSevere,
          });
          
          // Keep only recent jank entries
          if (this.jankEntries.length > 50) {
            this.jankEntries.pop();
          }
          
          // Generate alert for severe jank
          if (isSevere) {
            this.addAlert('warning', 'Severe Frame Drop', `Frame took ${frameTime.toFixed(1)}ms (budget: ${this.options.jankThreshold.toFixed(1)}ms)`);
          }
        }
        
        // Update histogram
        const bucket = Math.min(Math.floor(frameTime / 5), 19);
        if (this.frameTimeBuckets[bucket] !== undefined) {
          this.frameTimeBuckets[bucket]++;
        }
        
        // Track memory samples
        this.trackMemory();
        
        // Recording snapshot
        if (this.isRecording) {
          this.captureRecordingSnapshot(fps, frameTime);
        }
      }
      
      this.rafId = requestAnimationFrame(measureFrame);
    };
    
    this.rafId = requestAnimationFrame(measureFrame);
    
    // Update UI periodically
    this.updateIntervalId = window.setInterval(() => {
      if (this.isOpen) {
        this.updateActivePanel();
        this.checkPerformanceAlerts();
      }
    }, 200);
  }

  /**
   * Stop performance monitoring loop
   * Called when DevTools is closed to prevent CPU drain
   */
  private stopPerformanceMonitoring(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    
    if (this.updateIntervalId !== null) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }
  }

  /**
   * Track memory usage
   */
  private trackMemory(): void {
    const sample: { timestamp: number; heap: number; cpu: number; gpu: number } = {
      timestamp: performance.now(),
      heap: 0,
      cpu: 0,
      gpu: 0,
    };
    
    // JS Heap (Chrome only)
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      sample.heap = memory.usedJSHeapSize || 0;
    }
    
    // Tile cache memory
    if (this.viewer.tiles) {
      const stats = this.viewer.tiles.getCacheStats();
      sample.cpu = stats.cpuBytes;
      sample.gpu = stats.gpuBytes;
    }
    
    this.memorySamples.push(sample);
    if (this.memorySamples.length > this.options.fpsSampleSize) {
      this.memorySamples.shift();
    }
  }

  /**
   * Check for performance issues and generate alerts
   */
  private checkPerformanceAlerts(): void {
    const alerts: PerformanceAlert[] = [];
    
    // Check FPS
    if (this.performanceSamples.length > 10) {
      const avgFps = this.performanceSamples.slice(-10).reduce((s, p) => s + p.fps, 0) / 10;
      if (avgFps < 30) {
        alerts.push({
          id: this.alertIdCounter++,
          type: 'error',
          title: 'Low Frame Rate',
          message: `Average FPS is ${avgFps.toFixed(0)} (below 30 FPS threshold)`,
          timestamp: Date.now(),
        });
      } else if (avgFps < 50) {
        alerts.push({
          id: this.alertIdCounter++,
          type: 'warning',
          title: 'Frame Rate Warning',
          message: `Average FPS is ${avgFps.toFixed(0)} (below 50 FPS)`,
          timestamp: Date.now(),
        });
      }
    }
    
    // Check memory pressure
    if (this.viewer.tiles) {
      const stats = this.viewer.tiles.getCacheStats();
      const cpuMB = stats.cpuBytes / (1024 * 1024);
      if (cpuMB > 400) {
        alerts.push({
          id: this.alertIdCounter++,
          type: 'warning',
          title: 'High Memory Usage',
          message: `Tile cache using ${cpuMB.toFixed(0)}MB (approaching 512MB limit)`,
          timestamp: Date.now(),
        });
      }
    }
    
    // Check cache hit rate
    if (this.viewer.tiles) {
      const stats = this.viewer.tiles.getCacheStats();
      if (stats.hits + stats.misses > 100 && stats.hitRate < 0.5) {
        alerts.push({
          id: this.alertIdCounter++,
          type: 'info',
          title: 'Low Cache Hit Rate',
          message: `Cache hit rate is ${(stats.hitRate * 100).toFixed(0)}% - consider increasing cache size`,
          timestamp: Date.now(),
        });
      }
    }
    
    // Update alerts (dedupe)
    this.alerts = alerts;
    this.updateAlertsBadge();
  }

  /**
   * Add a performance alert
   */
  private addAlert(type: 'warning' | 'error' | 'info', title: string, message: string): void {
    // Dedupe by title
    if (this.alerts.some(a => a.title === title)) return;
    
    this.alerts.push({
      id: this.alertIdCounter++,
      type,
      title,
      message,
      timestamp: Date.now(),
    });
    
    this.updateAlertsBadge();
  }

  /**
   * Update alerts badge on tab
   */
  private updateAlertsBadge(): void {
    const badge = this.root?.querySelector('#dt-alert-count');
    if (badge) {
      const errorCount = this.alerts.filter(a => a.type === 'error' || a.type === 'warning').length;
      if (errorCount > 0) {
        badge.textContent = errorCount.toString();
        badge.classList.toggle('dt-badge-warning', this.alerts.some(a => a.type === 'warning'));
        badge.classList.toggle('dt-badge-error', this.alerts.some(a => a.type === 'error'));
        (badge as HTMLElement).style.display = '';
      } else {
        (badge as HTMLElement).style.display = 'none';
      }
    }
  }

  /**
   * Toggle performance recording
   */
  private toggleRecording(): void {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  /**
   * Start performance recording
   */
  private startRecording(): void {
    this.isRecording = true;
    this.recordingStartTime = performance.now();
    this.recordingSnapshots = [];
    
    const recordBtn = this.root?.querySelector('#dt-record-btn');
    if (recordBtn) {
      recordBtn.innerHTML = `${ICONS.stop} Stop`;
      recordBtn.classList.add('dt-btn-recording');
    }
    
    const indicator = this.root?.querySelector('#dt-recording-indicator') as HTMLElement;
    if (indicator) {
      indicator.style.display = '';
    }
    
    // Auto-stop after max duration
    setTimeout(() => {
      if (this.isRecording) {
        this.stopRecording();
      }
    }, this.options.maxRecordingDuration * 1000);
  }

  /**
   * Stop performance recording
   */
  private stopRecording(): void {
    this.isRecording = false;
    
    const recordBtn = this.root?.querySelector('#dt-record-btn');
    if (recordBtn) {
      recordBtn.innerHTML = `${ICONS.record} Record`;
      recordBtn.classList.remove('dt-btn-recording');
    }
    
    const indicator = this.root?.querySelector('#dt-recording-indicator') as HTMLElement;
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  /**
   * Capture a recording snapshot
   */
  private captureRecordingSnapshot(fps: number, frameTime: number): void {
    const snapshot: RecordingSnapshot = {
      timestamp: performance.now() - this.recordingStartTime,
      fps,
      frameTime,
      memoryUsage: {
        cpu: 0,
        gpu: 0,
        heap: 0,
      },
      tileStats: {
        cached: 0,
        loading: 0,
        queue: 0,
      },
      alerts: [...this.alerts],
    };
    
    // Memory
    if ('memory' in performance) {
      snapshot.memoryUsage.heap = (performance as any).memory.usedJSHeapSize || 0;
    }
    
    if (this.viewer.tiles) {
      const stats = this.viewer.tiles.getCacheStats();
      snapshot.memoryUsage.cpu = stats.cpuBytes;
      snapshot.memoryUsage.gpu = stats.gpuBytes;
      snapshot.tileStats.cached = stats.tileCount;
      snapshot.tileStats.loading = this.viewer.tiles.getLoadingCount();
      snapshot.tileStats.queue = this.viewer.tiles.getQueueLength();
    }
    
    this.recordingSnapshots.push(snapshot);
  }

  /**
   * Export performance data
   */
  private exportPerformanceData(): void {
    const data = {
      exportedAt: new Date().toISOString(),
      recording: this.recordingSnapshots,
      summary: {
        samples: this.performanceSamples.length,
        avgFps: this.performanceSamples.length > 0
          ? this.performanceSamples.reduce((s, p) => s + p.fps, 0) / this.performanceSamples.length
          : 0,
        jankCount: this.jankEntries.length,
        frameTimeBuckets: this.frameTimeBuckets,
        percentiles: this.calculatePercentiles(),
      },
      jankEntries: this.jankEntries,
      alerts: this.alerts,
      networkStats: this.networkStats,
      tileLoads: this.tileLoadEntries,
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tessera-perf-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Clear performance data
   */
  private clearPerformanceData(): void {
    this.performanceSamples = [];
    this.jankEntries = [];
    this.frameTimeBuckets = new Array(20).fill(0);
    this.tileLoadEntries = [];
    this.alerts = [];
    this.memorySamples = [];
    this.networkStats = {
      totalRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      totalBytes: 0,
      avgLoadTime: 0,
      bandwidth: 0,
    };
    this.recentLoadTimes = [];
    this.recordingSnapshots = [];
    this.updateAlertsBadge();
  }

  /**
   * Calculate frame time percentiles
   */
  private calculatePercentiles(): { p50: number; p95: number; p99: number } {
    if (this.performanceSamples.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }
    
    const sorted = [...this.performanceSamples].sort((a, b) => a.frameTime - b.frameTime);
    const len = sorted.length;
    
    return {
      p50: sorted[Math.floor(len * 0.5)]?.frameTime ?? 0,
      p95: sorted[Math.floor(len * 0.95)]?.frameTime ?? 0,
      p99: sorted[Math.floor(len * 0.99)]?.frameTime ?? 0,
    };
  }

  /**
   * Log an event
   */
  private logEvent(type: string, payload: unknown): void {
    this.eventLog.unshift({
      id: this.eventIdCounter++,
      timestamp: Date.now(),
      type,
      payload,
    });
    
    // Trim old events
    if (this.eventLog.length > this.options.maxEvents) {
      this.eventLog = this.eventLog.slice(0, this.options.maxEvents);
    }
    
    // Update badge
    const badge = this.root?.querySelector('#dt-event-count');
    if (badge) {
      badge.textContent = Math.min(this.eventLog.length, 99).toString();
    }
    
    // Update panel if visible
    if (this.isOpen && this.activePanel === 'events') {
      this.updateEventsPanel();
    }
  }

  /**
   * Track tile load timing
   */
  trackTileLoad(id: string, level: number, x: number, y: number): void {
    const entry: TileLoadEntry = {
      id,
      level,
      x,
      y,
      startTime: performance.now(),
      status: 'loading',
    };
    
    this.tileLoadEntries.unshift(entry);
    this.networkStats.totalRequests++;
    
    // Trim old entries
    if (this.tileLoadEntries.length > this.options.maxTileLoadEntries) {
      this.tileLoadEntries.pop();
    }
  }

  /**
   * Update tile load timing
   */
  updateTileLoad(
    id: string,
    phase: 'fetch' | 'decode' | 'upload' | 'complete' | 'error',
    time?: number
  ): void {
    const entry = this.tileLoadEntries.find(e => e.id === id);
    if (!entry) return;
    
    const elapsed = performance.now() - entry.startTime;
    
    switch (phase) {
      case 'fetch':
        entry.fetchTime = time ?? elapsed;
        break;
      case 'decode':
        entry.decodeTime = time ?? (elapsed - (entry.fetchTime ?? 0));
        break;
      case 'upload':
        entry.uploadTime = time ?? (elapsed - (entry.fetchTime ?? 0) - (entry.decodeTime ?? 0));
        break;
      case 'complete':
        entry.totalTime = elapsed;
        entry.status = 'complete';
        this.networkStats.completedRequests++;
        this.recentLoadTimes.push(elapsed);
        if (this.recentLoadTimes.length > 20) {
          this.recentLoadTimes.shift();
        }
        this.networkStats.avgLoadTime = 
          this.recentLoadTimes.reduce((a, b) => a + b, 0) / this.recentLoadTimes.length;
        break;
      case 'error':
        entry.status = 'error';
        this.networkStats.failedRequests++;
        break;
    }
  }

  /**
   * Show a specific panel
   */
  showPanel(panelId: string): void {
    this.activePanel = panelId;
    
    if (!this.root) return;
    
    // Update tab active state
    const tabs = this.root.querySelectorAll('.dt-tab');
    tabs.forEach(tab => {
      const isActive = tab.getAttribute('data-panel') === panelId;
      tab.classList.toggle('dt-tab-active', isActive);
    });
    
    // Update panel visibility
    const panels = this.root.querySelectorAll('.dt-panel');
    panels.forEach(panel => {
      const isActive = panel.getAttribute('data-panel') === panelId;
      panel.classList.toggle('dt-panel-active', isActive);
    });
    
    this.updateActivePanel();
  }

  /**
   * Update the currently active panel
   */
  private updateActivePanel(): void {
    switch (this.activePanel) {
      case 'state':
        this.updateStatePanel();
        break;
      case 'performance':
        this.updatePerformancePanel();
        break;
      case 'tiles':
        this.updateTilesPanel();
        break;
      case 'events':
        this.updateEventsPanel();
        break;
      case 'coordinates':
        this.updateCoordinatesPanel();
        break;
    }
  }

  /**
   * Update State panel content
   */
  private updateStatePanel(): void {
    const viewerStateEl = this.root?.querySelector('#dt-viewer-state');
    const viewportStateEl = this.root?.querySelector('#dt-viewport-state');
    const imageStateEl = this.root?.querySelector('#dt-image-state');
    
    if (viewerStateEl) {
      viewerStateEl.innerHTML = this.renderRows([
        ['Engine', this.viewer.state.backend ?? 'none'],
        ['Initialized', this.viewer.state.initialized],
        ['Ready', this.viewer.state.ready],
        ['Error', this.viewer.state.error?.message ?? null],
      ]);
    }
    
    if (viewportStateEl) {
      const vpState = this.viewer.viewport.getState();
      
      viewportStateEl.innerHTML = this.renderRows([
        ['Zoom', `${(vpState.zoom * 100).toFixed(1)}%`],
        ['Pan', `${vpState.pan[0].toFixed(1)}, ${vpState.pan[1].toFixed(1)}`],
        ['Rotation', `${(vpState.rotation * 180 / Math.PI).toFixed(1)}°`],
        ['Size', `${vpState.width} × ${vpState.height}`],
        ['DPR', vpState.dpr.toFixed(2)],
      ]);
    }
    
    if (imageStateEl) {
      const imgSize = this.viewer.state.imageSize;
      imageStateEl.innerHTML = this.renderRows([
        ['Dimensions', imgSize ? `${imgSize[0]} × ${imgSize[1]}` : 'None'],
        ['Format', this.viewer.state.imageFormat ?? 'None'],
        ['Levels', this.viewer.tiles?.getLevelCount() ?? 0],
      ]);
    }
  }

  /**
   * Update Performance panel content
   */
  private updatePerformancePanel(): void {
    const fpsEl = this.root?.querySelector('#dt-fps');
    const frameTimeEl = this.root?.querySelector('#dt-frame-time');
    const cpuMemEl = this.root?.querySelector('#dt-cpu-memory');
    const gpuMemEl = this.root?.querySelector('#dt-gpu-memory');
    const heapMemEl = this.root?.querySelector('#dt-heap-memory');
    const perfStatsEl = this.root?.querySelector('#dt-perf-stats');
    const alertsEl = this.root?.querySelector('#dt-alerts');
    
    if (this.performanceSamples.length > 0) {
      const avgFps = this.performanceSamples.reduce((s, p) => s + p.fps, 0) / this.performanceSamples.length;
      const avgFrameTime = this.performanceSamples.reduce((s, p) => s + p.frameTime, 0) / this.performanceSamples.length;
      const minFps = Math.min(...this.performanceSamples.map(p => p.fps));
      const maxFps = Math.max(...this.performanceSamples.map(p => p.fps));
      
      if (fpsEl) {
        fpsEl.textContent = Math.round(avgFps).toString();
        fpsEl.classList.toggle('dt-stat-warning', avgFps < 50);
        fpsEl.classList.toggle('dt-stat-error', avgFps < 30);
      }
      if (frameTimeEl) frameTimeEl.innerHTML = `${avgFrameTime.toFixed(1)}<span class="dt-stat-unit">ms</span>`;
      
      if (perfStatsEl) {
        perfStatsEl.innerHTML = this.renderRows([
          ['Min FPS', Math.round(minFps)],
          ['Max FPS', Math.round(maxFps)],
          ['Samples', this.performanceSamples.length],
        ]);
      }
      
      // Update frame budget bar
      this.updateFrameBudgetBar(avgFrameTime);
      
      // Update percentiles
      this.updatePercentiles();
    }
    
    // Memory stats
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const heapMB = ((memory.usedJSHeapSize || 0) / (1024 * 1024)).toFixed(1);
      if (heapMemEl) heapMemEl.innerHTML = `${heapMB}<span class="dt-stat-unit">MB</span>`;
    } else {
      if (heapMemEl) heapMemEl.innerHTML = `N/A`;
    }
    
    // Tile cache memory
    if (this.viewer.tiles) {
      const stats = this.viewer.tiles.getCacheStats();
      const cpuMB = (stats.cpuBytes / (1024 * 1024)).toFixed(1);
      const gpuMB = (stats.gpuBytes / (1024 * 1024)).toFixed(1);
      
      if (cpuMemEl) cpuMemEl.innerHTML = `${cpuMB}<span class="dt-stat-unit">MB</span>`;
      if (gpuMemEl) gpuMemEl.innerHTML = `${gpuMB}<span class="dt-stat-unit">MB</span>`;
    }
    
    // Alerts
    if (alertsEl) {
      if (this.alerts.length > 0) {
        alertsEl.innerHTML = this.alerts.map(alert => `
          <div class="dt-alert dt-alert-${alert.type}">
            <div class="dt-alert-icon">${ICONS.alert}</div>
            <div class="dt-alert-content">
              <div class="dt-alert-title">${alert.title}</div>
              <div class="dt-alert-message">${alert.message}</div>
            </div>
          </div>
        `).join('');
      } else {
        alertsEl.innerHTML = '';
      }
    }
    
    // Jank detection
    this.updateJankSection();
    
    // Network stats
    this.updateNetworkStats();
    
    // Recording time
    if (this.isRecording) {
      const recordingTimeEl = this.root?.querySelector('#dt-recording-time');
      if (recordingTimeEl) {
        const elapsed = (performance.now() - this.recordingStartTime) / 1000;
        const mins = Math.floor(elapsed / 60);
        const secs = Math.floor(elapsed % 60);
        recordingTimeEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      }
    }
    
    // Update graphs
    this.updateFpsGraph();
    this.updateHistogram();
    this.updateMemoryGraph();
    this.updatePhaseChart();
  }

  /**
   * Update frame budget bar
   */
  private updateFrameBudgetBar(avgFrameTime: number): void {
    const budgetFill = this.root?.querySelector('#dt-budget-fill') as HTMLElement;
    const budgetText = this.root?.querySelector('#dt-budget-text') as HTMLElement;
    
    if (budgetFill && budgetText) {
      const budget = 16.67; // 60fps budget
      const percentage = Math.min((avgFrameTime / budget) * 100, 150);
      
      budgetFill.style.width = `${Math.min(percentage, 100)}%`;
      budgetFill.classList.toggle('dt-budget-warning', percentage > 80 && percentage <= 100);
      budgetFill.classList.toggle('dt-budget-over', percentage > 100);
      
      budgetText.textContent = `${percentage.toFixed(0)}%`;
    }
  }

  /**
   * Update percentile display
   */
  private updatePercentiles(): void {
    const percentiles = this.calculatePercentiles();
    
    const p50El = this.root?.querySelector('#dt-p50');
    const p95El = this.root?.querySelector('#dt-p95');
    const p99El = this.root?.querySelector('#dt-p99');
    
    if (p50El) p50El.innerHTML = `${percentiles.p50.toFixed(1)}<span class="dt-stat-unit">ms</span>`;
    if (p95El) p95El.innerHTML = `${percentiles.p95.toFixed(1)}<span class="dt-stat-unit">ms</span>`;
    if (p99El) p99El.innerHTML = `${percentiles.p99.toFixed(1)}<span class="dt-stat-unit">ms</span>`;
  }

  /**
   * Update jank detection section
   */
  private updateJankSection(): void {
    const droppedEl = this.root?.querySelector('#dt-dropped-frames');
    const longestEl = this.root?.querySelector('#dt-longest-frame');
    const jankListEl = this.root?.querySelector('#dt-jank-list');
    
    if (droppedEl) {
      droppedEl.textContent = this.jankEntries.length.toString();
      droppedEl.classList.toggle('dt-stat-warning', this.jankEntries.length > 10);
      droppedEl.classList.toggle('dt-stat-error', this.jankEntries.length > 30);
    }
    
    if (longestEl && this.jankEntries.length > 0) {
      const longest = Math.max(...this.jankEntries.map(j => j.frameTime));
      longestEl.innerHTML = `${longest.toFixed(1)}<span class="dt-stat-unit">ms</span>`;
      longestEl.classList.toggle('dt-stat-warning', longest > this.options.jankThreshold);
      longestEl.classList.toggle('dt-stat-error', longest > this.options.severeJankThreshold);
    }
    
    if (jankListEl) {
      if (this.jankEntries.length > 0) {
        jankListEl.innerHTML = this.jankEntries.slice(0, 10).map(jank => {
          const time = new Date(jank.timestamp).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          return `
            <div class="dt-jank-item">
              <span class="dt-jank-time">${time}</span>
              <span class="dt-jank-duration ${jank.isSevere ? 'dt-jank-severe' : ''}">${jank.frameTime.toFixed(1)}ms</span>
            </div>
          `;
        }).join('');
      } else {
        jankListEl.innerHTML = '<div class="dt-empty">No jank detected</div>';
      }
    }
  }

  /**
   * Update network stats display
   */
  private updateNetworkStats(): void {
    const avgLoadEl = this.root?.querySelector('#dt-avg-load-time');
    const bandwidthEl = this.root?.querySelector('#dt-bandwidth');
    const networkStatsEl = this.root?.querySelector('#dt-network-stats');
    
    if (avgLoadEl) {
      avgLoadEl.innerHTML = `${this.networkStats.avgLoadTime.toFixed(0)}<span class="dt-stat-unit">ms</span>`;
    }
    
    if (bandwidthEl) {
      const mbps = (this.networkStats.bandwidth / (1024 * 1024)).toFixed(2);
      bandwidthEl.innerHTML = `${mbps}<span class="dt-stat-unit">MB/s</span>`;
    }
    
    if (networkStatsEl) {
      networkStatsEl.innerHTML = `
        <div class="dt-network-row">
          <span class="dt-network-label">Total Requests</span>
          <span class="dt-network-value">${this.networkStats.totalRequests}</span>
        </div>
        <div class="dt-network-row">
          <span class="dt-network-label">Completed</span>
          <span class="dt-network-value">${this.networkStats.completedRequests}</span>
        </div>
        <div class="dt-network-row">
          <span class="dt-network-label">Failed</span>
          <span class="dt-network-value" style="color: ${this.networkStats.failedRequests > 0 ? 'var(--dt-error)' : 'var(--dt-accent)'}">${this.networkStats.failedRequests}</span>
        </div>
      `;
    }
  }

  /**
   * Update FPS graph canvas
   */
  private updateFpsGraph(): void {
    const canvas = this.root?.querySelector('#dt-fps-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    
    const width = rect.width;
    const height = rect.height;
    
    // Clear
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, width, height);
    
    if (this.performanceSamples.length < 2) return;
    
    // Draw grid lines
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 0.5;
    for (let y = 0; y <= height; y += height / 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Draw FPS line
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    
    const maxFps = 120;
    const samples = this.performanceSamples;
    const stepX = width / (this.options.fpsSampleSize - 1);
    
    for (let i = 0; i < samples.length; i++) {
      const x = i * stepX;
      const y = height - (Math.min(samples[i]!.fps, maxFps) / maxFps) * height;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.stroke();
    
    // Draw jank markers
    ctx.fillStyle = '#f0883e';
    for (const jank of this.jankEntries) {
      // Find sample index closest to jank timestamp
      const sampleIdx = samples.findIndex(s => Math.abs(s.timestamp - jank.timestamp) < 100);
      if (sampleIdx >= 0) {
        const x = sampleIdx * stepX;
        ctx.fillRect(x - 1, 0, 2, height);
      }
    }
    
    // Draw 60fps reference line
    ctx.strokeStyle = '#484f58';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const y60 = height - (60 / maxFps) * height;
    ctx.moveTo(0, y60);
    ctx.lineTo(width, y60);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /**
   * Update histogram canvas
   */
  private updateHistogram(): void {
    const canvas = this.root?.querySelector('#dt-histogram-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    
    const width = rect.width;
    const height = rect.height;
    const padding = 20;
    
    // Clear
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, width, height);
    
    const maxCount = Math.max(...this.frameTimeBuckets, 1);
    const barWidth = (width - padding * 2) / this.frameTimeBuckets.length;
    
    // Draw bars
    for (let i = 0; i < this.frameTimeBuckets.length; i++) {
      const count = this.frameTimeBuckets[i]!;
      const barHeight = (count / maxCount) * (height - padding * 2);
      const x = padding + i * barWidth;
      const y = height - padding - barHeight;
      
      // Color based on frame time
      if (i < 4) { // 0-20ms - good
        ctx.fillStyle = '#00ff88';
      } else if (i < 7) { // 20-35ms - warning
        ctx.fillStyle = '#f0883e';
      } else { // 35ms+ - bad
        ctx.fillStyle = '#f85149';
      }
      
      ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
    }
    
    // Draw axis labels
    ctx.fillStyle = '#484f58';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('0', padding, height - 4);
    ctx.fillText('50ms', width / 2, height - 4);
    ctx.fillText('100ms', width - padding, height - 4);
    
    // Draw 16.67ms marker
    const marker16 = padding + (16.67 / 100) * (width - padding * 2);
    ctx.strokeStyle = '#58a6ff';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(marker16, padding);
    ctx.lineTo(marker16, height - padding);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /**
   * Update memory graph canvas
   */
  private updateMemoryGraph(): void {
    const canvas = this.root?.querySelector('#dt-memory-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    
    const width = rect.width;
    const height = rect.height;
    
    // Clear
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, width, height);
    
    if (this.memorySamples.length < 2) return;
    
    const samples = this.memorySamples;
    const stepX = width / (this.options.fpsSampleSize - 1);
    
    // Find max values
    const maxHeap = Math.max(...samples.map(s => s.heap), 1);
    const maxCpu = Math.max(...samples.map(s => s.cpu), 1);
    const maxVal = Math.max(maxHeap, maxCpu);
    
    // Draw heap line
    if (samples.some(s => s.heap > 0)) {
      ctx.strokeStyle = '#58a6ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < samples.length; i++) {
        const x = i * stepX;
        const y = height - (samples[i]!.heap / maxVal) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    
    // Draw CPU cache line
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const x = i * stepX;
      const y = height - (samples[i]!.cpu / maxVal) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  /**
   * Update render phase chart
   */
  private updatePhaseChart(): void {
    // This would require integration with the viewer's render loop
    // For now, show placeholder data
    const phaseChart = this.root?.querySelector('#dt-phase-chart');
    if (!phaseChart) return;
    
    // Simulated phase data (would come from actual render timing)
    const phases = [
      { name: 'Visibility', color: '#58a6ff', value: 2 },
      { name: 'Tile Sort', color: '#a371f7', value: 1 },
      { name: 'Upload', color: '#f0883e', value: 3 },
      { name: 'Render', color: '#00ff88', value: 10 },
    ];
    
    const total = phases.reduce((s, p) => s + p.value, 0);
    
    const barsEl = phaseChart.querySelector('#dt-phase-bars');
    const legendEl = phaseChart.querySelector('#dt-phase-legend');
    
    if (barsEl) {
      barsEl.innerHTML = phases.map(phase => {
        const width = (phase.value / total) * 100;
        return `<div class="dt-phase-segment" style="width: ${width}%; background: ${phase.color};"></div>`;
      }).join('');
    }
    
    if (legendEl) {
      legendEl.innerHTML = phases.map(phase => `
        <div class="dt-phase-legend-item">
          <div class="dt-phase-legend-color" style="background: ${phase.color};"></div>
          <span>${phase.name}</span>
          <span class="dt-phase-legend-value">${phase.value.toFixed(1)}ms</span>
        </div>
      `).join('');
    }
  }

  /**
   * Update Tiles panel content
   */
  private updateTilesPanel(): void {
    if (!this.viewer.tiles) return;
    
    const stats = this.viewer.tiles.getCacheStats();
    
    const tileCountEl = this.root?.querySelector('#dt-tile-count');
    const hitRateEl = this.root?.querySelector('#dt-hit-rate');
    const loadingCountEl = this.root?.querySelector('#dt-loading-count');
    const queueLengthEl = this.root?.querySelector('#dt-queue-length');
    const tilesByLevelEl = this.root?.querySelector('#dt-tiles-by-level');
    const tileMemoryEl = this.root?.querySelector('#dt-tile-memory');
    
    if (tileCountEl) tileCountEl.textContent = stats.tileCount.toString();
    if (hitRateEl) hitRateEl.innerHTML = `${(stats.hitRate * 100).toFixed(1)}<span class="dt-stat-unit">%</span>`;
    if (loadingCountEl) loadingCountEl.textContent = this.viewer.tiles.getLoadingCount().toString();
    if (queueLengthEl) queueLengthEl.textContent = this.viewer.tiles.getQueueLength().toString();
    
    if (tilesByLevelEl) {
      const rows: [string, unknown][] = [];
      stats.tilesPerLevel.forEach((count, level) => {
        rows.push([`Level ${level}`, count]);
      });
      tilesByLevelEl.innerHTML = rows.length > 0 
        ? this.renderRows(rows)
        : '<div class="dt-empty">No tiles cached</div>';
    }
    
    if (tileMemoryEl) {
      const cpuMB = (stats.cpuBytes / (1024 * 1024)).toFixed(2);
      const gpuMB = (stats.gpuBytes / (1024 * 1024)).toFixed(2);
      tileMemoryEl.innerHTML = this.renderRows([
        ['CPU Memory', `${cpuMB} MB`],
        ['GPU Memory', `${gpuMB} MB`],
        ['Cache Hits', stats.hits],
        ['Cache Misses', stats.misses],
      ]);
    }
    
    // Update waterfall
    this.updateWaterfall();
  }

  /**
   * Update tile loading waterfall
   */
  private updateWaterfall(): void {
    const scrollEl = this.root?.querySelector('#dt-waterfall-scroll');
    const maxEl = this.root?.querySelector('#dt-waterfall-max');
    if (!scrollEl) return;
    
    const entries = this.tileLoadEntries.filter(e => e.status !== 'loading').slice(0, 20);
    
    if (entries.length === 0) {
      scrollEl.innerHTML = '<div class="dt-empty">No tile loads recorded</div>';
      return;
    }
    
    // Find max time for scaling
    const maxTime = Math.max(...entries.map(e => e.totalTime ?? 0), 100);
    if (maxEl) maxEl.textContent = `${Math.ceil(maxTime)}ms`;
    
    scrollEl.innerHTML = entries.map(entry => {
      const fetchWidth = ((entry.fetchTime ?? 0) / maxTime) * 100;
      const decodeWidth = ((entry.decodeTime ?? 0) / maxTime) * 100;
      const uploadWidth = ((entry.uploadTime ?? 0) / maxTime) * 100;
      const fetchEnd = fetchWidth;
      const decodeEnd = fetchEnd + decodeWidth;
      
      return `
        <div class="dt-waterfall-row">
          <div class="dt-waterfall-name">${entry.level}/${entry.x}/${entry.y}</div>
          <div class="dt-waterfall-timeline">
            ${entry.fetchTime ? `<div class="dt-waterfall-bar dt-waterfall-fetch" style="left: 0%; width: ${fetchWidth}%"></div>` : ''}
            ${entry.decodeTime ? `<div class="dt-waterfall-bar dt-waterfall-decode" style="left: ${fetchEnd}%; width: ${decodeWidth}%"></div>` : ''}
            ${entry.uploadTime ? `<div class="dt-waterfall-bar dt-waterfall-upload" style="left: ${decodeEnd}%; width: ${uploadWidth}%"></div>` : ''}
          </div>
          <div class="dt-waterfall-time">${entry.totalTime?.toFixed(0) ?? '--'}ms</div>
        </div>
      `;
    }).join('');
  }

  /**
   * Update Events panel content
   */
  private updateEventsPanel(): void {
    const eventListEl = this.root?.querySelector('#dt-event-list');
    if (!eventListEl) return;
    
    const filteredEvents = this.eventFilter
      ? this.eventLog.filter(e => e.type.toLowerCase().includes(this.eventFilter))
      : this.eventLog;
    
    if (filteredEvents.length === 0) {
      eventListEl.innerHTML = `<div class="dt-empty">${this.eventFilter ? 'No matching events' : 'Listening for events...'}</div>`;
      return;
    }
    
    eventListEl.innerHTML = filteredEvents.slice(0, 100).map(event => {
      const time = new Date(event.timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const payloadStr = JSON.stringify(event.payload);
      const shortPayload = payloadStr.length > 60 
        ? payloadStr.slice(0, 60) + '...' 
        : payloadStr;
      
      return `
        <div class="dt-event-item" data-event-id="${event.id}">
          <span class="dt-event-time">${time}</span>
          <span class="dt-event-type">${event.type}</span>
          <span class="dt-event-payload">${this.escapeHtml(shortPayload)}</span>
        </div>
      `;
    }).join('');
  }

  /**
   * Update Coordinates panel content
   */
  private updateCoordinatesPanel(): void {
    const viewMatrixEl = this.root?.querySelector('#dt-view-matrix');
    const invMatrixEl = this.root?.querySelector('#dt-inv-matrix');
    
    const viewMatrix = this.viewer.viewport.getViewMatrix();
    const invMatrix = this.viewer.viewport.getInverseViewMatrix();
    
    if (viewMatrixEl) {
      viewMatrixEl.innerHTML = this.renderMatrix(viewMatrix);
    }
    
    if (invMatrixEl) {
      invMatrixEl.innerHTML = this.renderMatrix(invMatrix);
    }
    
    this.updateCoordinatesDisplay();
  }

  /**
   * Update coordinates display
   */
  private updateCoordinatesDisplay(): void {
    const screenPosEl = this.root?.querySelector('#dt-screen-pos');
    const imagePosEl = this.root?.querySelector('#dt-image-pos');
    
    if (this.lastMousePos) {
      if (screenPosEl) {
        screenPosEl.textContent = `${this.lastMousePos.screen[0].toFixed(1)}, ${this.lastMousePos.screen[1].toFixed(1)}`;
      }
      if (imagePosEl) {
        imagePosEl.textContent = `${this.lastMousePos.image[0].toFixed(1)}, ${this.lastMousePos.image[1].toFixed(1)}`;
      }
    }
  }

  /**
   * Render a 3x3 matrix
   */
  private renderMatrix(matrix: Float32Array): string {
    const rows = [];
    for (let i = 0; i < 3; i++) {
      const cols = [];
      for (let j = 0; j < 3; j++) {
        cols.push((matrix[i * 3 + j] ?? 0).toFixed(4));
      }
      rows.push(cols.join('  '));
    }
    return `<pre style="margin: 0; color: var(--dt-accent); font-size: 11px; line-height: 1.6;">${rows.join('\n')}</pre>`;
  }

  /**
   * Render property rows
   */
  private renderRows(rows: [string, unknown][]): string {
    return rows.map(([label, value]) => {
      let valueClass = 'dt-value';
      let displayValue = String(value);
      
      if (value === null || value === undefined) {
        valueClass += ' dt-value-null';
        displayValue = 'null';
      } else if (typeof value === 'boolean') {
        valueClass += ' dt-value-boolean';
        displayValue = value ? '✓ true' : '✗ false';
      } else if (typeof value === 'number') {
        valueClass += ' dt-value-number';
      } else if (typeof value === 'string') {
        valueClass += ' dt-value-string';
      } else if (typeof value === 'object') {
        valueClass += ' dt-value-object';
        displayValue = JSON.stringify(value);
      }
      
      return `
        <div class="dt-row">
          <span class="dt-label">${label}</span>
          <span class="${valueClass}">${this.escapeHtml(displayValue)}</span>
        </div>
      `;
    }).join('');
  }

  /**
   * Export events to JSON file
   */
  private exportEvents(): void {
    const data = JSON.stringify(this.eventLog, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tessera-events-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Escape HTML entities
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Enable/disable tile boundary visualization
   */
  setTileBoundaries(enabled: boolean): void {
    this.showTileBoundaries = enabled;
    
    if (enabled) {
      // TODO: Implement tile boundary overlay
      // This would require integration with the rendering system
      console.debug('[DevTools] Tile boundaries enabled');
    } else {
      if (this.tileOverlayContainer) {
        this.tileOverlayContainer.remove();
        this.tileOverlayContainer = null;
      }
      console.debug('[DevTools] Tile boundaries disabled');
    }
  }

  /**
   * Toggle DevTools visibility
   */
  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Open DevTools panel
   */
  open(): void {
    this.isOpen = true;
    this.root?.classList.remove('dt-hidden');
    
    // Start performance monitoring when panel opens
    // Only start if not already running
    if (this.rafId === null) {
      this.startPerformanceMonitoring();
    }
    
    this.updateActivePanel();
    
    // Hide toggle button when panel is open
    if (this.toggleButton) {
      this.toggleButton.style.display = 'none';
    }
  }

  /**
   * Close DevTools panel
   */
  close(): void {
    this.isOpen = false;
    this.root?.classList.add('dt-hidden');
    
    // Stop performance monitoring when panel closes to save CPU
    this.stopPerformanceMonitoring();
    
    // Show toggle button when panel is closed
    if (this.toggleButton) {
      this.toggleButton.style.display = '';
    }
  }

  /**
   * Check if DevTools is open
   */
  isVisible(): boolean {
    return this.isOpen;
  }

  /**
   * Get logged events
   */
  getEvents(): EventLogEntry[] {
    return [...this.eventLog];
  }

  /**
   * Clear event log
   */
  clearEvents(): void {
    this.eventLog = [];
    this.updateEventsPanel();
  }

  /**
   * Get performance alerts
   */
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Get jank entries
   */
  getJankEntries(): JankEntry[] {
    return [...this.jankEntries];
  }

  /**
   * Get frame time percentiles
   */
  getPercentiles(): { p50: number; p95: number; p99: number } {
    return this.calculatePercentiles();
  }

  /**
   * Destroy DevTools and clean up resources
   */
  destroy(): void {
    // Stop monitoring
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    
    if (this.updateIntervalId !== null) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }
    
    // Run cleanup functions
    this.cleanupFns.forEach(fn => fn());
    this.cleanupFns = [];
    
    // Remove DOM elements
    this.root?.remove();
    this.toggleButton?.remove();
    this.styleElement?.remove();
    this.tileOverlayContainer?.remove();
    
    this.root = null;
    this.toggleButton = null;
    this.styleElement = null;
    this.tileOverlayContainer = null;
  }
}
