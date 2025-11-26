/**
 * DevTools CSS styles
 * 
 * Uses a distinctive terminal/hacker aesthetic with green-on-dark theme
 */

export const DEVTOOLS_STYLES = `
/* DevTools Container */
.tessera-devtools {
  --dt-bg-primary: #0d1117;
  --dt-bg-secondary: #161b22;
  --dt-bg-tertiary: #21262d;
  --dt-border: #30363d;
  --dt-text-primary: #c9d1d9;
  --dt-text-secondary: #8b949e;
  --dt-text-muted: #484f58;
  --dt-accent: #00ff88;
  --dt-accent-dim: #00cc6a;
  --dt-accent-glow: rgba(0, 255, 136, 0.15);
  --dt-warning: #f0883e;
  --dt-error: #f85149;
  --dt-info: #58a6ff;
  --dt-success: #3fb950;
  --dt-purple: #a371f7;
  --dt-font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  --dt-font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
  
  position: fixed;
  z-index: 99999;
  font-family: var(--dt-font-mono);
  font-size: 12px;
  line-height: 1.5;
  color: var(--dt-text-primary);
  box-sizing: border-box;
}

.tessera-devtools *,
.tessera-devtools *::before,
.tessera-devtools *::after {
  box-sizing: border-box;
}

/* Position variants */
.tessera-devtools.dt-right {
  top: 0;
  right: 0;
  width: 420px;
  height: 100vh;
  border-left: 1px solid var(--dt-accent);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.5), -1px 0 0 var(--dt-accent-glow);
}

.tessera-devtools.dt-bottom {
  bottom: 0;
  left: 0;
  right: 0;
  height: 360px;
  border-top: 1px solid var(--dt-accent);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.5), 0 -1px 0 var(--dt-accent-glow);
}

.tessera-devtools.dt-left {
  top: 0;
  left: 0;
  width: 420px;
  height: 100vh;
  border-right: 1px solid var(--dt-accent);
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5), 1px 0 0 var(--dt-accent-glow);
}

.tessera-devtools.dt-floating {
  top: 20px;
  right: 20px;
  width: 460px;
  height: 560px;
  border: 1px solid var(--dt-accent);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--dt-accent-glow);
  resize: both;
  overflow: hidden;
}

/* Hidden state */
.tessera-devtools.dt-hidden {
  display: none;
}

/* Main layout */
.dt-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--dt-bg-primary);
}

/* Header */
.dt-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: linear-gradient(180deg, var(--dt-bg-secondary) 0%, var(--dt-bg-primary) 100%);
  border-bottom: 1px solid var(--dt-border);
  gap: 8px;
  user-select: none;
}

.dt-logo {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--dt-accent);
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.5px;
}

.dt-logo svg {
  width: 16px;
  height: 16px;
}

.dt-version {
  font-size: 10px;
  color: var(--dt-text-muted);
  background: var(--dt-bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
}

.dt-header-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}

.dt-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--dt-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.dt-btn:hover {
  background: var(--dt-bg-tertiary);
  color: var(--dt-text-primary);
  border-color: var(--dt-border);
}

.dt-btn:active {
  transform: scale(0.95);
}

/* Close button - always visible with distinct styling */
.dt-btn.dt-btn-close {
  width: auto;
  height: 22px;
  padding: 0 8px;
  gap: 4px;
  background: rgba(248, 81, 73, 0.15);
  border: 1px solid rgba(248, 81, 73, 0.3);
  border-radius: 4px;
  color: var(--dt-error);
  font-family: var(--dt-font-mono);
  font-size: 10px;
  font-weight: 500;
}

.dt-btn.dt-btn-close svg {
  width: 12px;
  height: 12px;
}

.dt-btn.dt-btn-close:hover {
  background: var(--dt-error);
  color: white;
  border-color: var(--dt-error);
}

/* Tab navigation */
.dt-tabs {
  display: flex;
  background: var(--dt-bg-secondary);
  border-bottom: 1px solid var(--dt-border);
  overflow-x: auto;
  scrollbar-width: none;
}

.dt-tabs::-webkit-scrollbar {
  display: none;
}

.dt-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 60px;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--dt-text-secondary);
  font-family: var(--dt-font-mono);
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
}

.dt-tab:hover {
  background: var(--dt-bg-tertiary);
  color: var(--dt-text-primary);
}

.dt-tab.dt-tab-active {
  color: var(--dt-accent);
  border-bottom-color: var(--dt-accent);
  background: var(--dt-accent-glow);
}

.dt-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: 18px;
  height: 16px;
  padding: 0 4px;
  background: var(--dt-accent);
  border-radius: 8px;
  color: var(--dt-bg-primary);
  font-size: 10px;
  font-weight: 700;
}

.dt-tab-badge.dt-badge-warning {
  background: var(--dt-warning);
}

.dt-tab-badge.dt-badge-error {
  background: var(--dt-error);
}

/* Panel content */
.dt-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dt-panel {
  display: none;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.dt-panel.dt-panel-active {
  display: flex;
}

.dt-panel-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.dt-panel-scroll::-webkit-scrollbar {
  width: 6px;
}

.dt-panel-scroll::-webkit-scrollbar-track {
  background: var(--dt-bg-primary);
}

.dt-panel-scroll::-webkit-scrollbar-thumb {
  background: var(--dt-border);
  border-radius: 3px;
}

.dt-panel-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--dt-text-muted);
}

/* Section groups */
.dt-section {
  margin-bottom: 16px;
}

.dt-section:last-child {
  margin-bottom: 0;
}

.dt-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--dt-border);
  color: var(--dt-text-secondary);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.dt-section-title svg {
  width: 12px;
  height: 12px;
  color: var(--dt-accent);
}

/* Property rows */
.dt-row {
  display: flex;
  align-items: flex-start;
  padding: 4px 0;
  gap: 8px;
}

.dt-row + .dt-row {
  border-top: 1px solid var(--dt-bg-tertiary);
}

.dt-label {
  flex-shrink: 0;
  width: 100px;
  color: var(--dt-text-secondary);
  font-size: 11px;
}

.dt-value {
  flex: 1;
  color: var(--dt-accent);
  word-break: break-all;
  font-size: 11px;
}

.dt-value.dt-value-string {
  color: #a5d6ff;
}

.dt-value.dt-value-number {
  color: #7ee787;
}

.dt-value.dt-value-boolean {
  color: #ff7b72;
}

.dt-value.dt-value-null {
  color: var(--dt-text-muted);
  font-style: italic;
}

.dt-value.dt-value-object {
  color: #d2a8ff;
}

/* Stats grid */
.dt-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.dt-stats-grid.dt-stats-grid-3 {
  grid-template-columns: repeat(3, 1fr);
}

.dt-stats-grid.dt-stats-grid-4 {
  grid-template-columns: repeat(4, 1fr);
}

.dt-stat-card {
  background: var(--dt-bg-secondary);
  border: 1px solid var(--dt-border);
  border-radius: 6px;
  padding: 10px;
}

.dt-stat-card.dt-stat-card-wide {
  grid-column: span 2;
}

.dt-stat-label {
  font-size: 10px;
  color: var(--dt-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.dt-stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--dt-accent);
  line-height: 1.2;
}

.dt-stat-value.dt-stat-warning {
  color: var(--dt-warning);
}

.dt-stat-value.dt-stat-error {
  color: var(--dt-error);
}

.dt-stat-value.dt-stat-success {
  color: var(--dt-success);
}

.dt-stat-unit {
  font-size: 11px;
  color: var(--dt-text-muted);
  margin-left: 2px;
}

.dt-stat-subtext {
  font-size: 10px;
  color: var(--dt-text-muted);
  margin-top: 2px;
}

/* FPS Graph */
.dt-fps-graph {
  height: 60px;
  background: var(--dt-bg-secondary);
  border: 1px solid var(--dt-border);
  border-radius: 6px;
  overflow: hidden;
  margin-top: 8px;
}

.dt-fps-canvas {
  width: 100%;
  height: 100%;
}

/* Progress bar */
.dt-progress {
  height: 4px;
  background: var(--dt-bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 4px;
}

.dt-progress-bar {
  height: 100%;
  background: var(--dt-accent);
  transition: width 0.3s ease;
}

.dt-progress-bar.dt-progress-warning {
  background: var(--dt-warning);
}

.dt-progress-bar.dt-progress-error {
  background: var(--dt-error);
}

/* Frame Budget Bar */
.dt-budget-bar {
  height: 24px;
  background: var(--dt-bg-secondary);
  border: 1px solid var(--dt-border);
  border-radius: 6px;
  overflow: hidden;
  position: relative;
  margin-top: 8px;
}

.dt-budget-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--dt-accent) 0%, var(--dt-accent) 100%);
  transition: width 0.1s ease, background 0.3s ease;
}

.dt-budget-fill.dt-budget-warning {
  background: linear-gradient(90deg, var(--dt-accent) 0%, var(--dt-warning) 100%);
}

.dt-budget-fill.dt-budget-over {
  background: linear-gradient(90deg, var(--dt-warning) 0%, var(--dt-error) 100%);
}

.dt-budget-markers {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.dt-budget-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--dt-text-muted);
}

.dt-budget-marker::after {
  content: attr(data-label);
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  color: var(--dt-text-muted);
  white-space: nowrap;
}

.dt-budget-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 11px;
  font-weight: 600;
  color: var(--dt-bg-primary);
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

/* Histogram */
.dt-histogram {
  height: 80px;
  background: var(--dt-bg-secondary);
  border: 1px solid var(--dt-border);
  border-radius: 6px;
  overflow: hidden;
  margin-top: 8px;
  position: relative;
}

.dt-histogram-canvas {
  width: 100%;
  height: 100%;
}

.dt-histogram-labels {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px;
  font-size: 9px;
  color: var(--dt-text-muted);
}

/* Percentile stats */
.dt-percentile-row {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.dt-percentile {
  flex: 1;
  text-align: center;
  padding: 8px;
  background: var(--dt-bg-secondary);
  border: 1px solid var(--dt-border);
  border-radius: 4px;
}

.dt-percentile-label {
  font-size: 9px;
  color: var(--dt-text-muted);
  text-transform: uppercase;
}

.dt-percentile-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--dt-accent);
}

/* Alert/Warning Box */
.dt-alerts {
  margin-bottom: 12px;
}

.dt-alert {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: var(--dt-bg-secondary);
  border: 1px solid var(--dt-border);
  border-radius: 6px;
  margin-bottom: 8px;
  animation: dt-alert-pulse 2s infinite;
}

.dt-alert:last-child {
  margin-bottom: 0;
}

.dt-alert-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

.dt-alert.dt-alert-warning {
  border-color: var(--dt-warning);
  background: rgba(240, 136, 62, 0.1);
}

.dt-alert.dt-alert-warning .dt-alert-icon {
  color: var(--dt-warning);
}

.dt-alert.dt-alert-error {
  border-color: var(--dt-error);
  background: rgba(248, 81, 73, 0.1);
}

.dt-alert.dt-alert-error .dt-alert-icon {
  color: var(--dt-error);
}

.dt-alert.dt-alert-info {
  border-color: var(--dt-info);
  background: rgba(88, 166, 255, 0.1);
}

.dt-alert.dt-alert-info .dt-alert-icon {
  color: var(--dt-info);
}

.dt-alert-content {
  flex: 1;
}

.dt-alert-title {
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 2px;
}

.dt-alert-message {
  font-size: 10px;
  color: var(--dt-text-secondary);
}

@keyframes dt-alert-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}

/* Waterfall Chart */
.dt-waterfall {
  background: var(--dt-bg-secondary);
  border: 1px solid var(--dt-border);
  border-radius: 6px;
  overflow: hidden;
  margin-top: 8px;
}

.dt-waterfall-header {
  display: flex;
  padding: 6px 10px;
  background: var(--dt-bg-tertiary);
  border-bottom: 1px solid var(--dt-border);
  font-size: 9px;
  color: var(--dt-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.dt-waterfall-header-name {
  width: 100px;
  flex-shrink: 0;
}

.dt-waterfall-header-timeline {
  flex: 1;
  display: flex;
  justify-content: space-between;
}

.dt-waterfall-scroll {
  max-height: 200px;
  overflow-y: auto;
}

.dt-waterfall-row {
  display: flex;
  align-items: center;
  padding: 4px 10px;
  border-bottom: 1px solid var(--dt-bg-tertiary);
  font-size: 10px;
}

.dt-waterfall-row:last-child {
  border-bottom: none;
}

.dt-waterfall-name {
  width: 100px;
  flex-shrink: 0;
  color: var(--dt-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dt-waterfall-timeline {
  flex: 1;
  height: 14px;
  position: relative;
  background: var(--dt-bg-primary);
  border-radius: 2px;
}

.dt-waterfall-bar {
  position: absolute;
  top: 2px;
  bottom: 2px;
  border-radius: 2px;
  min-width: 2px;
}

.dt-waterfall-bar.dt-waterfall-fetch {
  background: var(--dt-info);
}

.dt-waterfall-bar.dt-waterfall-decode {
  background: var(--dt-purple);
}

.dt-waterfall-bar.dt-waterfall-upload {
  background: var(--dt-accent);
}

.dt-waterfall-time {
  width: 50px;
  flex-shrink: 0;
  text-align: right;
  color: var(--dt-text-muted);
  font-size: 9px;
}

/* Render Phase breakdown */
.dt-phase-chart {
  background: var(--dt-bg-secondary);
  border: 1px solid var(--dt-border);
  border-radius: 6px;
  padding: 12px;
  margin-top: 8px;
}

.dt-phase-bar-container {
  height: 20px;
  display: flex;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.dt-phase-segment {
  height: 100%;
  position: relative;
  transition: width 0.3s ease;
}

.dt-phase-segment:first-child {
  border-radius: 4px 0 0 4px;
}

.dt-phase-segment:last-child {
  border-radius: 0 4px 4px 0;
}

.dt-phase-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.dt-phase-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}

.dt-phase-legend-color {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.dt-phase-legend-value {
  color: var(--dt-text-muted);
}

/* Recording indicator */
.dt-recording {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(248, 81, 73, 0.1);
  border: 1px solid var(--dt-error);
  border-radius: 6px;
  margin-bottom: 12px;
}

.dt-recording-dot {
  width: 8px;
  height: 8px;
  background: var(--dt-error);
  border-radius: 50%;
  animation: dt-recording-pulse 1s infinite;
}

@keyframes dt-recording-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.dt-recording-text {
  font-size: 11px;
  color: var(--dt-error);
  font-weight: 500;
}

.dt-recording-time {
  margin-left: auto;
  font-size: 11px;
  color: var(--dt-text-muted);
}

/* Jank markers */
.dt-jank-list {
  max-height: 150px;
  overflow-y: auto;
  background: var(--dt-bg-secondary);
  border: 1px solid var(--dt-border);
  border-radius: 6px;
  margin-top: 8px;
}

.dt-jank-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--dt-bg-tertiary);
  font-size: 10px;
}

.dt-jank-item:last-child {
  border-bottom: none;
}

.dt-jank-time {
  color: var(--dt-text-muted);
  width: 70px;
  flex-shrink: 0;
}

.dt-jank-duration {
  color: var(--dt-warning);
  font-weight: 600;
}

.dt-jank-duration.dt-jank-severe {
  color: var(--dt-error);
}

/* Event log */
.dt-event-list {
  font-family: var(--dt-font-mono);
  font-size: 11px;
}

.dt-event-item {
  display: flex;
  align-items: flex-start;
  padding: 6px 8px;
  background: var(--dt-bg-secondary);
  border-radius: 4px;
  margin-bottom: 4px;
  gap: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.dt-event-item:hover {
  background: var(--dt-bg-tertiary);
}

.dt-event-time {
  flex-shrink: 0;
  color: var(--dt-text-muted);
  font-size: 10px;
}

.dt-event-type {
  flex-shrink: 0;
  padding: 2px 6px;
  background: var(--dt-accent-glow);
  border-radius: 3px;
  color: var(--dt-accent);
  font-size: 10px;
  font-weight: 500;
}

.dt-event-payload {
  flex: 1;
  color: var(--dt-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10px;
}

.dt-event-payload-expanded {
  white-space: pre-wrap;
  word-break: break-all;
  overflow: visible;
}

/* Toolbar */
.dt-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--dt-bg-secondary);
  border-bottom: 1px solid var(--dt-border);
}

.dt-toolbar-input {
  flex: 1;
  padding: 6px 10px;
  background: var(--dt-bg-primary);
  border: 1px solid var(--dt-border);
  border-radius: 4px;
  color: var(--dt-text-primary);
  font-family: var(--dt-font-mono);
  font-size: 11px;
}

.dt-toolbar-input:focus {
  outline: none;
  border-color: var(--dt-accent);
  box-shadow: 0 0 0 2px var(--dt-accent-glow);
}

.dt-toolbar-input::placeholder {
  color: var(--dt-text-muted);
}

.dt-toolbar-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: var(--dt-bg-tertiary);
  border: 1px solid var(--dt-border);
  border-radius: 4px;
  color: var(--dt-text-secondary);
  font-family: var(--dt-font-mono);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.dt-toolbar-btn:hover {
  background: var(--dt-accent);
  color: var(--dt-bg-primary);
  border-color: var(--dt-accent);
}

.dt-toolbar-btn:hover svg {
  color: var(--dt-bg-primary);
}

.dt-toolbar-btn.dt-btn-recording {
  background: var(--dt-error);
  border-color: var(--dt-error);
  color: white;
}

.dt-toolbar-btn.dt-btn-recording:hover {
  background: #d73a49;
}

.dt-toolbar-btn svg {
  width: 12px;
  height: 12px;
}

/* Coordinate picker */
.dt-coord-picker {
  padding: 12px;
}

.dt-coord-display {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.dt-coord-box {
  background: var(--dt-bg-secondary);
  border: 1px solid var(--dt-border);
  border-radius: 6px;
  padding: 12px;
}

.dt-coord-box-title {
  font-size: 10px;
  color: var(--dt-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.dt-coord-value {
  font-size: 14px;
  color: var(--dt-accent);
}

.dt-coord-hint {
  margin-top: 12px;
  padding: 8px 12px;
  background: var(--dt-accent-glow);
  border-radius: 4px;
  color: var(--dt-text-secondary);
  font-size: 11px;
  text-align: center;
}

/* Tile overlay styles (injected separately) */
.tessera-tile-overlay {
  position: absolute;
  pointer-events: none;
  border: 1px solid rgba(0, 255, 136, 0.5);
  background: rgba(0, 255, 136, 0.05);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: rgba(0, 255, 136, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tessera-tile-overlay.loading {
  border-color: rgba(255, 200, 0, 0.5);
  background: rgba(255, 200, 0, 0.05);
  color: rgba(255, 200, 0, 0.8);
}

/* Toggle button (floating) - transparent background */
.dt-toggle-btn {
  position: fixed;
  z-index: 99998;
  bottom: 20px;
  right: 20px;
  width: 44px;
  height: 44px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: #8b949e;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.dt-toggle-btn:hover {
  background: transparent;
  color: #00ff88;
}

.dt-toggle-btn:active {
  color: #00cc6a;
}

.dt-toggle-btn svg {
  width: 24px;
  height: 24px;
  transition: color 0.2s ease;
}

/* Network stats */
.dt-network-stats {
  background: var(--dt-bg-secondary);
  border: 1px solid var(--dt-border);
  border-radius: 6px;
  padding: 12px;
  margin-top: 8px;
}

.dt-network-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 11px;
}

.dt-network-row + .dt-network-row {
  border-top: 1px solid var(--dt-bg-tertiary);
}

.dt-network-label {
  color: var(--dt-text-secondary);
}

.dt-network-value {
  color: var(--dt-accent);
  font-weight: 500;
}

/* Memory chart */
.dt-memory-chart {
  height: 60px;
  background: var(--dt-bg-secondary);
  border: 1px solid var(--dt-border);
  border-radius: 6px;
  overflow: hidden;
  margin-top: 8px;
}

.dt-memory-canvas {
  width: 100%;
  height: 100%;
}

/* Animation */
@keyframes dt-fade-in {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.tessera-devtools.dt-right {
  animation: dt-fade-in 0.2s ease;
}

@keyframes dt-slide-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.tessera-devtools.dt-bottom {
  animation: dt-slide-up 0.2s ease;
}

/* Empty state */
.dt-empty {
  text-align: center;
  padding: 20px;
  color: var(--dt-text-muted);
  font-size: 11px;
}

/* Responsive */
@media (max-width: 480px) {
  .tessera-devtools.dt-right,
  .tessera-devtools.dt-left {
    width: 100%;
  }
  
  .tessera-devtools.dt-floating {
    top: 10px;
    right: 10px;
    left: 10px;
    width: auto;
  }
}
`;
