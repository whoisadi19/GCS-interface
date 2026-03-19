/**
 * Command Center Module — UI for sending commands to the drone
 */

export class CommandCenter {
  constructor(telemetry, onLog) {
    this.telemetry = telemetry;
    this.log = onLog || (() => {});
    this._setupListeners();
  }

  _setupListeners() {
    // Arm
    document.getElementById('btn-arm')?.addEventListener('click', () => {
      if (confirm('Arm the vehicle? Ensure area is clear.')) {
        this.telemetry.setArmed(true);
        this.log('Vehicle ARMED', 'warning');
        this._updateArmUI(true);
      }
    });

    // Disarm
    document.getElementById('btn-disarm')?.addEventListener('click', () => {
      this.telemetry.setArmed(false);
      this.telemetry.stopMission();
      this.log('Vehicle DISARMED', 'success');
      this._updateArmUI(false);
    });

    // Set mode
    document.getElementById('btn-set-mode')?.addEventListener('click', () => {
      const mode = document.getElementById('flight-mode-select')?.value;
      if (mode) {
        this.telemetry.setMode(mode);
        this.log(`Mode changed to ${mode}`);
      }
    });

    // Takeoff
    document.getElementById('btn-takeoff')?.addEventListener('click', () => {
      if (!this.telemetry.data.armed) {
        this.log('Cannot takeoff — vehicle is DISARMED', 'error');
        return;
      }
      this.telemetry.setFSMState('TAKEOFF');
      this.telemetry.startMission();
      this.telemetry.setMode('GUIDED');
      this.log('TAKEOFF command sent — target altitude 2.5m', 'success');
      
      // Transition to SEARCH after delay
      setTimeout(() => {
        this.telemetry.setFSMState('SEARCH');
        this.telemetry.setMode('AUTO');
        this.log('FSM → SEARCH — beginning area coverage', 'system');
      }, 5000);
    });

    // Land
    document.getElementById('btn-land')?.addEventListener('click', () => {
      this.telemetry.setFSMState('LAND');
      this.telemetry.setMode('LAND');
      this.telemetry.stopMission();
      this.log('LAND command sent');
    });

    // RTB
    document.getElementById('btn-rtb')?.addEventListener('click', () => {
      this.telemetry.setFSMState('RETURN');
      this.telemetry.setMode('RTL');
      this.log('Return-To-Base commanded', 'warning');
    });

    // Sortie management
    document.getElementById('btn-start-sortie')?.addEventListener('click', () => {
      if (!this.telemetry.data.armed) {
        this.log('Cannot start sortie — vehicle is DISARMED', 'error');
        return;
      }
      this.telemetry.setFSMState('READY');
      this.log(`Sortie #${this.telemetry.data.sortie} started`, 'success');
      document.getElementById('cmd-sortie-status').textContent = 'ACTIVE';
      document.getElementById('cmd-sortie-status').style.color = '#34d399';
      
      // Auto-start takeoff sequence
      setTimeout(() => {
        this.telemetry.setFSMState('TAKEOFF');
        this.telemetry.startMission();
        this.log('Auto-takeoff sequence initiated', 'system');
      }, 2000);
    });

    document.getElementById('btn-end-sortie')?.addEventListener('click', () => {
      this.telemetry.setFSMState('RETURN');
      this.telemetry.setMode('RTL');
      this.log(`Sortie #${this.telemetry.data.sortie} ending — returning to dock`, 'warning');
      document.getElementById('cmd-sortie-status').textContent = 'RETURNING';
      document.getElementById('cmd-sortie-status').style.color = '#fbbf24';

      // Simulate landing and docking sequence
      setTimeout(() => {
        this.telemetry.setFSMState('LAND');
        this.log('Landing initiated');
        setTimeout(() => {
          this.telemetry.setFSMState('DOCK');
          this.telemetry.stopMission();
          this.log('Docked — data transfer in progress', 'success');
          setTimeout(() => {
            this.telemetry.setFSMState('RECHARGE');
            this.telemetry.data.sortie++;
            document.getElementById('cmd-sortie-num').textContent = `Sortie #${this.telemetry.data.sortie}`;
            document.getElementById('cmd-sortie-status').textContent = 'RECHARGING';
            document.getElementById('cmd-sortie-status').style.color = '#38bdf8';
            document.getElementById('recharge-status').querySelector('.recharge-text').textContent = 'Charging... 78%';
            this.log(`Recharging — next sortie: #${this.telemetry.data.sortie}`, 'system');
          }, 3000);
        }, 4000);
      }, 5000);
    });

    // Emergency controls
    document.getElementById('btn-emergency-land')?.addEventListener('click', () => {
      if (confirm('⚠️ EMERGENCY LAND — Drone will descend immediately. Confirm?')) {
        this.telemetry.setMode('LAND');
        this.telemetry.setFSMState('LAND');
        this.telemetry.stopMission();
        this.log('🚨 EMERGENCY LAND activated', 'error');
      }
    });

    document.getElementById('btn-kill-switch')?.addEventListener('click', () => {
      if (confirm('💀 KILL SWITCH — This will cut all motors immediately! Drone WILL crash. Confirm?')) {
        this.telemetry.setArmed(false);
        this.telemetry.stopMission();
        this.telemetry.setFSMState('INIT');
        this.log('💀 KILL SWITCH activated — motors killed', 'error');
        this._updateArmUI(false);
      }
    });

    document.getElementById('btn-abort')?.addEventListener('click', () => {
      this.telemetry.setFSMState('RETURN');
      this.telemetry.setMode('RTL');
      this.log('✋ MISSION ABORTED — returning to base', 'error');
    });

    // Clear log
    document.getElementById('btn-clear-log')?.addEventListener('click', () => {
      const logEl = document.getElementById('command-log');
      if (logEl) logEl.innerHTML = '<div class="log-entry system">Log cleared</div>';
    });
  }

  _updateArmUI(armed) {
    const armBtn = document.getElementById('btn-arm');
    const disarmBtn = document.getElementById('btn-disarm');
    if (armBtn) armBtn.style.opacity = armed ? '0.5' : '1';
    if (disarmBtn) disarmBtn.style.opacity = armed ? '1' : '0.5';
  }

  /**
   * Add entry to command log
   */
  static addLog(message, type = '') {
    const logEl = document.getElementById('command-log');
    if (!logEl) return;

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="log-time">[${time}]</span> ${message}`;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;

    // Keep max 100 entries
    while (logEl.children.length > 100) {
      logEl.removeChild(logEl.firstChild);
    }
  }
}
