/**
 * Seed Image Manager — KINETIC Design
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
      zone.addEventListener('click', () => input.click());
      input.addEventListener('change', (e) => { this._handleFiles(e.target.files); input.value = ''; });
      zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', () => { zone.classList.remove('drag-over'); });
      zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('drag-over'); this._handleFiles(e.dataTransfer.files); });
    }

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
        this.seeds.push({ id: this._nextId++, name: file.name, dataUrl: e.target.result, status: 'pending', matchScore: null, matchedDetection: null });
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
      gallery.innerHTML = '<div class="col-span-2 text-[10px] text-on-surface-variant/50 text-center py-4">No seeds uploaded</div>';
      return;
    }

    gallery.innerHTML = this.seeds.map(seed => {
      const statusColors = { pending: 'bg-secondary-container/15 text-secondary-container', matched: 'bg-tertiary/15 text-tertiary', unmatched: 'bg-error/15 text-error' };
      const sc = statusColors[seed.status] || statusColors.pending;
      return `
        <div class="bg-surface-container border border-outline-variant/10 overflow-hidden scale-in group cursor-pointer hover:border-primary/30 transition-all" data-id="${seed.id}">
          <img src="${seed.dataUrl}" alt="${seed.name}" class="w-full aspect-square object-cover" />
          <div class="p-1.5 flex justify-between items-center">
            <span class="text-[8px] font-mono ${sc} px-1.5 py-0.5 uppercase">${seed.status}</span>
            <button class="seed-delete text-on-surface-variant/40 hover:text-error text-xs cursor-pointer" data-id="${seed.id}">✕</button>
          </div>
        </div>`;
    }).join('');

    gallery.querySelectorAll('.seed-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.seeds = this.seeds.filter(s => s.id !== parseInt(btn.dataset.id));
        this._renderGallery();
        this._renderMatching();
      });
    });
  }

  _renderMatching() {
    const panel = document.getElementById('matching-panel');
    if (!panel) return;
    if (this.seeds.length === 0) {
      panel.innerHTML = '<div class="text-center text-on-surface-variant/40 text-xs py-12">Upload seed images and wait for detections to see matches.</div>';
      return;
    }

    panel.innerHTML = this.seeds.map(seed => {
      const matchDet = seed.matchedDetection;
      if (seed.status === 'matched' && matchDet) {
        const scoreColor = seed.matchScore > 70 ? 'text-tertiary' : (seed.matchScore > 40 ? 'text-secondary' : 'text-error');
        return `
          <div class="bg-surface-container border-l-2 border-tertiary p-4 flex gap-4 items-center">
            <img src="${seed.dataUrl}" alt="Seed" class="w-20 h-14 object-cover border border-outline-variant/20" />
            <div class="text-primary text-lg">⟷</div>
            <div class="w-20 h-14 border border-outline-variant/20 flex items-center justify-center text-xl" style="background:${matchDet.color}10;color:${matchDet.color}">🎯</div>
            <div class="flex-1">
              <div class="font-headline text-xs font-bold text-on-surface uppercase">${seed.name} → ${matchDet.className}</div>
              <div class="mono-data text-[10px] text-on-surface-variant">Pos: (${matchDet.x}, ${matchDet.y}, ${matchDet.z})</div>
              <div class="mono-data text-lg font-black ${scoreColor}">${seed.matchScore}%</div>
            </div>
          </div>`;
      } else {
        return `
          <div class="bg-surface-container border-l-2 border-outline-variant/20 p-4 flex gap-4 items-center opacity-50">
            <img src="${seed.dataUrl}" alt="Seed" class="w-20 h-14 object-cover border border-outline-variant/20" />
            <div class="text-on-surface-variant/30 text-lg">⟷</div>
            <div class="w-20 h-14 border border-outline-variant/10 bg-surface-container-lowest flex items-center justify-center mono-data text-on-surface-variant/30 text-xs">?</div>
            <div class="flex-1">
              <div class="font-headline text-xs font-bold text-on-surface uppercase">${seed.name}</div>
              <div class="text-[10px] text-on-surface-variant">${seed.status === 'pending' ? 'Waiting for match...' : 'No match found'}</div>
            </div>
          </div>`;
      }
    }).join('');
  }

  _startMatchSimulation() {
    this._matchTimer = setInterval(() => {
      if (this.seeds.length === 0 || !this.detectionViewer) return;
      const detections = this.detectionViewer.getDetections();
      if (detections.length === 0) return;
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

  destroy() { if (this._matchTimer) clearInterval(this._matchTimer); }
}
