/**
 * Telemetry Module — Simulates MAVLink telemetry data and updates UI
 */

export class Telemetry {
  constructor() {
    this.data = {
      roll: 0,
      pitch: 0,
      heading: 0,
      altitude: 0,
      speed: 0,
      vspeed: 0,
      battery: 100,
      voltage: 14.8,
      current: 0,
      gps_sats: 0,
      link: 100,
      mode: 'STABILIZE',
      armed: false,
      fsmState: 'INIT',
      sortie: 1,
    };

    this.history = {
      altitude: [],
      speed: [],
      battery: [],
      heading: [],
    };
    this.maxHistory = 200;

    // Simulation state
    this._simTime = 0;
    this._missionActive = false;
    this._fsmIndex = 0;
    this._fsmStates = ['INIT', 'READY', 'TAKEOFF', 'SEARCH', 'FEATURE_LOG', 'RETURN', 'LAND', 'DOCK', 'RECHARGE'];
  }

  /**
   * Simulate one tick of telemetry data
   */
  tick(dt = 0.1) {
    this._simTime += dt;
    const t = this._simTime;

    // Smooth oscillations for realistic feel
    this.data.roll = Math.sin(t * 0.3) * 8 + Math.sin(t * 0.7) * 3;
    this.data.pitch = Math.sin(t * 0.2) * 5 + Math.cos(t * 0.5) * 2;
    this.data.heading = ((t * 5) % 360 + 360) % 360;

    // Altitude simulation 
    if (this.data.armed) {
      const targetAlt = this._missionActive ? 2.5 + Math.sin(t * 0.1) * 0.3 : 0;
      this.data.altitude += (targetAlt - this.data.altitude) * 0.02;
      this.data.vspeed = (targetAlt - this.data.altitude) * 0.5;
      this.data.speed = this._missionActive ? 0.8 + Math.sin(t * 0.15) * 0.3 : 0;
      this.data.current = 8 + Math.random() * 4;
      this.data.battery = Math.max(5, this.data.battery - 0.003);
      this.data.voltage = 12.6 + (this.data.battery / 100) * 2.2;
    } else {
      this.data.altitude *= 0.95;
      this.data.speed *= 0.95;
      this.data.vspeed = 0;
      this.data.current = 0.2;
      this.data.roll = 0;
      this.data.pitch = 0;
    }

    // GPS sats (simulated warm-up)
    if (this.data.gps_sats < 12) {
      this.data.gps_sats = Math.min(12, Math.floor(t * 0.5));
    }

    // Link quality with slight jitter
    this.data.link = Math.max(70, 100 - Math.random() * 8);

    // Record history
    for (const key of ['altitude', 'speed', 'battery', 'heading']) {
      this.history[key].push(this.data[key]);
      if (this.history[key].length > this.maxHistory) {
        this.history[key].shift();
      }
    }
  }

  setArmed(armed) {
    this.data.armed = armed;
  }

  setMode(mode) {
    this.data.mode = mode;
  }

  setFSMState(state) {
    this.data.fsmState = state;
    this._fsmIndex = this._fsmStates.indexOf(state);
  }

  startMission() {
    this._missionActive = true;
  }

  stopMission() {
    this._missionActive = false;
  }

