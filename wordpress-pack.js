/**
 * Pack WordPress — plusieurs images, tailles natives, WebP + JPEG, metadata.json, Gutenberg.
 */
const WP_SIZES = [
  { key: 'full', label: 'Original', max: null, crop: false },
  { key: 'large', label: 'Large', max: 1024, crop: false },
  { key: 'medium_large', label: 'Medium large', max: 768, crop: false },
  { key: 'medium', label: 'Medium', max: 300, crop: false },
  { key: 'thumbnail', label: 'Thumbnail', max: 150, crop: true },
];

const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.85;

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_VISION_MODEL = 'ministral-14b-latest';
const MISTRAL_THUMB_MAX = 1024;
const MISTRAL_STORAGE_KEY = 'lumen_mistral_api_key';

class MistralRateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MistralRateLimitError';
    this.isRateLimit = true;
  }
}

class WordPressPack {
  constructor() {
    this.items = [];
    this.packResult = null;
    this.activeItemId = null;
    this._itemIdSeq = 0;
    this._draftSaveTimer = null;
    this._restoringDraft = false;
    this.initializeElements();
    this.loadMistralApiKey();
    this.setupEventListeners();
    this.initDraftPersistence();
    this.updateSuggestButtonState();
  }

  initializeElements() {
    this.dropZone = document.getElementById('dropZone');
    this.fileInput = document.getElementById('fileInput');
    this.browseLink = document.getElementById('browseLink');
    this.uploadSection = document.querySelector('.upload-section');
    this.workflowSection = document.getElementById('workflowSection');
    this.imagesGrid = document.getElementById('imagesGrid');
    this.imagesCountLabel = document.getElementById('imagesCountLabel');
    this.metaItemsList = document.getElementById('metaItemsList');
    this.processBtn = document.getElementById('processBtn');
    this.refreshBtn = document.getElementById('refreshBtn');
    this.addMoreBtn = document.getElementById('addMoreBtn');
    this.resultsSection = document.getElementById('resultsSection');
    this.filesList = document.getElementById('filesList');
    this.downloadZipBtn = document.getElementById('downloadZipBtn');
    this.copyGutenbergBtn = document.getElementById('copyGutenbergBtn');
    this.copyJsonLdBtn = document.getElementById('copyJsonLdBtn');
    this.gutenbergPreview = document.getElementById('gutenbergPreview');
    this.jsonLdPreview = document.getElementById('jsonLdPreview');
    this.snippetItemSelect = document.getElementById('snippetItemSelect');
    this.loadingOverlay = document.getElementById('loadingOverlay');
    this.loadingText = document.querySelector('.loading-text');
    this.notification = document.getElementById('notification');
    this.notificationIcon = document.getElementById('notificationIcon');
    this.notificationText = document.getElementById('notificationText');
    this.fieldSiteUrl = document.getElementById('fieldSiteUrl');
    this.mistralApiKeyInput = document.getElementById('mistralApiKey');
    this.suggestMistralBtn = document.getElementById('suggestMistralBtn');
    this.toggleMistralKeyBtn = document.getElementById('toggleMistralKeyBtn');
    this.clearMistralKeyBtn = document.getElementById('clearMistralKeyBtn');
    this.mistralRateBanner = document.getElementById('mistralRateBanner');
  }

