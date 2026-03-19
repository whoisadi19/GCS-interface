/**
 * Detection Viewer Module — Simulated object detection display
 */

export class DetectionViewer {
  constructor() {
    this.detections = [];
    this.confThreshold = 50;
    this._nextId = 1;
    this._simTimer = null;
    this._classes = ['Feature-A', 'Feature-B', 'Feature-C', 'Rock', 'Marker', 'Target-1'];
    this._colors = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f87171', '#fb923c'];

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
    // Draw simulated camera feed
    this._drawFeed();
    
    // Add new detections periodically
    this._simTimer = setInterval(() => {
      if (Math.random() > 0.4) {
        this._addSimDetection();
      }
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
      bbox: {
        x: Math.random() * 400 + 60,
        y: Math.random() * 280 + 60,
        w: Math.random() * 80 + 50,
        h: Math.random() * 60 + 40,
      },
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

    // Simulated camera background (noise-like)
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    // Grid overlay (simulated arena)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Noise dots for texture
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    for (let i = 0; i < 200; i++) {
      const nx = Math.random() * w;
      const ny = Math.random() * h;
      ctx.fillRect(nx, ny, 2, 2);
    }

    // Draw some random "features" (shapes)
    const t = Date.now() / 1000;
    for (let i = 0; i < 4; i++) {
      const fx = 100 + Math.sin(t * 0.2 + i * 2) * 200 + i * 100;
      const fy = 120 + Math.cos(t * 0.3 + i * 1.5) * 100 + i * 50;
      
      ctx.fillStyle = `rgba(${100 + i * 30}, ${80 + i * 20}, ${60 + i * 40}, 0.3)`;
      ctx.beginPath();
      if (i % 3 === 0) {
        ctx.arc(fx, fy, 15 + i * 3, 0, Math.PI * 2);
      } else if (i % 3 === 1) {
        ctx.rect(fx - 12, fy - 12, 24 + i * 4, 24 + i * 4);
      } else {
        ctx.moveTo(fx, fy - 15);
        ctx.lineTo(fx + 18, fy + 12);
        ctx.lineTo(fx - 18, fy + 12);
        ctx.closePath();
      }
      ctx.fill();
    }

    // Draw detection bounding boxes
    const visible = this.detections.filter(d => d.confidence >= this.confThreshold);
    visible.slice(0, 8).forEach(det => {
      const b = det.bbox;
      
      // Bounding box
      ctx.strokeStyle = det.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.setLineDash([]);

      // Corners
      const cornerLen = 8;
      ctx.lineWidth = 3;
      ctx.strokeStyle = det.color;
      // Top-left
      ctx.beginPath(); ctx.moveTo(b.x, b.y + cornerLen); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x + cornerLen, b.y); ctx.stroke();
      // Top-right
      ctx.beginPath(); ctx.moveTo(b.x + b.w - cornerLen, b.y); ctx.lineTo(b.x + b.w, b.y); ctx.lineTo(b.x + b.w, b.y + cornerLen); ctx.stroke();
      // Bottom-left
      ctx.beginPath(); ctx.moveTo(b.x, b.y + b.h - cornerLen); ctx.lineTo(b.x, b.y + b.h); ctx.lineTo(b.x + cornerLen, b.y + b.h); ctx.stroke();
      // Bottom-right
      ctx.beginPath(); ctx.moveTo(b.x + b.w - cornerLen, b.y + b.h); ctx.lineTo(b.x + b.w, b.y + b.h); ctx.lineTo(b.x + b.w, b.y + b.h - cornerLen); ctx.stroke();

      // Label
      const label = `${det.className} ${det.confidence}%`;
      ctx.font = '600 11px "JetBrains Mono"';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = det.color + '30';
      ctx.fillRect(b.x, b.y - 20, tw + 10, 18);
      ctx.fillStyle = det.color;
      ctx.fillText(label, b.x + 5, b.y - 6);
    });

    // Camera info
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '500 10px "JetBrains Mono"';
    ctx.textAlign = 'left';
    ctx.fillText('CAM: RealSense D435i | 640×480 @ 30fps', 10, h - 10);

    ctx.textAlign = 'right';
    ctx.fillText(`${new Date().toLocaleTimeString()}`, w - 10, h - 10);

    // REC indicator
    if (Math.floor(Date.now() / 1000) % 2 === 0) {
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.arc(w - 15, 15, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f87171';
      ctx.font = '600 10px "JetBrains Mono"';
      ctx.textAlign = 'right';
      ctx.fillText('REC', w - 25, 19);
    }
  }

  _renderCards() {
    const container = document.getElementById('detection-cards');
    if (!container) return;

    const visible = this.detections.filter(d => d.confidence >= this.confThreshold);
    
    container.innerHTML = visible.slice(0, 20).map(det => {
      const confClass = det.confidence >= 80 ? 'high' : (det.confidence >= 60 ? 'medium' : 'low');
      const time = det.timestamp.toLocaleTimeString();
      
      return `
        <div class="detection-card" data-id="${det.id}">
          <div class="det-card-header">
            <span class="det-class" style="color:${det.color}">${det.className}</span>
            <span class="det-confidence ${confClass}">${det.confidence}%</span>
          </div>
          <div class="det-card-body">
            <div class="det-thumb">
              <div style="width:100%;height:100%;background:${det.color}15;display:flex;align-items:center;justify-content:center;color:${det.color};font-size:1.2rem;">🎯</div>
            </div>
            <div class="det-info">
              X: <span>${det.x}m</span> Y: <span>${det.y}m</span> Z: <span>${det.z}m</span><br/>
              Time: <span>${time}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  _updateCount() {
    const el = document.getElementById('detection-count');
    const visible = this.detections.filter(d => d.confidence >= this.confThreshold);
    if (el) el.textContent = `${visible.length} detections`;
  }

  getDetections() {
    return this.detections;
  }

  destroy() {
    if (this._simTimer) clearInterval(this._simTimer);
  }
}
