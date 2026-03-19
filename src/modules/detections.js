/**
 * Detection Viewer Module — KINETIC Design
 */

export class DetectionViewer {
  constructor() {
    this.detections = [];
    this.confThreshold = 50;
    this._nextId = 1;
    this._simTimer = null;
    this._classes = ['Feature-A', 'Feature-B', 'Feature-C', 'Rock', 'Marker', 'Target-1'];
    this._colors = ['#44d8f1', '#818cf8', '#67e100', '#fbbf24', '#f87171', '#fd6c00'];

    this._setupListeners();
    this._startSimulation();
  }

  _setupListeners() {
    const slider = document.getElementById('conf-threshold');
    const label = document.getElementById('conf-value');
    if (slider && label) {
      slider.addEventListener('input', (e) => {
        this.confThreshold = parseInt(e.target.value);
        label.textContent = `${this.confThreshold}%`;
        this._renderCards();
      });
    }
  }

  _startSimulation() {
    this._drawFeed();
    this._simTimer = setInterval(() => {
      if (Math.random() > 0.4) this._addSimDetection();
      this._drawFeed();
    }, 3000);
  }

  _addSimDetection() {
    const classIdx = Math.floor(Math.random() * this._classes.length);
    const det = {
      id: this._nextId++,
      className: this._classes[classIdx],
      confidence: Math.round(40 + Math.random() * 58),
      x: (Math.random() * 8 - 4).toFixed(2),
      y: (Math.random() * 8 - 4).toFixed(2),
      z: (Math.random() * 0.5 + 2).toFixed(2),
      timestamp: new Date(),
      bbox: { x: Math.random() * 600 + 80, y: Math.random() * 350 + 60, w: Math.random() * 80 + 50, h: Math.random() * 60 + 40 },
      color: this._colors[classIdx],
    };
    this.detections.unshift(det);
    if (this.detections.length > 50) this.detections.pop();
    this._renderCards();
    this._updateCount();
  }

  _drawFeed() {
    const canvas = document.getElementById('detection-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;

    ctx.fillStyle = '#0d0f0f';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(60, 73, 76, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    // Features
    const t = Date.now() / 1000;
    for (let i = 0; i < 4; i++) {
      const fx = 100 + Math.sin(t * 0.2 + i * 2) * 250 + i * 120;
      const fy = 120 + Math.cos(t * 0.3 + i * 1.5) * 120 + i * 60;
      ctx.fillStyle = `rgba(${80 + i * 30}, ${60 + i * 20}, ${50 + i * 40}, 0.25)`;
      ctx.beginPath();
      if (i % 3 === 0) ctx.arc(fx, fy, 15 + i * 3, 0, Math.PI * 2);
      else if (i % 3 === 1) ctx.rect(fx - 12, fy - 12, 24 + i * 4, 24 + i * 4);
      else { ctx.moveTo(fx, fy - 15); ctx.lineTo(fx + 18, fy + 12); ctx.lineTo(fx - 18, fy + 12); ctx.closePath(); }
      ctx.fill();
    }

    // Bounding boxes
    const visible = this.detections.filter(d => d.confidence >= this.confThreshold);
    visible.slice(0, 8).forEach(det => {
      const b = det.bbox;
      ctx.strokeStyle = det.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.setLineDash([]);

      // Corners
      const cl = 8;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(b.x, b.y + cl); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x + cl, b.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b.x + b.w - cl, b.y); ctx.lineTo(b.x + b.w, b.y); ctx.lineTo(b.x + b.w, b.y + cl); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b.x, b.y + b.h - cl); ctx.lineTo(b.x, b.y + b.h); ctx.lineTo(b.x + cl, b.y + b.h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b.x + b.w - cl, b.y + b.h); ctx.lineTo(b.x + b.w, b.y + b.h); ctx.lineTo(b.x + b.w, b.y + b.h - cl); ctx.stroke();

      // Label
      const label = `${det.className} ${det.confidence}%`;
      ctx.font = '600 10px "Roboto Mono"';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(13, 15, 15, 0.8)';
      ctx.fillRect(b.x, b.y - 18, tw + 10, 16);
      ctx.fillStyle = det.color;
      ctx.fillText(label, b.x + 5, b.y - 6);
    });

    // Camera info
    ctx.fillStyle = 'rgba(187, 201, 204, 0.3)';
    ctx.font = '500 9px "Roboto Mono"';
    ctx.textAlign = 'left';
    ctx.fillText('CAM: RealSense D435i | 640×480 @ 30fps', 10, h - 10);
    ctx.textAlign = 'right';
    ctx.fillText(new Date().toLocaleTimeString(), w - 10, h - 10);

    // REC
    if (Math.floor(Date.now() / 1000) % 2 === 0) {
      ctx.fillStyle = '#f87171';
      ctx.beginPath(); ctx.arc(w - 15, 15, 4, 0, Math.PI * 2); ctx.fill();
      ctx.font = '600 9px "Roboto Mono"';
      ctx.textAlign = 'right';
      ctx.fillText('REC', w - 24, 18);
    }
  }

  _renderCards() {
    const container = document.getElementById('detection-cards');
    if (!container) return;
    const visible = this.detections.filter(d => d.confidence >= this.confThreshold);

    container.innerHTML = visible.slice(0, 20).map(det => {
      const confBg = det.confidence >= 80 ? 'bg-tertiary/15 text-tertiary' : (det.confidence >= 60 ? 'bg-secondary/15 text-secondary' : 'bg-error/15 text-error');
      const time = det.timestamp.toLocaleTimeString();
      return `
        <div class="bg-surface-container border-l-2 p-3 slide-in cursor-pointer hover:bg-surface-container-high transition-all" style="border-color:${det.color}">
          <div class="flex justify-between items-center mb-2">
            <span class="font-headline text-xs font-bold uppercase" style="color:${det.color}">${det.className}</span>
            <span class="mono-data text-[10px] font-bold px-2 py-0.5 ${confBg}">${det.confidence}%</span>
          </div>
          <div class="mono-data text-[10px] text-on-surface-variant leading-relaxed">
            X: <span class="text-on-surface">${det.x}m</span> Y: <span class="text-on-surface">${det.y}m</span> Z: <span class="text-on-surface">${det.z}m</span><br/>
            <span class="text-on-surface-variant/60">${time}</span>
          </div>
        </div>`;
    }).join('');
  }

  _updateCount() {
    const el = document.getElementById('detection-count');
    const visible = this.detections.filter(d => d.confidence >= this.confThreshold);
    if (el) el.textContent = `${visible.length} detections`;
  }

  getDetections() { return this.detections; }
  destroy() { if (this._simTimer) clearInterval(this._simTimer); }
}
