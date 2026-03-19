/**
 * HUD Renderer — Canvas-based Heads-Up Display
 * Draws: artificial horizon, pitch ladder, roll indicator, compass, 
 *        airspeed/altitude tapes, battery, GPS, link quality
 */

export class HUD {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.w = this.canvas.width;
    this.h = this.canvas.height;
    this.cx = this.w / 2;
    this.cy = this.h / 2;

    // State
    this.roll = 0;       // degrees
    this.pitch = 0;      // degrees
    this.heading = 0;    // 0-360
    this.altitude = 0;   // meters
    this.speed = 0;      // m/s
    this.battery = 100;
    this.gps_sats = 0;
    this.link = 100;
    this.mode = 'STABILIZE';
    this.armed = false;
    this.vspeed = 0;     // vertical speed m/s
  }

  update(data) {
    if (data.roll !== undefined) this.roll = data.roll;
    if (data.pitch !== undefined) this.pitch = data.pitch;
    if (data.heading !== undefined) this.heading = data.heading;
    if (data.altitude !== undefined) this.altitude = data.altitude;
    if (data.speed !== undefined) this.speed = data.speed;
    if (data.battery !== undefined) this.battery = data.battery;
    if (data.gps_sats !== undefined) this.gps_sats = data.gps_sats;
    if (data.link !== undefined) this.link = data.link;
    if (data.mode !== undefined) this.mode = data.mode;
    if (data.armed !== undefined) this.armed = data.armed;
    if (data.vspeed !== undefined) this.vspeed = data.vspeed;
  }

  render() {
    const ctx = this.ctx;
    const w = this.w, h = this.h, cx = this.cx, cy = this.cy;
    ctx.clearRect(0, 0, w, h);

    // Save and set up clipping
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();

    this._drawSkyGround(ctx, w, h, cx, cy);
    this._drawPitchLadder(ctx, cx, cy);
    this._drawRollIndicator(ctx, cx);
    this._drawCrosshair(ctx, cx, cy);
    this._drawAltitudeTape(ctx, w, h);
    this._drawSpeedTape(ctx, h);
    this._drawCompassTape(ctx, w, h);
    this._drawInfoBoxes(ctx, w, h);

    ctx.restore();
  }

  _drawSkyGround(ctx, w, h, cx, cy) {
    const pitchPx = this.pitch * 3; // 3px per degree
    const rollRad = this.roll * Math.PI / 180;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-rollRad);

    // Sky
    const skyGrad = ctx.createLinearGradient(0, -h, 0, pitchPx);
    skyGrad.addColorStop(0, '#0a1628');
    skyGrad.addColorStop(0.5, '#132040');
    skyGrad.addColorStop(1, '#1a3a5c');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-w, -h * 2, w * 2, h * 2 + pitchPx);

    // Ground
    const gndGrad = ctx.createLinearGradient(0, pitchPx, 0, h * 2);
    gndGrad.addColorStop(0, '#3d2817');
    gndGrad.addColorStop(0.3, '#2a1c10');
    gndGrad.addColorStop(1, '#1a1008');
    ctx.fillStyle = gndGrad;
    ctx.fillRect(-w, pitchPx, w * 2, h * 3);

    // Horizon line
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-w, pitchPx);
    ctx.lineTo(w, pitchPx);
    ctx.stroke();

    ctx.restore();
  }

  _drawPitchLadder(ctx, cx, cy) {
    const rollRad = this.roll * Math.PI / 180;
    const pitchPx = this.pitch * 3;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-rollRad);

    ctx.font = '600 10px "JetBrains Mono"';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;

    for (let deg = -40; deg <= 40; deg += 5) {
      if (deg === 0) continue;
      const y = pitchPx - deg * 3;
      const halfW = Math.abs(deg) % 10 === 0 ? 50 : 25;

      ctx.beginPath();
      ctx.moveTo(-halfW, y);
      ctx.lineTo(halfW, y);
      ctx.stroke();

      if (Math.abs(deg) % 10 === 0) {
        ctx.fillText(`${deg}`, -halfW - 18, y + 4);
        ctx.fillText(`${deg}`, halfW + 18, y + 4);
      }
    }
    ctx.restore();
  }

  _drawRollIndicator(ctx, cx) {
    const y = 30;
    const r = 70;

    ctx.save();
    ctx.translate(cx, y + r);

    // Arc
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI + 0.5, -0.5);
    ctx.stroke();

    // Tick marks at 0, ±10, ±20, ±30, ±45, ±60
    const marks = [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60];
    marks.forEach(deg => {
      const rad = (-90 + deg) * Math.PI / 180;
      const inner = deg % 30 === 0 ? r - 10 : r - 6;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(Math.cos(rad) * inner, Math.sin(rad) * inner);
      ctx.lineTo(Math.cos(rad) * r, Math.sin(rad) * r);
      ctx.stroke();
    });

    // Roll pointer (triangle)
    const rollRad = (-90 + this.roll) * Math.PI / 180;
    const px = Math.cos(rollRad) * (r + 8);
    const py = Math.sin(rollRad) * (r + 8);
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(px, py);
    const a1 = rollRad + 2.8;
    const a2 = rollRad - 2.8;
    ctx.lineTo(Math.cos(a1) * (r - 2), Math.sin(a1) * (r - 2));
    ctx.lineTo(Math.cos(a2) * (r - 2), Math.sin(a2) * (r - 2));
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  _drawCrosshair(ctx, cx, cy) {
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
    ctx.shadowBlur = 6;

    // Center dot
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();

    // Left wing
    ctx.beginPath();
    ctx.moveTo(cx - 60, cy);
    ctx.lineTo(cx - 25, cy);
    ctx.lineTo(cx - 25, cy + 8);
    ctx.stroke();

    // Right wing
    ctx.beginPath();
    ctx.moveTo(cx + 60, cy);
    ctx.lineTo(cx + 25, cy);
    ctx.lineTo(cx + 25, cy + 8);
    ctx.stroke();

    ctx.shadowBlur = 0;
  }

  _drawAltitudeTape(ctx, w, h) {
    const tapeW = 55;
    const tapeX = w - tapeW - 10;
    const tapeH = h - 80;
    const tapeY = 40;

    // Background
    ctx.fillStyle = 'rgba(10, 14, 23, 0.7)';
    ctx.fillRect(tapeX, tapeY, tapeW, tapeH);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(tapeX, tapeY, tapeW, tapeH);

    // Scale
    ctx.save();
    ctx.beginPath();
    ctx.rect(tapeX, tapeY, tapeW, tapeH);
    ctx.clip();

    const center = tapeY + tapeH / 2;
    const pxPerM = 8;
    ctx.font = '500 10px "JetBrains Mono"';
    ctx.textAlign = 'right';

    for (let alt = Math.floor(this.altitude) - 15; alt <= Math.ceil(this.altitude) + 15; alt++) {
      const y = center - (alt - this.altitude) * pxPerM;
      if (alt % 5 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(alt.toFixed(0), tapeX + tapeW - 5, y + 4);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.moveTo(tapeX, y);
        ctx.lineTo(tapeX + 10, y);
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.beginPath();
        ctx.moveTo(tapeX, y);
        ctx.lineTo(tapeX + 5, y);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Readout box
    ctx.fillStyle = 'rgba(10, 14, 23, 0.9)';
    ctx.fillRect(tapeX - 5, center - 14, tapeW + 10, 28);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tapeX - 5, center - 14, tapeW + 10, 28);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '700 14px "JetBrains Mono"';
    ctx.textAlign = 'center';
    ctx.fillText(this.altitude.toFixed(1), tapeX + tapeW / 2, center + 5);

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '500 9px "Inter"';
    ctx.fillText('ALT m', tapeX + tapeW / 2, tapeY - 4);

    // Vspeed arrow
    if (Math.abs(this.vspeed) > 0.1) {
      const arrowDir = this.vspeed > 0 ? -1 : 1;
      const arrowY = center + arrowDir * 20;
      ctx.fillStyle = this.vspeed > 0 ? '#34d399' : '#f87171';
      ctx.beginPath();
      ctx.moveTo(tapeX + tapeW + 8, arrowY);
      ctx.lineTo(tapeX + tapeW + 15, arrowY + arrowDir * 8);
      ctx.lineTo(tapeX + tapeW + 1, arrowY + arrowDir * 8);
      ctx.closePath();
      ctx.fill();
    }
  }

  _drawSpeedTape(ctx, h) {
    const tapeW = 55;
    const tapeX = 10;
    const tapeH = h - 80;
    const tapeY = 40;

    ctx.fillStyle = 'rgba(10, 14, 23, 0.7)';
    ctx.fillRect(tapeX, tapeY, tapeW, tapeH);
    ctx.strokeStyle = 'rgba(129, 140, 248, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(tapeX, tapeY, tapeW, tapeH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(tapeX, tapeY, tapeW, tapeH);
    ctx.clip();

    const center = tapeY + tapeH / 2;
    const pxPerMs = 15;
    ctx.font = '500 10px "JetBrains Mono"';
    ctx.textAlign = 'left';

    for (let spd = Math.max(0, Math.floor(this.speed) - 10); spd <= Math.ceil(this.speed) + 10; spd++) {
      const y = center - (spd - this.speed) * pxPerMs;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(spd.toFixed(0), tapeX + 14, y + 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.moveTo(tapeX + tapeW - 10, y);
      ctx.lineTo(tapeX + tapeW, y);
      ctx.stroke();
    }
    ctx.restore();

    // Readout
    ctx.fillStyle = 'rgba(10, 14, 23, 0.9)';
    ctx.fillRect(tapeX - 5, center - 14, tapeW + 10, 28);
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tapeX - 5, center - 14, tapeW + 10, 28);
    ctx.fillStyle = '#818cf8';
    ctx.font = '700 14px "JetBrains Mono"';
    ctx.textAlign = 'center';
    ctx.fillText(this.speed.toFixed(1), tapeX + tapeW / 2, center + 5);

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '500 9px "Inter"';
    ctx.fillText('SPD m/s', tapeX + tapeW / 2, tapeY - 4);
  }

  _drawCompassTape(ctx, w, h) {
    const tapeH = 28;
    const tapeY = h - tapeH - 4;
    const tapeW = 280;
    const tapeX = (w - tapeW) / 2;

    ctx.fillStyle = 'rgba(10, 14, 23, 0.7)';
    ctx.fillRect(tapeX, tapeY, tapeW, tapeH);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(tapeX, tapeY, tapeW, tapeH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(tapeX, tapeY, tapeW, tapeH);
    ctx.clip();

    const pxPerDeg = 3;
    const centerX = tapeX + tapeW / 2;
    const dirs = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };

    for (let offset = -60; offset <= 60; offset++) {
      let deg = ((this.heading + offset) % 360 + 360) % 360;
      const x = centerX + offset * pxPerDeg;

      if (deg % 10 === 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.moveTo(x, tapeY + tapeH);
        ctx.lineTo(x, tapeY + tapeH - 8);
        ctx.stroke();
      }

      if (dirs[Math.round(deg)] !== undefined) {
        ctx.fillStyle = Math.round(deg) === 0 ? '#f87171' : 'rgba(255,255,255,0.7)';
        ctx.font = '700 10px "JetBrains Mono"';
        ctx.textAlign = 'center';
        ctx.fillText(dirs[Math.round(deg)], x, tapeY + 14);
      } else if (deg % 30 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '500 9px "JetBrains Mono"';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(deg)}°`, x, tapeY + 14);
      }
    }
    ctx.restore();

    // Center pointer
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(centerX, tapeY);
    ctx.lineTo(centerX - 5, tapeY - 6);
    ctx.lineTo(centerX + 5, tapeY - 6);
    ctx.closePath();
    ctx.fill();

    // Heading readout
    ctx.fillStyle = '#38bdf8';
    ctx.font = '700 11px "JetBrains Mono"';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(this.heading)}°`, centerX, tapeY + 24);
  }

  _drawInfoBoxes(ctx, w, h) {
    // GPS info (top-right)
    ctx.fillStyle = 'rgba(10, 14, 23, 0.7)';
    ctx.fillRect(w - 70, 5, 65, 30);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.strokeRect(w - 70, 5, 65, 30);

    ctx.fillStyle = this.gps_sats >= 6 ? '#34d399' : (this.gps_sats >= 3 ? '#fbbf24' : '#f87171');
    ctx.font = '500 9px "Inter"';
    ctx.textAlign = 'center';
    ctx.fillText('GPS', w - 38, 16);
    ctx.font = '700 12px "JetBrains Mono"';
    ctx.fillText(`${this.gps_sats} ✦`, w - 38, 30);

    // Battery (top-left corner)
    const batX = 75, batY = 5;
    ctx.fillStyle = 'rgba(10, 14, 23, 0.7)';
    ctx.fillRect(batX, batY, 56, 30);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.strokeRect(batX, batY, 56, 30);

    ctx.fillStyle = this.battery > 30 ? '#34d399' : (this.battery > 15 ? '#fbbf24' : '#f87171');
    ctx.font = '500 9px "Inter"';
    ctx.textAlign = 'center';
    ctx.fillText('BAT', batX + 28, batY + 11);
    ctx.font = '700 12px "JetBrains Mono"';
    ctx.fillText(`${Math.round(this.battery)}%`, batX + 28, batY + 26);

    // Link quality
    const lnkX = batX + 60, lnkY = 5;
    ctx.fillStyle = 'rgba(10, 14, 23, 0.7)';
    ctx.fillRect(lnkX, lnkY, 56, 30);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.strokeRect(lnkX, lnkY, 56, 30);

    ctx.fillStyle = this.link > 70 ? '#60a5fa' : (this.link > 30 ? '#fbbf24' : '#f87171');
    ctx.font = '500 9px "Inter"';
    ctx.textAlign = 'center';
    ctx.fillText('LINK', lnkX + 28, lnkY + 11);
    ctx.font = '700 12px "JetBrains Mono"';
    ctx.fillText(`${Math.round(this.link)}%`, lnkX + 28, lnkY + 26);
  }
}
