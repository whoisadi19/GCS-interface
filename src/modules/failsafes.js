import { CommandCenter } from './commands.js';

export class FailsafeSystem {
  constructor(telemetry, commands) {
    this.telemetry = telemetry;
    this.commands = commands;

    this.thresholds = {
      batteryRTL: 20,
      batteryLand: 10,
      altCeiling: 120, // meters
    };

    this.triggered = {
      batteryRTL: false,
      batteryLand: false,
      altCeiling: false,
      linkLoss: false,
    };
  }

  tick() {
    const d = this.telemetry.data;
    const isLive = this.telemetry.mode === 'live';
    
    // 1. Check Link Quality Timeout (Only matters if we're actually connected)
    if (isLive && this.commands.rosbridge?.connected) {
      if (d.link <= 10) {
        if (!this.triggered.linkLoss) {
          this.triggered.linkLoss = true;
          this._triggerAlarm('Link Quality Critical — Telemetry Link Dropping');
        }
      } else {
        if (this.triggered.linkLoss) {
          this.triggered.linkLoss = false;
          this._hideAlarm();
          CommandCenter.addLog('Link re-established', 'success');
        }
      }
    }

    // 2. Battery LAND
    if (d.battery <= this.thresholds.batteryLand && !this.triggered.batteryLand) {
      this.triggered.batteryLand = true;
      this._triggerAlarm(`CRITICAL BATTERY (${d.battery.toFixed(0)}%) — Emergency Landing`);
      CommandCenter.addLog(`Failsafe: Auto-Land (Battery ${d.battery.toFixed(0)}%)`, 'error');
      this._forceLand();
    }
    
    // 3. Battery RTL
    else if (d.battery <= this.thresholds.batteryRTL && !this.triggered.batteryRTL && !this.triggered.batteryLand) {
      this.triggered.batteryRTL = true;
      this._triggerAlarm(`LOW BATTERY (${d.battery.toFixed(0)}%) — Auto RTB Commanded`);
      CommandCenter.addLog(`Failsafe: Auto-RTB (Battery ${d.battery.toFixed(0)}%)`, 'warning');
      this._forceRTL();
    }

    // 4. Altitude Ceiling RTL
    if (d.altitude > this.thresholds.altCeiling) {
      if (!this.triggered.altCeiling) {
        this.triggered.altCeiling = true;
        this._triggerAlarm(`ALTITUDE CEILING BREACH (${d.altitude.toFixed(0)}m) — Auto RTB Commanded`);
        CommandCenter.addLog(`Failsafe: Auto-RTB (Ceiling Breach ${d.altitude.toFixed(0)}m)`, 'error');
        this._forceRTL();
      }
    } else if (this.triggered.altCeiling && d.altitude < this.thresholds.altCeiling - 5) {
      // Reset altitude ceiling lock if we safely drop 5 meters below it
      this.triggered.altCeiling = false;
      if (!this.triggered.batteryLand && !this.triggered.batteryRTL && !this.triggered.linkLoss) {
        this._hideAlarm();
        CommandCenter.addLog('Failsafe cleared: Altitude normalized', 'success');
      }
    }
  }

  // Bypasses the confirm() Javascript popups by calling MAVROS services safely in the background
  _forceRTL() {
    if (this.commands._isLive()) {
        this.commands.rosbridge.callService('/mavros/set_mode', 'mavros_msgs/SetMode', { custom_mode: 'RTL' }, () => {});
    } else {
        this.telemetry.setFSMState('RETURN');
        this.telemetry.setMode('RTL');
    }
  }

  _forceLand() {
    if (this.commands._isLive()) {
        this.commands.rosbridge.callService('/mavros/set_mode', 'mavros_msgs/SetMode', { custom_mode: 'LAND' }, () => {});
    } else {
        this.telemetry.setMode('LAND');
        this.telemetry.setFSMState('LAND');
        this.telemetry.stopMission();
    }
  }

  _triggerAlarm(message) {
    const overlay = document.getElementById('failsafe-overlay');
    const msgEl = document.getElementById('failsafe-message');
    if (overlay && msgEl) {
      msgEl.textContent = message;
      overlay.classList.remove('hidden', 'opacity-0');
      overlay.classList.add('opacity-100');
    }
  }

  _hideAlarm() {
    const overlay = document.getElementById('failsafe-overlay');
    if (overlay) {
      overlay.classList.remove('opacity-100');
      overlay.classList.add('opacity-0');
      setTimeout(() => overlay.classList.add('hidden'), 300);
    }
  }
}
