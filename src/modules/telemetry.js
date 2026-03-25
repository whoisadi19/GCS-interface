/**
 * Telemetry Module — Simulates MAVLink telemetry data and updates KINETIC UI
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

    this.mode = 'simulated';

    this.history = {
      altitude: [],
      speed: [],
      battery: [],
      heading: [],
    };
    this.maxHistory = 200;

    this._simTime = 0;
    this._missionActive = false;
    this._fsmIndex = 0;
    this._fsmStates = ['INIT', 'READY', 'TAKEOFF', 'SEARCH', 'FEATURE_LOG', 'RETURN', 'LAND', 'DOCK', 'RECHARGE'];
  }

  tick(dt = 0.1) {
    if (this.mode === 'live') return;

    this._simTime += dt;
    const t = this._simTime;

    this.data.roll = Math.sin(t * 0.3) * 8 + Math.sin(t * 0.7) * 3;
    this.data.pitch = Math.sin(t * 0.2) * 5 + Math.cos(t * 0.5) * 2;
    this.data.heading = ((t * 5) % 360 + 360) % 360;

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

    if (this.data.gps_sats < 12) {
      this.data.gps_sats = Math.min(12, Math.floor(t * 0.5));
    }

    this.data.link = Math.max(70, 100 - Math.random() * 8);

    for (const key of ['altitude', 'speed', 'battery', 'heading']) {
      this.history[key].push(this.data[key]);
      if (this.history[key].length > this.maxHistory) this.history[key].shift();
    }
  }

  setArmed(armed) { this.data.armed = armed; }
  setMode(mode) { this.data.mode = mode; }
  setFSMState(state) {
    this.data.fsmState = state;
    this._fsmIndex = this._fsmStates.indexOf(state);
  }
  startMission() { this._missionActive = true; }
  stopMission() { this._missionActive = false; }

  applyLiveData(newData) {
    if (this.mode !== 'live') return;

    // Update data object with new values
    Object.assign(this.data, newData);

    // Push history (similar to tick)
    for (const key of ['altitude', 'speed', 'battery', 'heading']) {
      this.history[key].push(this.data[key]);
      if (this.history[key].length > this.maxHistory) {
      	this.history[key].shift();
      }
    }
  }

  updateUI() {
    const d = this.data;

    // Dashboard telemetry cards
    this._setText('telem-alt', d.altitude.toFixed(1));
    this._setText('telem-speed', d.speed.toFixed(1));
    this._setText('telem-heading', `${Math.round(d.heading)}°`);
    this._setText('telem-heading-dir', this._headingDir(d.heading));
    this._setText('telem-battery', Math.round(d.battery).toString());
    this._setText('telem-voltage', d.voltage.toFixed(1));
    this._setText('telem-current', d.current.toFixed(1));
    this._setText('telem-sats', d.gps_sats.toString());
    this._setText('telem-link', Math.round(d.link).toString());

    // Bars
    this._setBar('bar-alt', (d.altitude / 5) * 100);
    this._setBar('bar-speed', (d.speed / 2) * 100);
    this._setBar('bar-battery', d.battery);
    this._setBar('bar-link', d.link);

    // Battery color
    const batBar = document.getElementById('bar-battery');
    if (batBar) batBar.style.background = d.battery > 30 ? '#67e100' : (d.battery > 15 ? '#fbbf24' : '#f87171');

    // VIO status
    const vio = document.getElementById('telem-vio');
    if (vio) {
      if (d.armed && this._missionActive) {
        vio.innerHTML = '<span class="text-tertiary">TRACKING</span>';
      } else if (d.armed) {
        vio.innerHTML = '<span class="text-tertiary">ACTIVE</span>';
      } else {
        vio.innerHTML = '<span class="text-on-surface-variant">IDLE</span>';
      }
    }

    // Dashboard header
    this._setText('dash-mode', d.mode);
    this._setText('dash-bat', `${Math.round(d.battery)}% / ${d.voltage.toFixed(1)}V`);
    const dashArmed = document.getElementById('dash-armed-status');
    if (dashArmed) {
      dashArmed.innerHTML = d.armed
        ? '<span class="text-tertiary">ARMED</span>'
        : '<span class="text-error">DISARMED</span>';
    }

    // PFD elements
    this._setText('pfd-mode', d.mode);
    const pfdArmed = document.getElementById('pfd-armed');
    if (pfdArmed) {
      pfdArmed.innerHTML = d.armed
        ? '<span class="text-tertiary">ARMED</span>'
        : '<span class="text-error">DISARMED</span>';
    }
    this._setText('pfd-alt', `${d.altitude.toFixed(1)}m`);
    this._setText('pfd-speed', `${d.speed.toFixed(1)} m/s`);
    this._setText('pfd-heading', `${Math.round(d.heading)}° ${this._headingDir(d.heading)}`);
    this._setText('pfd-bat', `${Math.round(d.battery)}%`);

    // Battery ring on PFD
    const batRing = document.getElementById('pfd-bat-ring');
    if (batRing) {
      const circumference = 125.6;
      batRing.setAttribute('stroke-dashoffset', (circumference * (1 - d.battery / 100)).toString());
      batRing.style.color = d.battery > 30 ? '#67e100' : (d.battery > 15 ? '#fbbf24' : '#f87171');
    }
    const batLabel = document.getElementById('pfd-bat-label');
    if (batLabel) {
      batLabel.textContent = d.battery > 30 ? 'NOMINAL' : (d.battery > 15 ? 'LOW' : 'CRITICAL');
      batLabel.style.color = d.battery > 30 ? '#67e100' : (d.battery > 15 ? '#fbbf24' : '#f87171');
    }

    // Top bar badges
    this._setText('fsm-badge-top', d.fsmState);
    this._setText('sortie-badge-top', `Sortie #${d.sortie}`);

    // FSM timeline in sidebar
    this._updateFSMTimeline(d.fsmState);

    // Bottom status bar
    this._setText('status-gps', `GPS: ${d.gps_sats} Sats`);
    this._setText('status-bat-footer', `Battery ${Math.round(d.battery)}%`);
    this._setText('status-alt-footer', `Alt ${d.altitude.toFixed(1)}m`);
    this._setText('status-time', new Date().toLocaleTimeString());
  }

  _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
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
        el.className = 'fsm-state text-[8px] font-mono px-1.5 py-0.5 bg-primary/15 text-primary border border-primary/30';
        found = true;
      } else if (!found) {
        el.className = 'fsm-state text-[8px] font-mono px-1.5 py-0.5 bg-tertiary/10 text-tertiary';
      } else {
        el.className = 'fsm-state text-[8px] font-mono px-1.5 py-0.5 bg-surface-container text-on-surface-variant';
      }
    });
  }

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
    ctx.strokeStyle = 'rgba(60, 73, 76, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = (h / 5) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;

    const colors = { altitude: '#44d8f1', speed: '#67e100', battery: '#67e100', heading: '#ffb692' };
    const color = colors[param] || '#44d8f1';

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    data.forEach((val, i) => {
      const x = (i / (this.maxHistory - 1)) * w;
      const y = h - ((val - min) / range) * (h - 10) - 5;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill
    const lastX = ((data.length - 1) / (this.maxHistory - 1)) * w;
    ctx.lineTo(lastX, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + '20');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fill();

    // Value
    const lastVal = data[data.length - 1];
    ctx.fillStyle = color;
    ctx.font = '600 10px "Roboto Mono"';
    ctx.textAlign = 'right';
    ctx.fillText(`${lastVal.toFixed(1)}`, w - 4, 12);

    ctx.fillStyle = 'rgba(187, 201, 204, 0.4)';
    ctx.font = '500 9px "Space Grotesk"';
    ctx.textAlign = 'left';
    ctx.fillText(param.toUpperCase(), 4, 12);
  }
}
