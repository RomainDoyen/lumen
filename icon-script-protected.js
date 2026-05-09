/**
 * Générateur d'icônes — PNG multi-tailles à partir d'une image source.
 */
class IconGenerator {
  constructor() {
    this.file = null;
    this.initializeElements();
    this.setupEventListeners();
  }

  initializeElements() {
    this.dropZone = document.getElementById('dropZone');
    this.fileInput = document.getElementById('fileInput');
    this.browseLink = document.getElementById('browseLink');
    this.uploadSection = document.querySelector('.upload-section');
    this.sourceSection = document.getElementById('sourceSection');
    this.sourcePreview = document.getElementById('sourcePreview');
    this.processBtn = document.getElementById('processBtn');
    this.refreshBtn = document.getElementById('refreshBtn');
    this.generationSection = document.getElementById('generationSection');
    this.iconGrid = document.getElementById('iconGrid');
    this.loadingOverlay = document.getElementById('loadingOverlay');
    this.notification = document.getElementById('notification');
    this.notificationIcon = document.getElementById('notificationIcon');
    this.notificationText = document.getElementById('notificationText');
  }

  setupEventListeners() {
    if (!this.dropZone || !this.fileInput) return;

    this.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropZone.classList.add('drag-over');
    });
    this.dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      this.dropZone.classList.remove('drag-over');
    });
    this.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropZone.classList.remove('drag-over');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) this.addFile(f);
    });

    this.dropZone.addEventListener('click', () => this.fileInput.click());

    if (this.browseLink) {
      this.browseLink.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.fileInput.click();
      });
    }

    this.fileInput.addEventListener('change', () => {
      const f = this.fileInput.files && this.fileInput.files[0];
      if (f) this.addFile(f);
    });

    if (this.processBtn) {
      this.processBtn.addEventListener('click', () => this.generateIcons());
    }
    if (this.refreshBtn) {
      this.refreshBtn.addEventListener('click', () => this.reset());
    }
  }

  isAcceptedFile(file) {
    const types = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (types.includes(file.type)) return true;
    return /\.(png|jpe?g|svg)$/i.test(file.name);
  }

  addFile(file) {
    if (!this.isAcceptedFile(file)) {
      this.showNotification('❌', `Format non supporté : ${file.name}`);
      return;
    }
    this.file = file;
    this.renderSourcePreview();
    if (this.uploadSection) this.uploadSection.style.display = 'none';
    if (this.sourceSection) this.sourceSection.style.display = 'block';
    if (this.generationSection) this.generationSection.style.display = 'none';
    if (this.iconGrid) this.iconGrid.innerHTML = '';
    this.showNotification('✅', 'Image chargée');
  }

  renderSourcePreview() {
    const url = URL.createObjectURL(this.file);
    this.sourcePreview.innerHTML = `
      <div class="source-preview-container">
        <img src="${url}" alt="" class="source-preview-image">
        <div class="source-preview-info">
          <div class="source-filename">${this.escapeHtml(this.file.name)}</div>
          <div class="source-size">${this.formatFileSize(this.file.size)}</div>
        </div>
      </div>`;
    const img = this.sourcePreview.querySelector('img');
    if (img) {
      img.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
      img.addEventListener('error', () => URL.revokeObjectURL(url), { once: true });
    }
  }

  escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  reset() {
    this.file = null;
    if (this.fileInput) this.fileInput.value = '';
    if (this.uploadSection) this.uploadSection.style.display = '';
    if (this.sourceSection) this.sourceSection.style.display = 'none';
    if (this.generationSection) this.generationSection.style.display = 'none';
    if (this.iconGrid) this.iconGrid.innerHTML = '';
    if (this.sourcePreview) this.sourcePreview.innerHTML = '';
    this.showNotification('🔄', 'Réinitialisé');
  }

  async generateIcons() {
    if (!this.file) {
      this.showNotification('⚠️', 'Aucune image');
      return;
    }
    this.showLoading(true);
    try {
      const sizes = [16, 32, 48, 64, 128, 256, 512];
      const blobs = [];
      for (const size of sizes) {
        const blob = await this.renderToPngBlob(size);
        blobs.push({ size, blob });
      }

      this.iconGrid.innerHTML = '';

      blobs.forEach(({ size, blob }) => {
        const url = URL.createObjectURL(blob);
        const item = document.createElement('div');
        item.className = 'icon-item';
        item.innerHTML = `
          <div class="icon-preview"><img src="${url}" alt="${size}px" class="icon-preview-image" width="64" height="64"></div>
          <div class="icon-info">
            <div class="icon-name">${size}×${size} px</div>
            <div class="icon-size">${this.formatFileSize(blob.size)}</div>
          </div>
          <button type="button" class="icon-download-btn">Télécharger PNG</button>`;
        item.querySelector('button').addEventListener('click', () => {
          this.downloadBlob(blob, `icon-${size}.png`);
          this.showNotification('📥', `icon-${size}.png`);
        });
        const elImg = item.querySelector('img');
        elImg.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
        this.iconGrid.appendChild(item);
      });

      const zipSection = document.createElement('div');
      zipSection.className = 'icon-zip-section';
      const zipBtn = document.createElement('button');
      zipBtn.type = 'button';
      zipBtn.className = 'download-zip-btn';
      zipBtn.innerHTML =
        '<span class="btn-icon ui-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg></span> Télécharger tout (ZIP)';
      zipBtn.addEventListener('click', () => this.downloadZip(blobs));
      zipSection.appendChild(zipBtn);
      this.iconGrid.appendChild(zipSection);

      if (this.generationSection) this.generationSection.style.display = 'block';
      this.showNotification('🎉', `${blobs.length} icônes PNG prêtes`);
    } catch (err) {
      console.error(err);
      this.showNotification('❌', 'Erreur lors de la génération');
    } finally {
      this.showLoading(false);
    }
  }

  renderToPngBlob(targetSize) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(this.file);
      img.onload = () => {
        try {
          URL.revokeObjectURL(url);
          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d');
          const sw = img.naturalWidth || img.width;
          const sh = img.naturalHeight || img.height;
          const scale = Math.max(targetSize / sw, targetSize / sh);
          const dw = sw * scale;
          const dh = sh * scale;
          const ox = (targetSize - dw) / 2;
          const oy = (targetSize - dh) / 2;
          ctx.clearRect(0, 0, targetSize, targetSize);
          if (this.file.type === 'image/jpeg' || this.file.type === 'image/jpg') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, targetSize, targetSize);
          }
          ctx.drawImage(img, ox, oy, dw, dh);
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png');
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image load failed'));
      };
      img.src = url;
    });
  }

  async downloadZip(blobs) {
    if (typeof JSZip === 'undefined') {
      this.showNotification('❌', 'JSZip indisponible');
      return;
    }
    this.showLoading(true);
    try {
      const zip = new JSZip();
      blobs.forEach(({ size, blob }) => zip.file(`icon-${size}.png`, blob));
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      this.downloadBlob(blob, `lumen-icons-${stamp}.zip`);
      this.showNotification('📦', 'Archive ZIP téléchargée');
    } catch (e) {
      console.error(e);
      this.showNotification('❌', 'Erreur ZIP');
    } finally {
      this.showLoading(false);
    }
  }

  downloadBlob(blob, filename) {
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(u);
  }

  showLoading(show) {
    if (this.loadingOverlay) this.loadingOverlay.style.display = show ? 'flex' : 'none';
  }

  showNotification(icon, text) {
    if (!this.notification) return;
    this.notificationIcon.textContent = icon;
    this.notificationText.textContent = text;
    this.notification.style.display = 'flex';
    clearTimeout(this._notifyTimer);
    this._notifyTimer = setTimeout(() => {
      this.notification.style.display = 'none';
    }, 3000);
  }

  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / 1024 ** i).toFixed(1))} ${['B', 'KB', 'MB', 'GB'][i]}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.iconGenerator = new IconGenerator();
});
