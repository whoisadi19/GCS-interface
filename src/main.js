/**
 * ASCEND GCS KINETIC — Main Entry Point
 * Initializes all modules, KINETIC tab/side-nav system, and render loop
 */

import { HUD } from './modules/hud.js';
import { Telemetry } from './modules/telemetry.js';
import { CommandCenter } from './modules/commands.js';
import { DetectionViewer } from './modules/detections.js';
import { SeedImageManager } from './modules/seedImages.js';

class GCSApp {
  constructor() {
    this.hud = null;
    this.telemetry = null;
    this.commands = null;
    this.detections = null;
    this.seedImages = null;
    this.graphParam = 'altitude';
    this._rafId = null;
    this._activeTab = 'dashboard';
  }

  init() {
    console.log('🚀 ASCEND GCS KINETIC — Initializing...');

    // Initialize modules
    this.telemetry = new Telemetry();
    this.hud = new HUD('hud-canvas');

    // Command center with logging callback
    this.commands = new CommandCenter(this.telemetry, (msg, type) => {
      CommandCenter.addLog(msg, type);
    });

    // Detection viewer
    this.detections = new DetectionViewer();

    // Seed image manager
    this.seedImages = new SeedImageManager(this.detections);

    // Tab navigation (both top nav and side nav)
    this._setupTabs();

    // Graph param selector
    document.getElementById('graph-param')?.addEventListener('change', (e) => {
      this.graphParam = e.target.value;
    });

    // Start render loop
    this._startLoop();

    // Initial log
    CommandCenter.addLog('ASCEND GCS KINETIC initialized — simulated mode', 'system');
    CommandCenter.addLog('Waiting for vehicle connection...', 'system');

    console.log('✅ ASCEND GCS KINETIC — Ready');
  }

  _setupTabs() {
    const topTabs = document.querySelectorAll('.nav-tab');
    const sideTabs = document.querySelectorAll('.side-nav-item');
    const panels = document.querySelectorAll('.tab-panel');

    const switchTab = (targetTab) => {
      this._activeTab = targetTab;

      // Update top nav
      topTabs.forEach(t => {
        t.classList.remove('active');
        t.classList.remove('text-primary', 'border-primary');
        t.classList.add('text-on-surface-variant', 'border-transparent');
        if (t.dataset.tab === targetTab) {
          t.classList.add('active', 'text-primary', 'border-primary');
          t.classList.remove('text-on-surface-variant', 'border-transparent');
        }
      });

      // Update side nav
      sideTabs.forEach(s => {
        s.classList.remove('active', 'bg-primary/10', 'text-primary', 'border-primary');
        s.classList.add('text-on-surface-variant', 'border-transparent');
        if (s.dataset.tab === targetTab) {
          s.classList.add('active', 'bg-primary/10', 'text-primary', 'border-primary');
          s.classList.remove('text-on-surface-variant', 'border-transparent');
        }
      });

      // Update panels
      panels.forEach(p => {
        p.classList.remove('active');
        if (p.id === `tab-${targetTab}`) p.classList.add('active');
      });
    };

    topTabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
    sideTabs.forEach(item => item.addEventListener('click', () => switchTab(item.dataset.tab)));
  }

  _startLoop() {
    const loop = () => {
      // Tick telemetry simulation
      this.telemetry.tick(0.1);

      // Update HUD (only render canvas if PFD tab is visible)
      this.hud.update(this.telemetry.data);
      if (this._activeTab === 'pfd') {
        this.hud.render();
      }

      // Update telemetry UI (updates all elements regardless of tab)
      this.telemetry.updateUI();

      // Update graph (only if Dashboard tab is visible)
      if (this._activeTab === 'dashboard') {
        this.telemetry.drawGraph('telem-graph', this.graphParam);
      }

      this._rafId = requestAnimationFrame(loop);
    };

    loop();
  }

  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this.detections?.destroy();
    this.seedImages?.destroy();
  }
}

// Boot
const app = new GCSApp();
document.addEventListener('DOMContentLoaded', () => app.init());
if (document.readyState !== 'loading') app.init();
