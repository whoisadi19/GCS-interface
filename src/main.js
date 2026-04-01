/**
 * ASCEND GCS KINETIC — Main Entry Point
 * Initializes all modules, KINETIC tab/side-nav system, and render loop
 */

import { HUD } from './modules/hud.js';
import { Telemetry } from './modules/telemetry.js';
import { CommandCenter } from './modules/commands.js';
import { DetectionViewer } from './modules/detections.js';
import { SeedImageManager } from './modules/seedImages.js';
import { ROSBridgeClient } from './modules/rosbridge.js';
import { FailsafeSystem } from './modules/failsafes.js';

class GCSApp {
  constructor() {
    this.hud = null;
    this.telemetry = null;
    this.commands = null;
    this.detections = null;
    this.seedImages = null;
    this.failsafes = null;
    this.graphParam = 'altitude';
    this._rafId = null;
    this._activeTab = 'dashboard';
    this.rosbridge = null;
  }

  init() {
    console.log('🚀 ASCEND GCS KINETIC — Initializing...');

    // Initialize modules
    this.telemetry = new Telemetry();
    this.hud = new HUD('hud-canvas');
    this.rosbridge = new ROSBridgeClient();

    this.commands = new CommandCenter(this.telemetry, (msg, type) => {
      CommandCenter.addLog(msg, type);
    }, this.rosbridge);

    this.failsafes = new FailsafeSystem(this.telemetry, this.commands);

    // Detection viewer
    this.detections = new DetectionViewer();

    // Seed image manager
    this.seedImages = new SeedImageManager(this.detections, this.rosbridge);

    this._setupROS();

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

  _setupROS() {
    this.rosbridge.onConnected = () => {
      this.telemetry.mode = 'live';
      this.detections.mode = 'live';
      this.seedImages.mode = 'live';
      this._updateConnStatus('LIVE', 'tertiary');
      CommandCenter.addLog('Connected to Pi 4 ROSBridge', 'success');

      // Link Quality heartbeat subscription
      this.rosbridge.onLinkQuality = (quality) => {
        this.telemetry.applyLiveData({ link: quality });
      };

      // Subscriptions
      this.rosbridge.subscribe('/mavros/state', 'mavros_msgs/State', (msg) => {
        this.telemetry.applyLiveData({
          armed: msg.armed,
          mode: msg.mode,
          connected: msg.connected
        });
      });

      this.rosbridge.subscribe('/mavros/imu/data', 'sensor_msgs/Imu', (msg) => {
        // simple quaternion to euler for hud
        const q0 = msg.orientation.w;
        const q1 = msg.orientation.x;
        const q2 = msg.orientation.y;
        const q3 = msg.orientation.z;
        const roll = Math.atan2(2 * (q0 * q1 + q2 * q3), 1 - 2 * (q1 * q1 + q2 * q2)) * 180 / Math.PI;
        const pitch = Math.asin(2 * (q0 * q2 - q3 * q1)) * 180 / Math.PI;
        this.telemetry.applyLiveData({ roll, pitch });
      });

      this.rosbridge.subscribe('/mavros/global_position/compass_hdg', 'std_msgs/Float64', (msg) => {
        this.telemetry.applyLiveData({ heading: msg.data });
      });

      this.rosbridge.subscribe('/mavros/local_position/pose', 'geometry_msgs/PoseStamped', (msg) => {
        this.telemetry.applyLiveData({ altitude: msg.pose.position.z });
      });

      this.rosbridge.subscribe('/mavros/local_position/velocity_body', 'geometry_msgs/TwistStamped', (msg) => {
        const speed = Math.sqrt(msg.twist.linear.x ** 2 + msg.twist.linear.y ** 2);
        this.telemetry.applyLiveData({ speed: speed, vspeed: msg.twist.linear.z });
      });

      this.rosbridge.subscribe('/mavros/battery', 'sensor_msgs/BatteryState', (msg) => {
        this.telemetry.applyLiveData({ 
          battery: msg.percentage * 100,
          voltage: msg.voltage,
          current: Math.abs(msg.current)
        });
      });

      this.rosbridge.subscribe('/mavros/global_position/raw/satellites', 'std_msgs/UInt32', (msg) => {
        this.telemetry.applyLiveData({ gps_sats: msg.data });
      });

      this.rosbridge.subscribe('/mavros/vfr_hud', 'mavros_msgs/VFR_HUD', (msg) => {
        this.telemetry.applyLiveData({
          heading: msg.heading, // vfr hud heading is somewhat reliable fallback
          speed: msg.groundspeed,
          altitude: msg.alt
        });
      });

      // Detections subscription (Placeholder for Pi's AI pipeline)
      this.rosbridge.subscribe('/ai/detections', 'std_msgs/String', (msg) => {
        try {
          const payload = JSON.parse(msg.data);
          if (Array.isArray(payload)) {
            payload.forEach(d => this.detections.applyLiveDetection(d));
          } else {
            this.detections.applyLiveDetection(payload);
          }
        } catch (e) {
          console.warn('Failed to parse detection data:', e);
        }
      });
    };

    this.rosbridge.onDisconnected = () => {
      if (this.telemetry.mode === 'live') {
        CommandCenter.addLog('Disconnected from ROSBridge — Falling back to Simulation', 'warning');
      }
      this.telemetry.mode = 'simulated';
      this.detections.mode = 'simulated';
      this.seedImages.mode = 'simulated';
      this._updateConnStatus('SIMULATED', 'secondary-container');
    };

    this.rosbridge.onError = (e) => {
      this.telemetry.mode = 'simulated';
      this.detections.mode = 'simulated';
      this.seedImages.mode = 'simulated';
      this._updateConnStatus('DISCONNECTED', 'error');
    };

    const btnConnect = document.getElementById('btn-ros-connect');
    if (btnConnect) {
      btnConnect.addEventListener('click', () => {
        if (this.rosbridge.connected) {
          this.rosbridge.disconnect();
          btnConnect.textContent = 'Connect';
        } else {
          const ip = document.getElementById('ros-ip').value;
          const port = document.getElementById('ros-port').value;
          this.rosbridge.connect(`ws://${ip}:${port}`);
          btnConnect.textContent = 'Disconnect';
        }
      });
    }

    // Auto-connect attempt
    const defaultIp = document.getElementById('ros-ip')?.value || '192.168.1.100';
    const defaultPort = document.getElementById('ros-port')?.value || '9090';
    this.rosbridge.connect(`ws://${defaultIp}:${defaultPort}`);
  }

  _updateConnStatus(text, colorClass) {
    const container = document.getElementById('conn-status-container');
    const dot = document.getElementById('conn-dot');
    const label = document.getElementById('conn-label');
    
    if (container && dot && label) {
      container.className = `flex items-center gap-2 px-3 py-1 bg-${colorClass}/10`;
      dot.className = `w-2 h-2 rounded-full bg-${colorClass} ${text === 'LIVE' ? 'pulse-glow' : ''}`;
      label.className = `text-[10px] font-mono uppercase tracking-widest text-${colorClass}`;
      label.textContent = text;
    }
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

      // Check telemetry against safety thresholds
      // if (this.failsafes) this.failsafes.tick(); // Temporarily disabled since missing MAVROS crashes the websocket

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