  setupEventListeners() {
    if (!this.dropZone || !this.fileInput) return;

    this.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropZone.classList.add('drag-over');
    });
    this.dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      this.dropZone.classList.remove('drag-over');
    });
    this.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropZone.classList.remove('drag-over');
      const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
      if (files.length) this.addFiles(files);
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
      const files = this.fileInput.files ? Array.from(this.fileInput.files) : [];
      if (files.length) this.addFiles(files);
      this.fileInput.value = '';
    });

    if (this.addMoreBtn) {
      this.addMoreBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.fileInput.click();
      });
    }

    if (this.processBtn) {
      this.processBtn.addEventListener('click', () => this.generatePack());
    }
    if (this.refreshBtn) {
      this.refreshBtn.addEventListener('click', () => this.reset());
    }
    if (this.downloadZipBtn) {
      this.downloadZipBtn.addEventListener('click', () => this.downloadZip());
    }
    if (this.copyGutenbergBtn) {
      this.copyGutenbergBtn.addEventListener('click', () => {
        const entry = this.getActivePackEntry();
        this.copyToClipboard(entry?.gutenbergHtml, 'Bloc Gutenberg copié');
      });
    }
    if (this.copyJsonLdBtn) {
      this.copyJsonLdBtn.addEventListener('click', () => {
        const entry = this.getActivePackEntry();
        this.copyToClipboard(
          entry ? JSON.stringify(entry.jsonLd, null, 2) : '',
          'JSON-LD copié'
        );
      });
    }
    if (this.snippetItemSelect) {
      this.snippetItemSelect.addEventListener('change', () => {
        this.activeItemId = this.snippetItemSelect.value;
        this.updateSnippetPreview();
      });
    }
    if (this.mistralApiKeyInput) {
      this.mistralApiKeyInput.addEventListener('input', () => {
        this.saveMistralApiKey();
        this.updateSuggestButtonState();
        this.hideMistralRateBanner();
      });
    }
    if (this.suggestMistralBtn) {
      this.suggestMistralBtn.addEventListener('click', () => this.suggestAllMetadataWithMistral());
    }
    if (this.toggleMistralKeyBtn && this.mistralApiKeyInput) {
      this.toggleMistralKeyBtn.addEventListener('click', () => {
        const show = this.mistralApiKeyInput.type === 'password';
        this.mistralApiKeyInput.type = show ? 'text' : 'password';
        this.toggleMistralKeyBtn.textContent = show ? 'Masquer' : 'Afficher';
        this.toggleMistralKeyBtn.setAttribute('aria-pressed', show ? 'true' : 'false');
      });
    }
    if (this.clearMistralKeyBtn) {
      this.clearMistralKeyBtn.addEventListener('click', () => {
        try {
          localStorage.removeItem(MISTRAL_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        if (this.mistralApiKeyInput) this.mistralApiKeyInput.value = '';
        this.updateSuggestButtonState();
        this.showNotification('🗑️', 'Clé Mistral effacée de ce navigateur');
      });
    }

    if (this.fieldSiteUrl) {
      this.fieldSiteUrl.addEventListener('input', () => this.scheduleDraftSave());
    }

    document.querySelectorAll('.rail-nav a, .nav-links a').forEach((link) => {
      link.addEventListener('click', (e) => {
        if (!this.items.length || link.classList.contains('rail-link--active') || link.classList.contains('active')) {
          return;
        }
        e.preventDefault();
        const href = link.getAttribute('href');
        this.flushDraftSave().finally(() => {
          window.location.href = href;
        });
      });
    });

    window.addEventListener('pagehide', () => this.flushDraftSave());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flushDraftSave();
    });
  }

  initDraftPersistence() {
    this.restoreDraftFromStorage();
  }

  scheduleDraftSave() {
    if (this._restoringDraft) return;
    clearTimeout(this._draftSaveTimer);
    this._draftSaveTimer = setTimeout(() => this.flushDraftSave(), 400);
  }

  async flushDraftSave() {
    clearTimeout(this._draftSaveTimer);
    if (this._restoringDraft) return;

    if (!window.WpPackDraftStore) return;

    if (!this.items.length) {
      try {
        await WpPackDraftStore.clear();
      } catch {
        /* ignore */
      }
      return;
    }

    try {
      const items = await Promise.all(
        this.items.map(async (item) => ({
          id: item.id,
          fileName: item.file.name,
          fileType: item.file.type || 'image/jpeg',
          fileSize: item.file.size,
          lastModified: item.file.lastModified,
          metadataSource: item.metadataSource,
          meta: { ...item.meta },
          buffer: await item.file.arrayBuffer(),
        }))
      );

      await WpPackDraftStore.save({
        version: 1,
        savedAt: new Date().toISOString(),
        siteUrl: this.getSiteUrl(),
        activeItemId: this.activeItemId,
        rateBannerMessage:
          this.mistralRateBanner && !this.mistralRateBanner.hidden
            ? this.mistralRateBanner.textContent
            : null,
        items,
      });
    } catch (err) {
      console.warn('Brouillon Pack WordPress non sauvegardé', err);
    }
  }

  async restoreDraftFromStorage() {
    if (!window.WpPackDraftStore) return;

    try {
      const draft = await WpPackDraftStore.load();
      if (!draft?.items?.length) return;

      this._restoringDraft = true;

      this.items.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });

      this.items = draft.items.map((row) => {
        const file = new File([row.buffer], row.fileName, {
          type: row.fileType || 'image/jpeg',
          lastModified: row.lastModified || Date.now(),
        });
        return {
          id: row.id,
          file,
          previewUrl: URL.createObjectURL(file),
          metadataSource: row.metadataSource || 'filename',
          meta: { ...row.meta },
        };
      });

      if (this.fieldSiteUrl && draft.siteUrl) {
        this.fieldSiteUrl.value = draft.siteUrl;
      }
      this.activeItemId =
        draft.activeItemId && this.items.some((i) => i.id === draft.activeItemId)
          ? draft.activeItemId
          : this.items[0]?.id;

      if (draft.rateBannerMessage && this.mistralRateBanner) {
        this.mistralRateBanner.textContent = draft.rateBannerMessage;
        this.mistralRateBanner.hidden = false;
      }

      this.packResult = null;
      if (this.uploadSection) this.uploadSection.style.display = 'none';
      if (this.workflowSection) this.workflowSection.style.display = 'block';
      if (this.resultsSection) this.resultsSection.style.display = 'none';

      this.renderWorkflow();
      this.updateSuggestButtonState();
      this.showNotification(
        '📂',
        `Brouillon restauré (${this.items.length} image${this.items.length > 1 ? 's' : ''})`,
        4500
      );
    } catch (err) {
      console.warn('Restauration du brouillon impossible', err);
    } finally {
      this._restoringDraft = false;
    }
  }

  clearDraftStorage() {
    if (!window.WpPackDraftStore) return Promise.resolve();
    return WpPackDraftStore.clear().catch(() => {});
  }

  nextItemId() {
    this._itemIdSeq += 1;
    return `wp-${Date.now()}-${this._itemIdSeq}`;
  }

  getSiteUrl() {
    return (this.fieldSiteUrl?.value || '').trim().replace(/\/$/, '');
  }

  createItemFromFile(file) {
    const base = file.name.replace(/\.[^.]+$/, '');
    const slug = this.ensureUniqueSlug(this.slugify(base));
    const human = this.humanizeFilename(base);
    return {
      id: this.nextItemId(),
      file,
      previewUrl: URL.createObjectURL(file),
      metadataSource: 'filename',
      meta: {
        slug,
        title: human,
        alt_text_seo: human,
        alt_text_wcag: human,
        alt_text_short: human.length > 80 ? `${human.slice(0, 77)}…` : human,
        caption: '',
        description: '',
      },
    };
  }

  ensureUniqueSlug(slug, excludeId = null) {
    const used = new Set(
      this.items.filter((i) => i.id !== excludeId).map((i) => i.meta.slug)
    );
    let candidate = slug || 'image';
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${slug}-${n}`;
      n += 1;
    }
    return candidate;
  }

  addFiles(files) {
    const accepted = [];
    files.forEach((file) => {
      if (this.isAcceptedFile(file)) {
        accepted.push(file);
      } else {
        this.showNotification('❌', `Format non supporté : ${file.name}`);
      }
    });
    if (!accepted.length) return;

    accepted.forEach((file) => {
      this.items.push(this.createItemFromFile(file));
    });

    if (!this.activeItemId && this.items.length) {
      this.activeItemId = this.items[0].id;
    }

    this.packResult = null;
    if (this.uploadSection) this.uploadSection.style.display = 'none';
    if (this.workflowSection) this.workflowSection.style.display = 'block';
    if (this.resultsSection) this.resultsSection.style.display = 'none';
    this.hideMistralRateBanner();
    this.renderWorkflow();
    this.updateSuggestButtonState();
    this.scheduleDraftSave();
    this.showNotification(
      '✅',
      `${accepted.length} image(s) ajoutée(s) — complétez les métadonnées`
    );
  }

  removeItem(id) {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const [removed] = this.items.splice(idx, 1);
    if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    if (this.activeItemId === id) {
      this.activeItemId = this.items[0]?.id || null;
    }
    if (!this.items.length) {
      this.reset();
      return;
    }
    this.packResult = null;
    this.renderWorkflow();
    this.updateSuggestButtonState();
    this.scheduleDraftSave();
  }

  setActiveItem(id) {
    this.activeItemId = id;
    this.renderImagesGrid();
    this.renderMetaCards();
    this.scheduleDraftSave();
  }

  renderWorkflow() {
    this.renderImagesGrid();
    this.renderMetaCards();
    this.updateImagesCountLabel();
    if (this.processBtn) {
      this.processBtn.disabled = this.items.length === 0;
    }
  }

  updateImagesCountLabel() {
    if (!this.imagesCountLabel) return;
    const n = this.items.length;
    this.imagesCountLabel.textContent =
      n === 0 ? 'Aucune image' : `${n} image${n > 1 ? 's' : ''} dans le pack`;
  }

  renderImagesGrid() {
    if (!this.imagesGrid) return;
    this.imagesGrid.innerHTML = '';

    this.items.forEach((item) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'wp-image-chip';
      if (item.id === this.activeItemId) card.classList.add('wp-image-chip--active');
      card.innerHTML = `
        <img src="${item.previewUrl}" alt="" class="wp-image-chip__thumb">
        <span class="wp-image-chip__slug">${this.escapeHtml(item.meta.slug)}</span>
        <span class="wp-image-chip__remove" data-remove="${item.id}" title="Retirer" aria-label="Retirer">×</span>`;

      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-remove]')) return;
        this.setActiveItem(item.id);
      });

      const removeBtn = card.querySelector('[data-remove]');
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeItem(item.id);
      });

      this.imagesGrid.appendChild(card);
    });
  }

  renderMetaCards() {
    if (!this.metaItemsList) return;
    this.metaItemsList.innerHTML = '';

    this.items.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'wp-meta-card';
      if (item.id === this.activeItemId) card.classList.add('wp-meta-card--active');
      card.dataset.itemId = item.id;

      const m = item.meta;
      const mistralBadge =
        item.metadataSource === 'mistral'
          ? '<span class="wp-meta-badge wp-meta-badge--mistral">Mistral</span>'
          : '';

      card.innerHTML = `
        <header class="wp-meta-card__head">
          <img src="${item.previewUrl}" alt="" class="wp-meta-card__thumb" width="56" height="56">
          <div>
            <strong class="wp-meta-card__name">${this.escapeHtml(item.file.name)}</strong>
            ${mistralBadge}
          </div>
          <button type="button" class="wp-copy-btn wp-meta-card__mistral-one" data-mistral-one="${item.id}">
            Mistral
          </button>
        </header>
        <div class="wp-meta-grid">
          <div class="wp-field">
            <label>Slug</label>
            <input type="text" data-field="slug" value="${this.escapeAttr(m.slug)}" autocomplete="off">
          </div>
          <div class="wp-field wp-field--full">
            <label>Titre</label>
            <input type="text" data-field="title" value="${this.escapeAttr(m.title)}" autocomplete="off">
          </div>
          <div class="wp-field wp-field--full">
            <label>Alt SEO</label>
            <input type="text" data-field="alt_text_seo" value="${this.escapeAttr(m.alt_text_seo)}" autocomplete="off">
          </div>
          <div class="wp-field wp-field--full">
            <label>Alt WCAG</label>
            <input type="text" data-field="alt_text_wcag" value="${this.escapeAttr(m.alt_text_wcag)}" autocomplete="off">
          </div>
          <div class="wp-field">
            <label>Alt court</label>
            <input type="text" data-field="alt_text_short" value="${this.escapeAttr(m.alt_text_short)}" autocomplete="off">
          </div>
          <div class="wp-field">
            <label>Légende</label>
            <input type="text" data-field="caption" value="${this.escapeAttr(m.caption)}" autocomplete="off">
          </div>
          <div class="wp-field wp-field--full">
            <label>Description</label>
            <textarea data-field="description" rows="2">${this.escapeHtml(m.description)}</textarea>
          </div>
        </div>`;

      card.querySelectorAll('input, textarea').forEach((el) => {
        el.addEventListener('input', () => this.syncMetaFromCard(card, item.id));
        el.addEventListener('focus', () => this.setActiveItem(item.id));
      });

      card.addEventListener('click', () => this.setActiveItem(item.id));

      const oneMistral = card.querySelector('[data-mistral-one]');
      oneMistral.addEventListener('click', (e) => {
        e.stopPropagation();
        this.suggestMetadataForItem(item.id);
      });

      this.metaItemsList.appendChild(card);
    });
  }

  syncMetaFromCard(card, itemId) {
    const item = this.items.find((i) => i.id === itemId);
    if (!item) return;

    const get = (field) => card.querySelector(`[data-field="${field}"]`)?.value ?? '';

    let slug = get('slug').trim();
    slug = this.slugify(slug || 'image');
    slug = this.ensureUniqueSlug(slug, itemId);

    item.meta = {
      slug,
      title: get('title').trim(),
      alt_text_seo: get('alt_text_seo').trim(),
      alt_text_wcag: get('alt_text_wcag').trim(),
      alt_text_short: get('alt_text_short').trim(),
      caption: get('caption').trim(),
      description: get('description').trim(),
    };

    const slugInput = card.querySelector('[data-field="slug"]');
    if (slugInput && slugInput.value !== slug) slugInput.value = slug;

    this.renderImagesGrid();
    this.scheduleDraftSave();
  }

  getItemMeta(item) {
    return {
      ...item.meta,
      slug: this.slugify(item.meta.slug || 'image'),
      site_url: this.getSiteUrl(),
      alt_text: (item.meta.alt_text_wcag || item.meta.alt_text_seo || '').trim(),
    };
  }

  loadMistralApiKey() {
    if (!this.mistralApiKeyInput) return;
    try {
      const stored = localStorage.getItem(MISTRAL_STORAGE_KEY);
      if (stored) this.mistralApiKeyInput.value = stored;
    } catch {
      /* ignore */
    }
  }

  saveMistralApiKey() {
    if (!this.mistralApiKeyInput) return;
    const key = this.mistralApiKeyInput.value.trim();
    try {
      if (key) localStorage.setItem(MISTRAL_STORAGE_KEY, key);
      else localStorage.removeItem(MISTRAL_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  getMistralApiKey() {
    return (this.mistralApiKeyInput?.value || '').trim();
  }

  updateSuggestButtonState() {
    if (!this.suggestMistralBtn) return;
    const ready = this.items.length > 0 && Boolean(this.getMistralApiKey());
    this.suggestMistralBtn.disabled = !ready;
  }

  hideMistralRateBanner() {
    if (this.mistralRateBanner) this.mistralRateBanner.hidden = true;
  }

  showMistralRateBanner(message) {
    if (!this.mistralRateBanner) {
      this.showNotification('⚠️', message);
      return;
    }
    this.mistralRateBanner.textContent = message;
    this.mistralRateBanner.hidden = false;
  }

  isAcceptedFile(file) {
    const types = ['image/png', 'image/jpeg', 'image/jpg', 'image/avif', 'image/webp'];
    if (types.includes(file.type)) return true;
    return /\.(png|jpe?g|avif|webp)$/i.test(file.name);
  }

  slugify(text) {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'image';
  }

  humanizeFilename(base) {
    return base
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  async suggestAllMetadataWithMistral() {
    if (!this.items.length) {
      this.showNotification('⚠️', 'Ajoutez des images d’abord');
      return;
    }
    const apiKey = this.getMistralApiKey();
    if (!apiKey) {
      this.showNotification('⚠️', 'Saisissez votre clé API Mistral');
      return;
    }

    this.saveMistralApiKey();
    this.hideMistralRateBanner();
    this.showLoading(true, 'Analyse Mistral…');
    if (this.suggestMistralBtn) this.suggestMistralBtn.disabled = true;

    let successCount = 0;
    let rateLimited = false;

    try {
      for (let i = 0; i < this.items.length; i++) {
        if (rateLimited) break;
        const item = this.items[i];
        this.updateLoadingText(`Mistral : image ${i + 1} / ${this.items.length}…`);
        try {
          await this.suggestMetadataForItem(item.id, { apiKey, silent: true });
          successCount += 1;
        } catch (err) {
          if (err.isRateLimit || err instanceof MistralRateLimitError) {
            rateLimited = true;
            break;
          }
          console.error(err);
        }
      }

      this.renderWorkflow();
      this.scheduleDraftSave();

      if (rateLimited) {
        const msg =
          successCount > 0
            ? `Limite Mistral atteinte après ${successCount} image(s). Les champs restent modifiables à la main pour les autres.`
            : 'Limite Mistral atteinte. Vous pouvez saisir ou corriger toutes les métadonnées à la main.';
        this.showMistralRateBanner(msg);
        this.showNotification('⚠️', 'Limite Mistral — saisie manuelle possible');
      } else if (successCount > 0) {
        this.showNotification('✨', `${successCount} image(s) suggérée(s) — vérifiez avant export`);
      } else {
        this.showNotification('❌', 'Aucune suggestion Mistral obtenue');
      }
    } finally {
      this.showLoading(false);
      this.updateSuggestButtonState();
    }
  }

  async suggestMetadataForItem(itemId, opts = {}) {
    const item = this.items.find((i) => i.id === itemId);
    if (!item) return;

    const apiKey = opts.apiKey || this.getMistralApiKey();
    if (!apiKey) {
      if (!opts.silent) this.showNotification('⚠️', 'Saisissez votre clé API Mistral');
      return;
    }

    if (!opts.silent) {
      this.saveMistralApiKey();
      this.showLoading(true, 'Analyse Mistral…');
      if (this.suggestMistralBtn) this.suggestMistralBtn.disabled = true;
    }

    try {
      const thumbDataUrl = await this.createMistralThumbnail(item.file);
      const suggested = await this.callMistralVision(apiKey, thumbDataUrl, item.meta.slug);
      Object.assign(item.meta, suggested);
      item.metadataSource = 'mistral';
      this.setActiveItem(itemId);
      this.renderWorkflow();
      this.scheduleDraftSave();
      if (!opts.silent) {
        this.hideMistralRateBanner();
        this.showNotification('✨', 'Métadonnées suggérées — vérifiez avant export');
      }
    } catch (err) {
      if (err.isRateLimit || err instanceof MistralRateLimitError) {
        this.showMistralRateBanner(
          'Limite Mistral atteinte. Complétez les champs ci-dessous à la main — rien n’est bloqué.'
        );
        this.scheduleDraftSave();
        if (!opts.silent) {
          this.showNotification('⚠️', 'Limite Mistral — saisie manuelle possible');
        }
      } else if (!opts.silent) {
        const msg = err?.message || 'Erreur Mistral';
        this.showNotification('❌', msg.length > 120 ? `${msg.slice(0, 117)}…` : msg);
      }
      throw err;
    } finally {
      if (!opts.silent) {
        this.showLoading(false);
        this.updateSuggestButtonState();
      }
    }
  }

  createMistralThumbnail(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          URL.revokeObjectURL(url);
          const sw = img.naturalWidth || img.width;
          const sh = img.naturalHeight || img.height;
          const scale = Math.min(1, MISTRAL_THUMB_MAX / Math.max(sw, sh));
          const tw = Math.max(1, Math.round(sw * scale));
          const th = Math.max(1, Math.round(sh * scale));
          const canvas = document.createElement('canvas');
          canvas.width = tw;
          canvas.height = th;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, tw, th);
          ctx.drawImage(img, 0, 0, tw, th);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Impossible de lire l’image'));
      };
      img.src = url;
    });
  }

  isMistralRateLimit(response, body) {
    if (response.status === 429) return true;
    const raw = [body?.message, body?.detail, body?.type, body?.code]
      .flat()
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return /rate.?limit|quota|too many|capacity|limit exceeded|service.?unavailable/i.test(raw);
  }

  async callMistralVision(apiKey, imageDataUrl, slugHint) {
    const systemPrompt = `Tu es expert SEO, accessibilité web (WCAG 2.2) et rédaction WordPress en français.
Analyse l'image fournie et réponds UNIQUEMENT avec un objet JSON valide (sans markdown), avec exactement ces clés :
- "title" : titre média court
- "alt_text_seo" : alt orienté mots-clés naturels (max 125 caractères)
- "alt_text_wcag" : description accessible de ce que voit un utilisateur non voyant (max 150 caractères)
- "alt_text_short" : variante très courte pour interfaces denses (max 60 caractères)
- "caption" : légende éditoriale avec une voix engageante (1 phrase)
- "description" : description média WordPress (1 à 2 phrases)
Contexte slug fichier : "${slugHint}".`;

    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MISTRAL_VISION_MODEL,
        temperature: 0.35,
        max_tokens: 700,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Décris cette image pour un site WordPress francophone et remplis le JSON demandé.',
              },
              { type: 'image_url', image_url: imageDataUrl },
            ],
          },
        ],
      }),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (this.isMistralRateLimit(response, body)) {
        throw new MistralRateLimitError('Limite de requêtes Mistral atteinte');
      }
      const apiMsg =
        body?.message ||
        body?.detail ||
        (Array.isArray(body?.message) ? body.message.join(', ') : null) ||
        `Erreur API (${response.status})`;
      if (response.status === 401) {
        throw new Error('Clé API Mistral invalide ou expirée');
      }
      throw new Error(apiMsg);
    }

    const content = body?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Réponse Mistral vide');

    return this.parseMistralMetadata(content);
  }

  parseMistralMetadata(content) {
    const raw = typeof content === 'string' ? content.trim() : JSON.stringify(content);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Réponse JSON illisible');
      parsed = JSON.parse(match[0]);
    }

    const pick = (keys) => {
      for (const k of keys) {
        const v = parsed[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
      return '';
    };

    return {
      title: pick(['title', 'titre']),
      alt_text_seo: pick(['alt_text_seo', 'alt_seo', 'altSeo']),
      alt_text_wcag: pick(['alt_text_wcag', 'alt_wcag', 'altWcag', 'alt_text']),
      alt_text_short: pick(['alt_text_short', 'alt_short', 'altShort']),
      caption: pick(['caption', 'legende', 'légende']),
      description: pick(['description']),
    };
  }

  async generatePack() {
    if (!this.items.length) {
      this.showNotification('⚠️', 'Aucune image');
      return;
    }

    this.items.forEach((item) => {
      item.meta.slug = this.ensureUniqueSlug(this.slugify(item.meta.slug), item.id);
    });
    this.renderWorkflow();

    const siteUrl = this.getSiteUrl();
    this.showLoading(true, 'Génération du pack…');

    try {
      const entries = [];

      for (let i = 0; i < this.items.length; i++) {
        const item = this.items[i];
        const meta = this.getItemMeta(item);
        this.updateLoadingText(`Image ${i + 1} / ${this.items.length} : ${meta.slug}…`);

        const image = await this.loadImage(item.file);
        const variants = await this.generateVariantsForImage(image, meta);
        const uploadsBase = siteUrl
          ? `${siteUrl}/wp-content/uploads/lumen/${meta.slug}`
          : `{{SITE_URL}}/wp-content/uploads/lumen/${meta.slug}`;

        entries.push({
          item,
          meta,
          variants,
          gutenbergHtml: this.buildGutenbergHtml(variants, meta, uploadsBase),
          jsonLd: this.buildJsonLd(variants, meta, uploadsBase),
        });
      }

      const metadata = this.buildMetadataJson(entries, siteUrl);
      this.packResult = { entries, metadata, siteUrl };
      this.activeItemId = entries[0]?.item.id || null;

      this.renderResults();
      if (this.resultsSection) this.resultsSection.style.display = 'block';

      const fileCount = entries.length * 10;
      this.showNotification(
        '🎉',
        `Pack prêt : ${entries.length} image(s), ${fileCount} fichiers`
      );
    } catch (err) {
      console.error(err);
      this.showNotification('❌', 'Erreur lors de la génération du pack');
    } finally {
      this.showLoading(false);
    }
  }

  async generateVariantsForImage(image, meta) {
    const variants = [];
    for (const sizeDef of WP_SIZES) {
      const dims = this.computeDimensions(
        image.naturalWidth,
        image.naturalHeight,
        sizeDef.max,
        sizeDef.crop
      );
      const webpBlob = await this.renderVariant(
        image,
        dims.width,
        dims.height,
        sizeDef.crop,
        'image/webp',
        WEBP_QUALITY
      );
      const jpegBlob = await this.renderVariant(
        image,
        dims.width,
        dims.height,
        sizeDef.crop,
        'image/jpeg',
        JPEG_QUALITY
      );
      const baseName = `${meta.slug}-${dims.width}x${dims.height}`;
      variants.push({
        size_key: sizeDef.key,
        size_label: sizeDef.label,
        width: dims.width,
        height: dims.height,
        crop: sizeDef.crop,
        webp: { blob: webpBlob, filename: `${baseName}.webp` },
        jpeg: { blob: jpegBlob, filename: `${baseName}.jpg` },
      });
    }
    return variants;
  }

  loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image load failed'));
      };
      img.src = url;
    });
  }

  computeDimensions(naturalW, naturalH, maxDim, cropSquare) {
    if (cropSquare && maxDim) return { width: maxDim, height: maxDim };
    if (maxDim == null) return { width: naturalW, height: naturalH };
    const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
    return {
      width: Math.max(1, Math.round(naturalW * scale)),
      height: Math.max(1, Math.round(naturalH * scale)),
    };
  }

  renderVariant(img, targetW, targetH, cropSquare, mimeType, quality) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (mimeType === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);
      }
      const sw = img.naturalWidth || img.width;
      const sh = img.naturalHeight || img.height;
      if (cropSquare) {
        const side = Math.min(sw, sh);
        const sx = (sw - side) / 2;
        const sy = (sh - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, targetW, targetH);
      } else {
        ctx.drawImage(img, 0, 0, targetW, targetH);
      }
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        mimeType,
        quality
      );
    });
  }

  buildGutenbergHtml(variants, meta, uploadsBase) {
    const alt = this.escapeHtml(meta.alt_text_wcag || meta.alt_text_seo || meta.title || meta.slug);
    const webpSrcset = variants
      .map((v) => `${uploadsBase}/${v.webp.filename} ${v.width}w`)
      .join(',\n    ');
    const jpegSrcset = variants
      .map((v) => `${uploadsBase}/${v.jpeg.filename} ${v.width}w`)
      .join(',\n    ');
    const largest = variants.reduce((a, b) => (b.width > a.width ? b : a), variants[0]);
    const fallback = `${uploadsBase}/${largest.jpeg.filename}`;

    return `<!-- wp:html -->
<picture>
  <source
    type="image/webp"
    srcset="
    ${webpSrcset}"
    sizes="(max-width: 768px) 100vw, 1024px"
  />
  <img
    src="${fallback}"
    srcset="
    ${jpegSrcset}"
    sizes="(max-width: 768px) 100vw, 1024px"
    alt="${alt}"
    width="${largest.width}"
    height="${largest.height}"
    loading="lazy"
    decoding="async"
  />
</picture>
<!-- /wp:html -->`;
  }

  buildJsonLd(variants, meta, uploadsBase) {
    const largest = variants.reduce((a, b) => (b.width > a.width ? b : a), variants[0]);
    return {
      '@context': 'https://schema.org',
      '@type': 'ImageObject',
      name: meta.title || meta.slug,
      contentUrl: `${uploadsBase}/${largest.jpeg.filename}`,
      thumbnailUrl: `${uploadsBase}/${variants.find((v) => v.size_key === 'thumbnail')?.jpeg.filename || largest.jpeg.filename}`,
      width: largest.width,
      height: largest.height,
      caption: meta.caption || undefined,
      description: meta.description || meta.alt_text_seo || undefined,
    };
  }

  buildMediaEntry(entry) {
    const { meta, variants, gutenbergHtml, jsonLd, item } = entry;
    const files = variants.flatMap((v) => [
      {
        size_key: v.size_key,
        size_label: v.size_label,
        width: v.width,
        height: v.height,
        format: 'webp',
        filename: v.webp.filename,
        path: `${meta.slug}/${v.webp.filename}`,
      },
      {
        size_key: v.size_key,
        size_label: v.size_label,
        width: v.width,
        height: v.height,
        format: 'jpeg',
        filename: v.jpeg.filename,
        path: `${meta.slug}/${v.jpeg.filename}`,
      },
    ]);

    return {
      slug: meta.slug,
      source_filename: item.file.name,
      title: meta.title,
      alt_text: meta.alt_text,
      alt_text_seo: meta.alt_text_seo,
      alt_text_wcag: meta.alt_text_wcag,
      alt_text_short: meta.alt_text_short,
      caption: meta.caption,
      description: meta.description,
      metadata_source: item.metadataSource,
      files,
      wordpress_rest: {
        media_endpoint: '/wp/v2/media',
        note: 'Uploadez le fichier « full » puis PATCH /wp/v2/media/{id}',
        patch_fields: {
          title: meta.title,
          alt_text: meta.alt_text,
          caption: meta.caption,
          description: meta.description,
        },
      },
      gutenberg: { html: gutenbergHtml, file: `gutenberg/${meta.slug}.html` },
      schema: { json_ld: jsonLd },
    };
  }

  buildMetadataJson(entries, siteUrl) {
    return {
      version: '1.1',
      generator: 'Lumen',
      generated_at: new Date().toISOString(),
      site_url: siteUrl || null,
      image_count: entries.length,
      media: entries.map((e) => this.buildMediaEntry(e)),
    };
  }

  getActivePackEntry() {
    if (!this.packResult) return null;
    return (
      this.packResult.entries.find((e) => e.item.id === this.activeItemId) ||
      this.packResult.entries[0]
    );
  }

  renderResults() {
    if (!this.packResult) return;
    const { entries } = this.packResult;

    if (this.snippetItemSelect) {
      this.snippetItemSelect.innerHTML = '';
      entries.forEach((e) => {
        const opt = document.createElement('option');
        opt.value = e.item.id;
        opt.textContent = e.meta.slug;
        if (e.item.id === this.activeItemId) opt.selected = true;
        this.snippetItemSelect.appendChild(opt);
      });
    }

    this.filesList.innerHTML = '';
    let totalBytes = 0;

    entries.forEach((entry) => {
      const head = document.createElement('div');
      head.className = 'wp-pack-file-row wp-pack-file-row--slug';
      head.innerHTML = `<span class="wp-pack-file-size"><strong>${this.escapeHtml(entry.meta.slug)}</strong></span><span class="wp-pack-file-dim">10 fichiers</span><span class="wp-pack-file-names">${this.escapeHtml(entry.item.file.name)}</span><span></span>`;
      this.filesList.appendChild(head);

      entry.variants.forEach((v) => {
        totalBytes += v.webp.blob.size + v.jpeg.blob.size;
        const row = document.createElement('div');
        row.className = 'wp-pack-file-row';
        row.innerHTML = `
          <span class="wp-pack-file-size">${this.escapeHtml(v.size_label)}</span>
          <span class="wp-pack-file-dim">${v.width}×${v.height}</span>
          <span class="wp-pack-file-names">${this.escapeHtml(v.webp.filename)} · ${this.escapeHtml(v.jpeg.filename)}</span>
          <span class="wp-pack-file-weight">${this.formatFileSize(v.webp.blob.size + v.jpeg.blob.size)}</span>`;
        this.filesList.appendChild(row);
      });
    });

    const totalRow = document.createElement('div');
    totalRow.className = 'wp-pack-file-row wp-pack-file-row--total';
    totalRow.innerHTML = `
      <span class="wp-pack-file-size"><strong>Total</strong></span>
      <span class="wp-pack-file-dim">${entries.length * 10} fichiers</span>
      <span class="wp-pack-file-names">metadata.json · gutenberg/*.html</span>
      <span class="wp-pack-file-weight"><strong>${this.formatFileSize(totalBytes)}</strong></span>`;
    this.filesList.appendChild(totalRow);

    this.updateSnippetPreview();
  }

  updateSnippetPreview() {
    const entry = this.getActivePackEntry();
    if (this.snippetItemSelect?.value) {
      const id = this.snippetItemSelect.value;
      this.activeItemId = id;
      const found = this.packResult?.entries.find((e) => e.item.id === id);
      if (found) {
        if (this.gutenbergPreview) this.gutenbergPreview.textContent = found.gutenbergHtml;
        if (this.jsonLdPreview) {
          this.jsonLdPreview.textContent = JSON.stringify(found.jsonLd, null, 2);
        }
        return;
      }
    }
    if (entry) {
      if (this.gutenbergPreview) this.gutenbergPreview.textContent = entry.gutenbergHtml;
      if (this.jsonLdPreview) {
        this.jsonLdPreview.textContent = JSON.stringify(entry.jsonLd, null, 2);
      }
    }
  }

  async downloadZip() {
    if (!this.packResult || typeof JSZip === 'undefined') {
      this.showNotification('❌', 'Générez d’abord le pack');
      return;
    }

    this.showLoading(true, 'Création de l’archive ZIP…');
    try {
      const zip = new JSZip();
      const { entries, metadata } = this.packResult;
      const gutenbergFolder = zip.folder('gutenberg');

      entries.forEach(({ meta, variants, gutenbergHtml }) => {
        const folder = zip.folder(meta.slug);
        variants.forEach((v) => {
          folder.file(v.webp.filename, v.webp.blob);
          folder.file(v.jpeg.filename, v.jpeg.blob);
        });
        gutenbergFolder.file(`${meta.slug}.html`, gutenbergHtml);
      });

      zip.file('metadata.json', JSON.stringify(metadata, null, 2));
      zip.file(
        'README.txt',
        [
          'Pack WordPress — Lumen',
          '========================',
          '',
          `${entries.length} image(s), ${entries.length * 10} fichiers image`,
          '',
          'Structure :',
          '  {slug}/     — 5 tailles × WebP + JPEG',
          '  gutenberg/  — un bloc HTML par slug',
          '  metadata.json — media[] pour REST WordPress',
          '',
          'Les métadonnées peuvent être saisies à la main si Mistral est limité.',
        ].join('\n')
      );

      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const stamp = new Date().toISOString().slice(0, 10);
      this.downloadBlob(blob, `lumen-wp-pack-${entries.length}img-${stamp}.zip`);
      this.showNotification('📦', 'ZIP téléchargé');
    } catch (e) {
      console.error(e);
      this.showNotification('❌', 'Erreur lors du ZIP');
    } finally {
      this.showLoading(false);
    }
  }

  async reset() {
    await this.flushDraftSave();
    this.items.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    this.items = [];
    this.packResult = null;
    this.activeItemId = null;
    if (this.fileInput) this.fileInput.value = '';
    if (this.uploadSection) this.uploadSection.style.display = '';
    if (this.workflowSection) this.workflowSection.style.display = 'none';
    if (this.resultsSection) this.resultsSection.style.display = 'none';
    if (this.imagesGrid) this.imagesGrid.innerHTML = '';
    if (this.metaItemsList) this.metaItemsList.innerHTML = '';
    if (this.filesList) this.filesList.innerHTML = '';
    this.hideMistralRateBanner();
    await this.clearDraftStorage();
    this.updateSuggestButtonState();
    this.showNotification('🔄', 'Réinitialisé');
  }

  async copyToClipboard(text, successMsg) {
    if (!text) {
      this.showNotification('⚠️', 'Rien à copier');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      this.showNotification('📋', successMsg);
    } catch {
      this.showNotification('❌', 'Copie impossible — sélectionnez le texte manuellement');
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

  showLoading(show, text) {
    if (this.loadingOverlay) this.loadingOverlay.style.display = show ? 'flex' : 'none';
    if (text && this.loadingText) this.loadingText.textContent = text;
  }

  updateLoadingText(text) {
    if (this.loadingText) this.loadingText.textContent = text;
  }

  showNotification(icon, text, duration = 3500) {
    if (!this.notification) return;
    this.notificationIcon.textContent = icon;
    this.notificationText.textContent = text;
    this.notification.style.display = 'flex';
    clearTimeout(this._notifyTimer);
    this._notifyTimer = setTimeout(() => {
      this.notification.style.display = 'none';
    }, duration);
  }

  escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  escapeAttr(text) {
    return this.escapeHtml(text).replace(/"/g, '&quot;');
  }

  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / 1024 ** i).toFixed(1))} ${['B', 'KB', 'MB', 'GB'][i]}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page === 'wordpress') {
    window.wordpressPack = new WordPressPack();
  }
});
