/**
 * Command Center Module — KINETIC Design
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
      }
    });

    // Disarm
    document.getElementById('btn-disarm')?.addEventListener('click', () => {
      this.telemetry.setArmed(false);
      this.telemetry.stopMission();
      this.log('Vehicle DISARMED', 'success');
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
      this.log('TAKEOFF command sent — target alt 2.5m', 'success');
      setTimeout(() => {
        this.telemetry.setFSMState('SEARCH');
        this.telemetry.setMode('AUTO');
        this.log('FSM → SEARCH — area coverage started', 'system');
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

    // Start sortie
    document.getElementById('btn-start-sortie')?.addEventListener('click', () => {
      if (!this.telemetry.data.armed) {
        this.log('Cannot start sortie — DISARMED', 'error');
        return;
      }
      this.telemetry.setFSMState('READY');
      this.log(`Sortie #${this.telemetry.data.sortie} started`, 'success');
      const el = document.getElementById('cmd-sortie-status');
      if (el) { el.textContent = 'ACTIVE'; el.className = 'text-[9px] font-mono bg-tertiary/10 text-tertiary px-2 py-0.5'; }
      setTimeout(() => {
        this.telemetry.setFSMState('TAKEOFF');
        this.telemetry.startMission();
        this.log('Auto-takeoff initiated', 'system');
      }, 2000);
    });

    // End sortie
    document.getElementById('btn-end-sortie')?.addEventListener('click', () => {
      this.telemetry.setFSMState('RETURN');
      this.telemetry.setMode('RTL');
      this.log(`Sortie #${this.telemetry.data.sortie} ending — RTB`, 'warning');
      const el = document.getElementById('cmd-sortie-status');
      if (el) { el.textContent = 'RETURNING'; el.className = 'text-[9px] font-mono bg-secondary-container/10 text-secondary-container px-2 py-0.5'; }

      setTimeout(() => {
        this.telemetry.setFSMState('LAND');
        this.log('Landing initiated');
        setTimeout(() => {
          this.telemetry.setFSMState('DOCK');
          this.telemetry.stopMission();
          this.log('Docked — data transfer active', 'success');
          setTimeout(() => {
            this.telemetry.setFSMState('RECHARGE');
            this.telemetry.data.sortie++;
            this._setText('cmd-sortie-num', `Sortie #${this.telemetry.data.sortie}`);
            const s = document.getElementById('cmd-sortie-status');
            if (s) { s.textContent = 'RECHARGING'; s.className = 'text-[9px] font-mono bg-primary/10 text-primary px-2 py-0.5'; }
            const rt = document.getElementById('recharge-text');
            if (rt) rt.textContent = 'Charging... 78%';
            this.log(`Recharging — next: #${this.telemetry.data.sortie}`, 'system');
          }, 3000);
        }, 4000);
      }, 5000);
    });

    // Emergency
    document.getElementById('btn-emergency-land')?.addEventListener('click', () => {
      if (confirm('⚠️ EMERGENCY LAND — Immediate descent. Confirm?')) {
        this.telemetry.setMode('LAND');
        this.telemetry.setFSMState('LAND');
        this.telemetry.stopMission();
        this.log('🚨 EMERGENCY LAND activated', 'error');
      }
    });

    document.getElementById('btn-kill-switch')?.addEventListener('click', () => {
      if (confirm('💀 KILL SWITCH — All motors cut. Drone WILL crash. Confirm?')) {
        this.telemetry.setArmed(false);
        this.telemetry.stopMission();
        this.telemetry.setFSMState('INIT');
        this.log('💀 KILL SWITCH — motors killed', 'error');
      }
    });

    document.getElementById('btn-abort')?.addEventListener('click', () => {
      this.telemetry.setFSMState('RETURN');
      this.telemetry.setMode('RTL');
      this.log('✋ MISSION ABORTED — RTB', 'error');
    });

    // Clear log
    document.getElementById('btn-clear-log')?.addEventListener('click', () => {
      ['command-log', 'command-log-sidebar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
      });
      CommandCenter.addLog('Log cleared', 'system');
    });
  }

  _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  static addLog(message, type = '') {
    const time = new Date().toLocaleTimeString();
    const typeColors = {
      system: { border: 'border-primary', text: 'text-primary', bg: 'bg-primary/5', label: 'OK' },
      success: { border: 'border-tertiary', text: 'text-tertiary', bg: 'bg-tertiary/5', label: 'OK' },
      warning: { border: 'border-secondary-container', text: 'text-secondary-container', bg: 'bg-secondary-container/5', label: 'WARN' },
      error: { border: 'border-error', text: 'text-error', bg: 'bg-error/5', label: 'CRIT' },
      '': { border: 'border-transparent', text: 'text-on-surface-variant', bg: '', label: 'INFO' },
    };
    const tc = typeColors[type] || typeColors[''];

    const html = `
      <div class="flex p-1.5 ${tc.bg} border-l-2 ${tc.border}">
        <span class="${tc.text} whitespace-nowrap">[${time}]</span>
        <span class="text-on-surface uppercase truncate ml-2 flex-1">${message}</span>
        <span class="${tc.text} ml-2">${tc.label}</span>
      </div>
    `;

    // Write to both logs
    ['command-log', 'command-log-sidebar'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.insertAdjacentHTML('beforeend', html);
        el.scrollTop = el.scrollHeight;
        while (el.children.length > 100) el.removeChild(el.firstChild);
      }
    });
  }
}