  /**
   * Update all UI elements with current telemetry data
   */
  updateUI() {
    const d = this.data;

    // Telemetry cards
    this._setText('telem-alt', `${d.altitude.toFixed(1)} <small>m</small>`);
    this._setText('telem-speed', `${d.speed.toFixed(1)} <small>m/s</small>`);
    this._setText('telem-heading', `${Math.round(d.heading)}° <small>${this._headingDir(d.heading)}</small>`);
    this._setText('telem-battery', `${Math.round(d.battery)} <small>%</small>`);
    this._setText('telem-voltage', `${d.voltage.toFixed(1)} <small>V</small>`);
    this._setText('telem-current', `${d.current.toFixed(1)} <small>A</small>`);
    this._setText('telem-sats', `${d.gps_sats}`);
    this._setText('telem-link', `${Math.round(d.link)} <small>%</small>`);

    // Bars
    this._setBar('bar-alt', (d.altitude / 5) * 100);
    this._setBar('bar-speed', (d.speed / 2) * 100);
    this._setBar('bar-battery', d.battery);
    this._setBar('bar-link', d.link);

    // Battery color
    const batBar = document.getElementById('bar-battery');
    if (batBar) {
      batBar.style.background = d.battery > 30 ? '#34d399' : (d.battery > 15 ? '#fbbf24' : '#f87171');
    }

    // VIO status
    const vio = document.getElementById('telem-vio');
    if (vio) {
      if (d.armed && this._missionActive) {
        vio.textContent = 'TRACKING';
        vio.className = 'telem-value status-good';
      } else if (d.armed) {
        vio.textContent = 'ACTIVE';
        vio.className = 'telem-value status-good';
      } else {
        vio.textContent = 'IDLE';
        vio.className = 'telem-value';
      }
    }

    // Compass needle
    const needle = document.getElementById('compass-needle');
    if (needle) {
      needle.style.transform = `translate(-50%, 0) rotate(${d.heading}deg)`;
    }

    // HUD badges
    this._setText('hud-mode-badge', d.mode);
    const armedBadge = document.getElementById('hud-armed-badge');
    if (armedBadge) {
      armedBadge.textContent = d.armed ? 'ARMED' : 'DISARMED';
      armedBadge.className = `armed-badge ${d.armed ? 'armed' : 'disarmed'}`;
    }

    // Top bar badges
    this._setText('fsm-badge', d.fsmState);
    this._setText('sortie-badge', `Sortie #${d.sortie}`);

    // FSM timeline
    this._updateFSMTimeline(d.fsmState);

    // Status bar
    this._setText('status-mode', `Mode: ${d.mode}`);
    this._setText('status-bat-val', `${Math.round(d.battery)}%`);
    this._setText('status-link', `Link: ${Math.round(d.link)}%`);
    this._setText('status-datarate', `↕ ${Math.round(Math.random() * 200 + 800)} B/s`);

    const batFill = document.getElementById('status-bat-fill');
    if (batFill) {
      batFill.style.width = `${d.battery}%`;
      batFill.style.background = d.battery > 30 ? '#34d399' : (d.battery > 15 ? '#fbbf24' : '#f87171');
    }

    // Time
    const timeEl = document.getElementById('status-time');
    if (timeEl) {
      timeEl.textContent = new Date().toLocaleTimeString();
    }
  }

  _setText(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  _setBar(id, pct) {
    const el = document.getElementById(id);
    if (el) el.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  }

  _headingDir(h) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(h / 45) % 8];
  }

  _updateFSMTimeline(currentState) {
    const states = document.querySelectorAll('.fsm-state');
    let found = false;
    states.forEach(el => {
      const s = el.dataset.state;
      if (s === currentState) {
        el.className = 'fsm-state active';
        found = true;
      } else if (!found) {
        el.className = 'fsm-state completed';
      } else {
        el.className = 'fsm-state';
      }
    });
  }

  /**
   * Draw telemetry graph on canvas
   */
  drawGraph(canvasId, param = 'altitude') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth - 32;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const data = this.history[param];
    if (!data || data.length < 2) return;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = (h / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Data line
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;

    const colors = {
      altitude: '#38bdf8',
      speed: '#818cf8',
      battery: '#34d399',
      heading: '#fbbf24',
    };

    ctx.strokeStyle = colors[param] || '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((val, i) => {
      const x = (i / (this.maxHistory - 1)) * w;
      const y = h - ((val - min) / range) * (h - 10) - 5;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill under curve
    const lastX = ((data.length - 1) / (this.maxHistory - 1)) * w;
    ctx.lineTo(lastX, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, (colors[param] || '#38bdf8') + '30');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fill();

    // Current value label
    const lastVal = data[data.length - 1];
    ctx.fillStyle = colors[param] || '#38bdf8';
    ctx.font = '600 11px "JetBrains Mono"';
    ctx.textAlign = 'right';
    ctx.fillText(`${lastVal.toFixed(1)}`, w - 5, 15);

    // Param label
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '500 9px "Inter"';
    ctx.textAlign = 'left';
    ctx.fillText(param.toUpperCase(), 5, 15);
  }
}
