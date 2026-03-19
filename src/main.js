/**
 * ASCEND GCS — Main Entry Point
 * Initializes all modules, tab navigation, and the render loop
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
    this._activeTab = 'flight-data';
  }

  init() {
    console.log('🚀 ASCEND GCS — Initializing...');

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

    // Tab navigation
    this._setupTabs();

    // Graph param selector
    document.getElementById('graph-param')?.addEventListener('change', (e) => {
      this.graphParam = e.target.value;
    });

    // Start render loop
    this._startLoop();

    // Initial log
    CommandCenter.addLog('ASCEND GCS initialized — simulated mode', 'system');
    CommandCenter.addLog('Waiting for vehicle connection...', 'system');

    console.log('✅ ASCEND GCS — Ready');
  }

  _setupTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        this._activeTab = targetTab;

        // Update nav
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update content
        contents.forEach(c => {
          c.classList.remove('active');
          if (c.id === `tab-${targetTab}`) {
            c.classList.add('active');
          }
        });
      });
    });
  }

  _startLoop() {
    const loop = () => {
      // Tick telemetry simulation
      this.telemetry.tick(0.1);

      // Update HUD
      this.hud.update(this.telemetry.data);
      this.hud.render();

      // Update telemetry UI
      this.telemetry.updateUI();

      // Update graph (only if Flight Data tab is visible)
      if (this._activeTab === 'flight-data') {
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

// If DOM is already ready
if (document.readyState !== 'loading') {
  app.init();
}
