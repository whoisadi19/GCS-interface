/**
 * Seed Image Manager — Upload, manage, and match seed images
 */

export class SeedImageManager {
  constructor(detectionViewer) {
    this.seeds = [];
    this.detectionViewer = detectionViewer;
    this._nextId = 1;
    this._matchTimer = null;

    this._setupListeners();
    this._startMatchSimulation();
  }

  _setupListeners() {
    const zone = document.getElementById('upload-zone');
    const input = document.getElementById('seed-file-input');

    if (zone && input) {
      // Click to upload
      zone.addEventListener('click', () => input.click());

      // File selected
      input.addEventListener('change', (e) => {
        this._handleFiles(e.target.files);
        input.value = '';
      });

      // Drag and drop
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
      });
      zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-over');
      });
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        this._handleFiles(e.dataTransfer.files);
      });
    }

    // Clear all
    document.getElementById('btn-clear-seeds')?.addEventListener('click', () => {
      this.seeds = [];
      this._renderGallery();
      this._renderMatching();
    });
  }

  _handleFiles(files) {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        this.seeds.push({
          id: this._nextId++,
          name: file.name,
          dataUrl: e.target.result,
          status: 'pending', // pending, matched, unmatched
          matchScore: null,
          matchedDetection: null,
        });
        this._renderGallery();
        this._renderMatching();
      };
      reader.readAsDataURL(file);
    });
  }

  _renderGallery() {
    const gallery = document.getElementById('seed-gallery');
    if (!gallery) return;

    if (this.seeds.length === 0) {
      gallery.innerHTML = '<div class="match-placeholder" style="grid-column:1/-1;">No seed images uploaded yet.</div>';
      return;
    }

    gallery.innerHTML = this.seeds.map(seed => `
      <div class="seed-card" data-id="${seed.id}">
        <img src="${seed.dataUrl}" alt="${seed.name}" />
        <div class="seed-card-footer">
          <span class="seed-status ${seed.status}">${seed.status.toUpperCase()}</span>
          <button class="seed-delete" data-id="${seed.id}" title="Remove">✕</button>
        </div>
      </div>
    `).join('');

    // Delete buttons
    gallery.querySelectorAll('.seed-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        this.seeds = this.seeds.filter(s => s.id !== id);
        this._renderGallery();
        this._renderMatching();
      });
    });
  }

  _renderMatching() {
    const panel = document.getElementById('matching-panel');
    if (!panel) return;

    if (this.seeds.length === 0) {
      panel.innerHTML = '<div class="match-placeholder">Upload seed images and wait for detections to see matches.</div>';
      return;
    }

    const detections = this.detectionViewer ? this.detectionViewer.getDetections() : [];

    panel.innerHTML = this.seeds.map(seed => {
      const matchDet = seed.matchedDetection;
      const scoreColor = seed.matchScore > 70 ? '#34d399' : (seed.matchScore > 40 ? '#fbbf24' : '#f87171');

      if (seed.status === 'matched' && matchDet) {
        return `
          <div class="match-card">
            <div class="match-images">
              <img class="match-img" src="${seed.dataUrl}" alt="Seed" />
              <span class="match-arrow">⟷</span>
              <div class="match-img" style="background:${matchDet.color}15;display:flex;align-items:center;justify-content:center;color:${matchDet.color};font-size:1.5rem;border:1px solid ${matchDet.color}40;">🎯</div>
            </div>
            <div class="match-info">
              <div><strong>${seed.name}</strong> → ${matchDet.className}</div>
              <div style="color:var(--text-muted);font-size:0.75rem;">
                Pos: (${matchDet.x}, ${matchDet.y}, ${matchDet.z})
              </div>
              <div class="match-score" style="color:${scoreColor}">${seed.matchScore}% match</div>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="match-card" style="opacity:0.6;">
            <div class="match-images">
              <img class="match-img" src="${seed.dataUrl}" alt="Seed" />
              <span class="match-arrow" style="opacity:0.3;">⟷</span>
              <div class="match-img" style="background:var(--bg-base);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.8rem;">?</div>
            </div>
            <div class="match-info">
              <div><strong>${seed.name}</strong></div>
              <div style="color:var(--text-muted);font-size:0.75rem;">
                ${seed.status === 'pending' ? 'Waiting for detection match...' : 'No match found'}
              </div>
            </div>
          </div>
        `;
      }
    }).join('');
  }

  _startMatchSimulation() {
    // Periodically try to "match" seed images against detections
    this._matchTimer = setInterval(() => {
      if (this.seeds.length === 0) return;
      if (!this.detectionViewer) return;

      const detections = this.detectionViewer.getDetections();
      if (detections.length === 0) return;

      // Randomly match an unmatched seed
      const pending = this.seeds.filter(s => s.status === 'pending');
      if (pending.length > 0 && Math.random() > 0.5) {
        const seed = pending[Math.floor(Math.random() * pending.length)];
        const det = detections[Math.floor(Math.random() * Math.min(5, detections.length))];
        
        seed.status = 'matched';
        seed.matchScore = Math.round(55 + Math.random() * 43);
        seed.matchedDetection = det;
        
        this._renderGallery();
        this._renderMatching();
      }
    }, 8000);
  }

  destroy() {
    if (this._matchTimer) clearInterval(this._matchTimer);
  }
}
