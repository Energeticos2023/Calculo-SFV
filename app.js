(() => {
  'use strict';

  const APP_KEY = 'energeticos_solar_state_v2';
  const DB_NAME = 'energeticos_solar_photos';
  const DB_VERSION = 1;
  const WHATSAPP = '51942899919';
  const COMPANY = {
    brand: 'ENERGÉTICOS · Servicios del Sector Eléctrico',
    legal: 'Corporación RyC Contratistas Generales S.A.C.',
    ruc: '20533666273',
    address: 'Jr. Augusto B. Leguía 563, Independencia, Huaraz, Áncash',
    phone: '+51 942 899 919',
    email: 'energeticos.ryc@gmail.com',
    engineer: 'Ing. José Rafael Zeña Peche',
    profession: 'Ingeniero Mecánico Electricista',
    cip: '85540'
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const form = $('#solarForm');
  const steps = $$('.step');
  const progressArea = $('#progressArea');
  const bottomNav = $('#bottomNav');
  const backBtn = $('#backBtn');
  const nextBtn = $('#nextBtn');
  const toastEl = $('#toast');

  const PHOTO_LABELS = {
    bill: 'Recibo de luz', meter: 'Medidor eléctrico', board: 'Tablero eléctrico',
    nameplates: 'Placas de equipos', roof: 'Techo o terreno', shadows: 'Sombras y obstáculos',
    route: 'Ruta de cableado', pumpPlate: 'Placa de bomba', waterSource: 'Fuente de agua', tank: 'Tanque o descarga'
  };

  const PRESETS = [
    { key: 'light', emoji: '💡', name: 'Foco LED', watts: 12, hours: 5 },
    { key: 'tv', emoji: '📺', name: 'Televisor', watts: 100, hours: 5 },
    { key: 'fridge', emoji: '🧊', name: 'Refrigeradora', watts: 180, hours: 10 },
    { key: 'freezer', emoji: '❄️', name: 'Congeladora', watts: 350, hours: 10 },
    { key: 'laptop', emoji: '💻', name: 'Laptop', watts: 65, hours: 6 },
    { key: 'computer', emoji: '🖥️', name: 'Computadora', watts: 250, hours: 6 },
    { key: 'router', emoji: '📶', name: 'Router / internet', watts: 18, hours: 24 },
    { key: 'washer', emoji: '🧺', name: 'Lavadora', watts: 600, hours: 1 },
    { key: 'microwave', emoji: '♨️', name: 'Microondas', watts: 1200, hours: 0.3 },
    { key: 'blender', emoji: '🥤', name: 'Licuadora', watts: 450, hours: 0.2 },
    { key: 'iron', emoji: '👕', name: 'Plancha', watts: 1200, hours: 0.5 },
    { key: 'kettle', emoji: '🫖', name: 'Hervidor', watts: 1800, hours: 0.3 },
    { key: 'pump', emoji: '💧', name: 'Bomba de agua', watts: 750, hours: 2 },
    { key: 'motor', emoji: '⚙️', name: 'Motor', watts: 1500, hours: 2 },
    { key: 'ac', emoji: '🌬️', name: 'Aire acondicionado', watts: 1200, hours: 5 },
    { key: 'welder', emoji: '🔥', name: 'Soldadora', watts: 3500, hours: 1 },
    { key: 'oven', emoji: '🍞', name: 'Horno eléctrico', watts: 2000, hours: 1 },
    { key: 'shower', emoji: '🚿', name: 'Ducha eléctrica', watts: 4500, hours: 0.5 },
    { key: 'camera', emoji: '📹', name: 'Cámaras CCTV', watts: 60, hours: 24 },
    { key: 'printer', emoji: '🖨️', name: 'Impresora', watts: 400, hours: 0.5 }
  ];

  let currentStep = 0;
  let loads = [];
  let photos = {};
  let dbPromise = null;
  let deferredInstallPrompt = null;
  let heroTimer = null;
  let logoDataUrl = '';

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const safeName = (value) => (value || 'cliente').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 45) || 'cliente';
  const formatNum = (n, digits = 2) => Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: digits, maximumFractionDigits: digits });

  function toast(message, duration = 2400) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove('show'), duration);
  }

  function getValue(name) {
    const elements = $$(`[name="${CSS.escape(name)}"]`, form);
    if (!elements.length) return '';
    const first = elements[0];
    if (first.type === 'radio') return elements.find(el => el.checked)?.value || '';
    if (first.type === 'checkbox') return first.checked;
    return first.value?.trim?.() ?? first.value ?? '';
  }

  function serializeForm() {
    const data = {};
    const names = new Set($$('[name]', form).map(el => el.name));
    names.forEach(name => { data[name] = getValue(name); });
    return data;
  }

  function restoreForm(data = {}) {
    Object.entries(data).forEach(([name, value]) => {
      const elements = $$(`[name="${CSS.escape(name)}"]`, form);
      if (!elements.length) return;
      if (elements[0].type === 'radio') {
        elements.forEach(el => { el.checked = el.value === value; });
      } else if (elements[0].type === 'checkbox') {
        elements[0].checked = Boolean(value);
      } else {
        elements[0].value = value ?? '';
      }
    });
  }

  function saveState() {
    const state = { currentStep, form: serializeForm(), loads, savedAt: new Date().toISOString() };
    try { localStorage.setItem(APP_KEY, JSON.stringify(state)); } catch (_) { /* no-op */ }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(APP_KEY);
      if (!raw) return;
      const state = JSON.parse(raw);
      restoreForm(state.form || {});
      loads = Array.isArray(state.loads) ? state.loads : [];
      currentStep = Number.isInteger(state.currentStep) ? Math.min(Math.max(state.currentStep, 0), 7) : 0;
    } catch (_) { /* no-op */ }
  }

  function showStep(index, { scroll = true } = {}) {
    currentStep = Math.min(Math.max(index, 0), steps.length - 1);
    steps.forEach((step, idx) => step.classList.toggle('active', idx === currentStep));

    const isStart = currentStep === 0;
    const isDone = currentStep === steps.length - 1;
    progressArea.hidden = isStart || isDone;
    bottomNav.hidden = isStart || isDone;

    if (!isStart && !isDone) {
      const maxWizardStep = steps.length - 2;
      $('#stepLabel').textContent = `Paso ${currentStep} de ${maxWizardStep}`;
      $('#stepName').textContent = steps[currentStep].dataset.name;
      $('#progressBar').style.width = `${(currentStep / maxWizardStep) * 100}%`;
      nextBtn.textContent = currentStep === maxWizardStep ? 'Preparar expediente' : 'Continuar';
    }

    if (currentStep === 6) updateSpecialSection();
    if (currentStep === 7) renderQualityChecklist();
    if (isDone) buildFinalResult();
    saveState();
    if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function validateCurrentStep() {
    const section = steps[currentStep];
    let firstInvalid = null;
    $$('[required]', section).forEach(el => {
      el.classList.remove('invalid');
      let valid = true;
      if (el.type === 'radio') {
        valid = Boolean($(`[name="${CSS.escape(el.name)}"]:checked`, section));
      } else if (el.type === 'checkbox') {
        valid = el.checked;
      } else {
        valid = Boolean(el.value.trim());
        if (valid && el.type === 'email') valid = el.checkValidity();
      }
      if (!valid) {
        el.classList.add('invalid');
        firstInvalid ||= el.closest('.choice-card, .check-field, .field') || el;
      }
    });

    if (currentStep === 4 && !loads.length && getValue('systemType') !== 'Sistema de bombeo solar') {
      firstInvalid ||= $('#presetGrid');
      toast('Agregue al menos un equipo que utilizará el sistema.');
    }

    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (!toastEl.classList.contains('show')) toast('Complete los campos obligatorios.');
      return false;
    }
    return true;
  }

  function bindNavigation() {
    $$('[data-next]').forEach(btn => btn.addEventListener('click', () => showStep(currentStep + 1)));
    nextBtn.addEventListener('click', () => {
      if (!validateCurrentStep()) return;
      showStep(currentStep + 1);
    });
    backBtn.addEventListener('click', () => showStep(currentStep - 1));
  }

  function bindDialogs() {
    $('#requirementsBtn').addEventListener('click', () => $('#requirementsDialog').showModal());
    $('#brandBtn').addEventListener('click', () => $('#companyDialog').showModal());
    $$('[data-close]').forEach(btn => btn.addEventListener('click', () => btn.closest('dialog').close()));
    $$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    }));
  }

  function bindChoiceCards() {
    $$('.choice-card input').forEach(input => {
      input.addEventListener('change', () => {
        $$('.choice-card').forEach(card => card.classList.toggle('selected', card.querySelector('input').checked));
        updateSpecialSection();
        saveState();
      });
    });
  }

  function updateSupplyFields() {
    const hasGrid = getValue('hasGrid') !== 'No';
    $('#gridFields').hidden = !hasGrid;
    $('#noGridFields').hidden = hasGrid;
  }

  function updateSpecialSection() {
    const isPump = getValue('systemType') === 'Sistema de bombeo solar';
    $('#batterySection').hidden = isPump;
    $('#pumpSection').hidden = !isPump;
    $('#specialTitle').textContent = isPump ? 'Datos para el bombeo solar' : 'Respaldo y autonomía';
    $('#specialDesc').textContent = isPump
      ? 'La potencia de la bomba no basta: necesitamos caudal, alturas, distancias, tubería y fotografías.'
      : 'Indique cuánto tiempo deben funcionar las cargas cuando no haya sol o se interrumpa la red.';
  }

  function bindFormBehavior() {
    form.addEventListener('input', event => {
      event.target.classList.remove('invalid');
      saveState();
      if (['roofLength', 'roofWidth'].includes(event.target.id)) updateRoofArea();
      if (event.target.closest('.load-row')) updateLoadCalculations();
    });
    form.addEventListener('change', event => {
      event.target.classList.remove('invalid');
      if (event.target.name === 'hasGrid') updateSupplyFields();
      if (event.target.name === 'systemType') updateSpecialSection();
      saveState();
    });

    $('#gpsBtn').addEventListener('click', () => {
      if (!navigator.geolocation) return toast('Este dispositivo no permite obtener la ubicación.');
      const button = $('#gpsBtn');
      button.disabled = true;
      button.textContent = 'Obteniendo ubicación…';
      navigator.geolocation.getCurrentPosition(
        position => {
          $('#gpsField').value = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
          button.textContent = '✓ Ubicación obtenida';
          button.disabled = false;
          saveState();
          toast('Ubicación guardada.');
        },
        () => {
          button.disabled = false;
          button.textContent = '📍 Obtener ubicación';
          toast('No se pudo obtener la ubicación. Active el GPS y autorice el acceso.');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
      );
    });

    $('#roofLength').addEventListener('input', updateRoofArea);
    $('#roofWidth').addEventListener('input', updateRoofArea);
  }

  function updateRoofArea() {
    const length = Number($('#roofLength').value || 0);
    const width = Number($('#roofWidth').value || 0);
    $('#roofArea').value = length > 0 && width > 0 ? `${formatNum(length * width, 1)} m²` : '';
  }

  function renderPresets() {
    const grid = $('#presetGrid');
    grid.innerHTML = '';
    PRESETS.forEach(preset => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'preset';
      button.dataset.key = preset.key;
      button.innerHTML = `<span>${preset.emoji}</span><strong>${preset.name}</strong>`;
      button.addEventListener('click', () => togglePreset(preset));
      grid.appendChild(button);
    });
    refreshPresetSelections();
  }

  function togglePreset(preset) {
    const index = loads.findIndex(load => load.presetKey === preset.key);
    if (index >= 0) loads.splice(index, 1);
    else loads.push({
      id: uid(), presetKey: preset.key, emoji: preset.emoji, name: preset.name,
      qty: 1, watts: preset.watts, hours: preset.hours, usage: 'Día y noche', critical: preset.key === 'fridge' || preset.key === 'router'
    });
    renderLoads();
    saveState();
  }

  function addCustomLoad() {
    loads.push({ id: uid(), presetKey: '', emoji: '🔌', name: 'Otro equipo', qty: 1, watts: 0, hours: 1, usage: 'Día y noche', critical: false });
    renderLoads();
    saveState();
    setTimeout(() => $('#loadRows .load-row:last-child input[data-field="name"]')?.focus(), 50);
  }

  function refreshPresetSelections() {
    $$('.preset').forEach(button => button.classList.toggle('selected', loads.some(load => load.presetKey === button.dataset.key)));
  }

  function renderLoads() {
    const container = $('#loadRows');
    container.innerHTML = '';
    loads.forEach((load, index) => {
      const row = document.createElement('article');
      row.className = 'load-row';
      row.dataset.id = load.id;
      row.innerHTML = `
        <div class="load-head">
          <span class="load-emoji">${load.emoji || '🔌'}</span>
          <input data-field="name" value="${escapeHtml(load.name)}" aria-label="Nombre del equipo">
          <button type="button" data-delete aria-label="Eliminar equipo">×</button>
        </div>
        <div class="load-grid">
          <label class="field"><span>Cantidad</span><input data-field="qty" type="number" min="1" step="1" inputmode="numeric" value="${Number(load.qty || 1)}"></label>
          <label class="field"><span>Potencia (W)</span><input data-field="watts" type="number" min="0" step="1" inputmode="decimal" value="${Number(load.watts || 0)}"></label>
          <label class="field"><span>Horas/día</span><input data-field="hours" type="number" min="0" max="24" step="0.1" inputmode="decimal" value="${Number(load.hours || 0)}"></label>
          <label class="field"><span>Horario</span><select data-field="usage"><option>Día</option><option>Noche</option><option>Día y noche</option></select></label>
        </div>
        <label class="critical-toggle"><input data-field="critical" type="checkbox" ${load.critical ? 'checked' : ''}> Debe funcionar durante un corte o en días sin sol</label>
      `;
      row.querySelector('[data-field="usage"]').value = load.usage || 'Día y noche';
      row.querySelectorAll('[data-field]').forEach(control => {
        control.addEventListener('input', () => updateLoadFromRow(index, control));
        control.addEventListener('change', () => updateLoadFromRow(index, control));
      });
      row.querySelector('[data-delete]').addEventListener('click', () => {
        loads.splice(index, 1);
        renderLoads();
        saveState();
      });
      container.appendChild(row);
    });
    refreshPresetSelections();
    updateLoadCalculations();
  }

  function updateLoadFromRow(index, control) {
    const field = control.dataset.field;
    let value = control.type === 'checkbox' ? control.checked : control.value;
    if (['qty', 'watts', 'hours'].includes(field)) value = Number(value || 0);
    loads[index][field] = value;
    updateLoadCalculations();
    saveState();
  }

  function loadMetrics() {
    return loads.reduce((acc, load) => {
      const qty = Math.max(0, Number(load.qty || 0));
      const watts = Math.max(0, Number(load.watts || 0));
      const hours = Math.max(0, Number(load.hours || 0));
      const energy = qty * watts * hours / 1000;
      acc.connectedW += qty * watts;
      acc.dailyKwh += energy;
      if (load.critical) acc.criticalKwh += energy;
      return acc;
    }, { connectedW: 0, dailyKwh: 0, criticalKwh: 0 });
  }

  function updateLoadCalculations() {
    const metrics = loadMetrics();
    $('#connectedPower').textContent = metrics.connectedW >= 1000 ? `${formatNum(metrics.connectedW / 1000, 2)} kW` : `${formatNum(metrics.connectedW, 0)} W`;
    $('#dailyEnergy').textContent = `${formatNum(metrics.dailyKwh, 2)} kWh/día`;
    $('#criticalEnergy').textContent = `${formatNum(metrics.criticalKwh, 2)} kWh/día`;
  }

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('photos')) {
          const store = db.createObjectStore('photos', { keyPath: 'id' });
          store.createIndex('category', 'category', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }

  async function dbGetAllPhotos() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction('photos', 'readonly').objectStore('photos').getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async function dbPutPhoto(record) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction('photos', 'readwrite').objectStore('photos').put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function dbDeletePhoto(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction('photos', 'readwrite').objectStore('photos').delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function dbClearPhotos() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction('photos', 'readwrite').objectStore('photos').clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function compressImage(file) {
    const max = 1600;
    let source = null;
    let width = 0;
    let height = 0;
    let cleanup = () => {};

    if ('createImageBitmap' in window) {
      source = await createImageBitmap(file).catch(() => null);
      if (source) {
        width = source.width;
        height = source.height;
        cleanup = () => source.close?.();
      }
    }

    if (!source) {
      const objectUrl = URL.createObjectURL(file);
      source = await new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = objectUrl;
      });
      if (!source) { URL.revokeObjectURL(objectUrl); return { blob: file, type: file.type || 'application/octet-stream' }; }
      width = source.naturalWidth;
      height = source.naturalHeight;
      cleanup = () => URL.revokeObjectURL(objectUrl);
    }

    const scale = Math.min(1, max / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    canvas.getContext('2d', { alpha: false }).drawImage(source, 0, 0, targetWidth, targetHeight);
    cleanup();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.78));
    return { blob: blob || file, type: blob ? 'image/jpeg' : (file.type || 'application/octet-stream') };
  }

  async function addPhotoFiles(category, files) {
    let added = 0;
    for (const file of [...files]) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const compressed = await compressImage(file);
        const record = {
          id: uid(), category, name: file.name || `${category}-${Date.now()}.jpg`,
          type: compressed.type, blob: compressed.blob, createdAt: new Date().toISOString()
        };
        await dbPutPhoto(record);
        (photos[category] ||= []).push(record);
        added += 1;
      } catch (error) {
        console.error(error);
      }
    }
    renderPhotoCategory(category);
    if (added) toast(`${added} foto${added === 1 ? '' : 's'} guardada${added === 1 ? '' : 's'} en la aplicación.`);
  }

  function renderPhotoCategory(category) {
    const uploader = $(`.photo-uploader[data-category="${CSS.escape(category)}"]`);
    if (!uploader) return;
    const list = $('.thumb-list', uploader);
    list.innerHTML = '';
    (photos[category] || []).forEach(record => {
      const item = document.createElement('div');
      item.className = 'thumb';
      const img = document.createElement('img');
      img.alt = PHOTO_LABELS[category] || 'Fotografía';
      img.src = URL.createObjectURL(record.blob);
      img.onload = () => URL.revokeObjectURL(img.src);
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = '×';
      del.addEventListener('click', async () => {
        await dbDeletePhoto(record.id);
        photos[category] = (photos[category] || []).filter(photo => photo.id !== record.id);
        renderPhotoCategory(category);
        toast('Fotografía eliminada.');
      });
      item.append(img, del);
      list.appendChild(item);
    });
  }

  async function loadPhotos() {
    photos = {};
    try {
      const records = await dbGetAllPhotos();
      records.forEach(record => (photos[record.category] ||= []).push(record));
      Object.keys(PHOTO_LABELS).forEach(renderPhotoCategory);
    } catch (error) {
      console.error(error);
      toast('No se pudieron recuperar las fotografías guardadas.');
    }
  }

  function bindPhotoUploaders() {
    $$('.photo-uploader').forEach(uploader => {
      const category = uploader.dataset.category;
      const input = $('input[type="file"]', uploader);
      const button = $('button', uploader);
      button.addEventListener('click', () => input.click());
      input.addEventListener('change', async () => {
        button.disabled = true;
        await addPhotoFiles(category, input.files);
        input.value = '';
        button.disabled = false;
      });
    });
  }

  function allPhotoRecords() {
    return Object.values(photos).flat();
  }

  function photoCount(category) {
    return (photos[category] || []).length;
  }

  function renderQualityChecklist() {
    const items = [];
    const hasGrid = getValue('hasGrid') !== 'No';
    const isPump = getValue('systemType') === 'Sistema de bombeo solar';
    const add = (good, title, detail) => items.push({ good, title, detail });

    add(Boolean(getValue('gps') || getValue('mapLink')), 'Ubicación geográfica', getValue('gps') || getValue('mapLink') ? 'Ubicación registrada.' : 'Conviene obtener GPS o pegar un enlace de Maps.');
    add(loads.length > 0 || isPump, 'Inventario de equipos', loads.length ? `${loads.length} equipo(s) registrado(s).` : (isPump ? 'Proyecto de bombeo seleccionado.' : 'No se registraron equipos.'));
    add(photoCount('nameplates') > 0 || isPump, 'Placas de equipos', photoCount('nameplates') ? `${photoCount('nameplates')} fotografía(s) guardada(s).` : 'Faltan fotos de las placas de equipos de mayor consumo.');
    add(photoCount('roof') > 0, 'Lugar de instalación', photoCount('roof') ? `${photoCount('roof')} fotografía(s) del techo o terreno.` : 'Faltan fotos generales del techo o terreno.');
    add(!hasGrid || photoCount('bill') > 0, 'Recibo de electricidad', !hasGrid ? 'El proyecto no cuenta con red eléctrica.' : (photoCount('bill') ? 'Recibo fotografiado.' : 'Falta foto del recibo de luz.'));
    add(!hasGrid || (photoCount('meter') > 0 && photoCount('board') > 0), 'Medidor y tablero', !hasGrid ? 'No aplica por ausencia de red.' : ((photoCount('meter') && photoCount('board')) ? 'Medidor y tablero registrados.' : 'Conviene fotografiar medidor y tablero.'));
    if (isPump) add(photoCount('pumpPlate') > 0, 'Placa de la bomba', photoCount('pumpPlate') ? 'Placa de bomba fotografiada.' : 'Falta foto legible de la placa de la bomba.');

    $('#qualityChecklist').innerHTML = items.map(item => `
      <article class="check-item ${item.good ? 'good' : 'warn'}">
        <span class="mark">${item.good ? '✓' : '!'}</span>
        <div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></div>
      </article>`).join('');
  }

  function buildSummary() {
    const data = serializeForm();
    const metrics = loadMetrics();
    const lines = [];
    const line = (text = '') => lines.push(text);
    const hasGrid = data.hasGrid !== 'No';
    const isPump = data.systemType === 'Sistema de bombeo solar';

    line('☀️ *SOLICITUD DE DISEÑO FOTOVOLTAICO — ENERGÉTICOS*');
    line('━━━━━━━━━━━━━━━━━━━━');
    line(`📅 Fecha: ${new Date().toLocaleDateString('es-PE')}`);
    line('');
    line('👤 *CLIENTE*');
    line(`• ${data.clientName || 'No indicado'}`);
    line(`• WhatsApp: ${data.clientPhone || 'No indicado'}`);
    if (data.clientId) line(`• DNI/RUC: ${data.clientId}`);
    if (data.clientEmail) line(`• Correo: ${data.clientEmail}`);
    line(`• Tipo: ${data.clientType || 'No indicado'}`);
    line('');
    line('📍 *UBICACIÓN DEL PROYECTO*');
    line(`• ${[data.department, data.province, data.district, data.sector].filter(Boolean).join(' / ') || 'No indicada'}`);
    line(`• ${data.address || 'Sin dirección'}`);
    if (data.gps) line(`• GPS: ${data.gps}`);
    if (data.mapLink) line(`• Maps: ${data.mapLink}`);
    line('');
    line('🎯 *SOLUCIÓN SOLICITADA*');
    line(`• ${data.systemType || 'No definida'}`);
    line(`• Objetivo: ${data.mainGoal || 'No indicado'}`);
    line(`• Plazo: ${data.desiredDate || 'No indicado'}`);
    line(`• Presupuesto: ${data.budget || 'No definido'}`);
    if (data.expectation) line(`• Expectativa: ${data.expectation}`);
    line('');
    line('⚡ *SUMINISTRO ELÉCTRICO*');
    line(`• Cuenta con red: ${data.hasGrid || 'No indicado'}`);
    if (hasGrid) {
      if (data.utility) line(`• Distribuidora: ${data.utility}`);
      if (data.supplyNumber) line(`• Suministro: ${data.supplyNumber}`);
      if (data.monthlyBill) line(`• Pago promedio: S/ ${data.monthlyBill}/mes`);
      if (data.monthlyKwh) line(`• Consumo promedio: ${data.monthlyKwh} kWh/mes`);
      line(`• Fases / tensión: ${data.phase || 'No sé'} / ${data.voltage || 'No sé'}`);
      if (data.mainBreaker) line(`• Interruptor principal: ${data.mainBreaker} A`);
    } else {
      line(`• Fuente actual: ${data.currentSource || 'Ninguna'}`);
      if (data.currentHours) line(`• Energía disponible: ${data.currentHours} h/día`);
      if (data.currentCost) line(`• Gasto actual: S/ ${data.currentCost}/mes`);
    }
    line('');
    line('🔌 *INVENTARIO DE CARGAS*');
    if (loads.length) {
      loads.forEach(load => {
        const energy = Number(load.qty || 0) * Number(load.watts || 0) * Number(load.hours || 0) / 1000;
        line(`• ${load.name}: ${load.qty} u. × ${load.watts} W × ${load.hours} h/día = ${formatNum(energy, 2)} kWh/día${load.critical ? ' [CRÍTICA]' : ''}`);
      });
      line(`• Potencia conectada referencial: ${formatNum(metrics.connectedW / 1000, 2)} kW`);
      line(`• Energía diaria referencial: ${formatNum(metrics.dailyKwh, 2)} kWh/día`);
      line(`• Energía crítica: ${formatNum(metrics.criticalKwh, 2)} kWh/día`);
    } else {
      line('• No se registraron cargas adicionales.');
    }
    line('');
    line('🏠 *ÁREA DE INSTALACIÓN*');
    line(`• Lugar: ${data.installPlace || 'No indicado'}`);
    line(`• Dimensiones: ${data.roofLength || '—'} m × ${data.roofWidth || '—'} m ${data.roofArea ? `(${data.roofArea})` : ''}`);
    line(`• Orientación / inclinación: ${data.orientation || 'No sé'} / ${data.tilt || 'No sé'}`);
    line(`• Sombras: ${data.shading || 'No indicado'}`);
    line(`• Distancia al tablero: ${data.roofBoardDistance || '—'} m`);
    if (data.siteNotes) line(`• Observaciones: ${data.siteNotes}`);
    line('');

    if (isPump) {
      line('💧 *BOMBEO SOLAR*');
      line(`• Aplicación: ${data.pumpUse || 'No indicada'}`);
      line(`• Bomba: ${data.pumpType || 'No sé'} · ${data.pumpHp || '—'} HP · ${data.pumpKw || '—'} kW · ${data.pumpVoltage || 'No sé'}`);
      line(`• Agua requerida: ${data.dailyWater || '—'} m³/día`);
      line(`• Profundidad: ${data.waterDepth || '—'} m · Altura al tanque: ${data.tankHeight || '—'} m · Distancia: ${data.horizontalDistance || '—'} m`);
      line(`• Tubería: ${data.pipeDiameter || '—'} · Horas de bombeo: ${data.pumpHours || '—'}`);
      if (data.pumpNotes) line(`• Nota: ${data.pumpNotes}`);
      line('');
    } else {
      line('🔋 *RESPALDO Y AUTONOMÍA*');
      line(`• Respaldo: ${data.backupHours || 'No indicado'}`);
      line(`• Autonomía: ${data.autonomyDays || 'No indicada'}`);
      line(`• Batería: ${data.batteryPreference || 'Sin preferencia'}`);
      if (data.criticalNotes) line(`• Cargas indispensables: ${data.criticalNotes}`);
      line('');
    }

    line('📷 *FOTOGRAFÍAS REGISTRADAS*');
    Object.entries(PHOTO_LABELS).forEach(([category, label]) => {
      const count = photoCount(category);
      if (count) line(`• ${label}: ${count}`);
    });
    line(`• Total: ${allPhotoRecords().length}`);
    if (data.finalNotes) { line(''); line(`📝 *OBSERVACIONES FINALES:* ${data.finalNotes}`); }
    line('');
    line('━━━━━━━━━━━━━━━━━━━━');
    line(`👷 Responsable técnico: ${COMPANY.engineer}`);
    line(`${COMPANY.profession} · CIP ${COMPANY.cip}`);
    line(`${COMPANY.legal} · RUC ${COMPANY.ruc}`);
    line(`WhatsApp: ${COMPANY.phone}`);
    line('_Información proporcionada por el cliente para evaluación y diseño preliminar._');
    return lines.join('\n');
  }

  function buildFinalResult() {
    const data = serializeForm();
    const metrics = loadMetrics();
    $('#completeTitle').textContent = data.clientName ? `Expediente de ${data.clientName.split(/\s+/)[0]} listo` : 'Su expediente está listo';
    $('#resultPower').textContent = metrics.connectedW >= 1000 ? `${formatNum(metrics.connectedW / 1000, 2)} kW` : `${formatNum(metrics.connectedW, 0)} W`;
    $('#resultEnergy').textContent = `${formatNum(metrics.dailyKwh, 2)} kWh/día`;
    $('#resultPhotos').textContent = String(allPhotoRecords().length);
    $('#summaryText').textContent = buildSummary();
  }

  async function loadLogoDataUrl() {
    if (logoDataUrl) return logoDataUrl;
    try {
      const response = await fetch('assets/logo.png');
      const blob = await response.blob();
      logoDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (_) {
      logoDataUrl = new URL('assets/logo.png', location.href).href;
    }
    return logoDataUrl;
  }

  function reportHtml() {
    const data = serializeForm();
    const metrics = loadMetrics();
    const rows = loads.map(load => {
      const energy = Number(load.qty || 0) * Number(load.watts || 0) * Number(load.hours || 0) / 1000;
      return `<tr><td>${escapeHtml(load.name)}</td><td>${load.qty}</td><td>${load.watts}</td><td>${load.hours}</td><td>${escapeHtml(load.usage)}</td><td>${load.critical ? 'Sí' : 'No'}</td><td>${formatNum(energy, 2)}</td></tr>`;
    }).join('') || '<tr><td colspan="7">Sin cargas registradas.</td></tr>';
    const photoRows = Object.entries(PHOTO_LABELS).filter(([cat]) => photoCount(cat)).map(([cat, label]) => `<li>${escapeHtml(label)}: ${photoCount(cat)} archivo(s)</li>`).join('') || '<li>Sin fotografías registradas.</li>';
    const fields = [
      ['Cliente', data.clientName], ['Celular / WhatsApp', data.clientPhone], ['DNI / RUC', data.clientId], ['Correo', data.clientEmail],
      ['Ubicación', [data.department, data.province, data.district, data.sector].filter(Boolean).join(' / ')], ['Dirección', data.address], ['GPS', data.gps], ['Maps', data.mapLink],
      ['Sistema solicitado', data.systemType], ['Objetivo', data.mainGoal], ['Plazo', data.desiredDate], ['Presupuesto', data.budget],
      ['Cuenta con red', data.hasGrid], ['Distribuidora', data.utility], ['Consumo mensual', data.monthlyKwh ? `${data.monthlyKwh} kWh/mes` : ''], ['Pago mensual', data.monthlyBill ? `S/ ${data.monthlyBill}` : ''],
      ['Tipo de suministro', data.phase], ['Tensión', data.voltage], ['Interruptor principal', data.mainBreaker ? `${data.mainBreaker} A` : ''],
      ['Lugar de paneles', data.installPlace], ['Área', data.roofArea], ['Orientación', data.orientation], ['Inclinación', data.tilt], ['Sombras', data.shading], ['Distancia al tablero', data.roofBoardDistance ? `${data.roofBoardDistance} m` : ''],
      ['Respaldo', data.backupHours], ['Autonomía', data.autonomyDays], ['Preferencia de batería', data.batteryPreference]
    ].filter(([, value]) => value !== '' && value !== false && value != null);
    const fieldRows = fields.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(String(value))}</td></tr>`).join('');
    const pumpBlock = data.systemType === 'Sistema de bombeo solar' ? `
      <h2>Datos de bombeo</h2>
      <table class="data"><tr><th>Aplicación</th><td>${escapeHtml(data.pumpUse || '')}</td><th>Tipo de bomba</th><td>${escapeHtml(data.pumpType || '')}</td></tr>
      <tr><th>Potencia</th><td>${escapeHtml(data.pumpHp || '—')} HP / ${escapeHtml(data.pumpKw || '—')} kW</td><th>Tensión</th><td>${escapeHtml(data.pumpVoltage || '')}</td></tr>
      <tr><th>Caudal diario</th><td>${escapeHtml(data.dailyWater || '—')} m³/día</td><th>Profundidad</th><td>${escapeHtml(data.waterDepth || '—')} m</td></tr>
      <tr><th>Altura al tanque</th><td>${escapeHtml(data.tankHeight || '—')} m</td><th>Distancia horizontal</th><td>${escapeHtml(data.horizontalDistance || '—')} m</td></tr></table>` : '';

    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Solicitud Solar - ${escapeHtml(data.clientName || 'Cliente')}</title><style>
      @page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;color:#183846;font-size:11px;line-height:1.45;margin:0}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f7941d;padding-bottom:10px;margin-bottom:14px}.brand-logo{width:210px;height:92px;object-fit:contain}.logo{font-size:22px;font-weight:800;color:#f7941d}.legal{text-align:right;font-size:9px;color:#526a75}h1{font-size:18px;color:#0b2a3b;margin:0 0 4px}h2{font-size:13px;color:#0b2a3b;border-left:4px solid #f7941d;padding-left:7px;margin:18px 0 8px}.meta{color:#607680;margin-bottom:12px}.data{width:100%;border-collapse:collapse}.data th,.data td{border:1px solid #ccd7dc;padding:6px;text-align:left;vertical-align:top}.data th{background:#edf2f4;width:20%;color:#244653}.loads{width:100%;border-collapse:collapse;font-size:9px}.loads th,.loads td{border:1px solid #ccd7dc;padding:5px;text-align:center}.loads th{background:#0b2a3b;color:white}.metrics{display:flex;gap:8px;margin:8px 0}.metrics div{flex:1;background:#edf2f4;border-radius:7px;padding:8px;text-align:center}.metrics strong{display:block;color:#0b2a3b;font-size:13px}.note{background:#fff4de;border:1px solid #efd29a;padding:9px;border-radius:8px;margin-top:14px}.signature{margin-top:28px;text-align:center}.signature strong,.signature span{display:block}.photos{columns:2}.small{font-size:9px;color:#5d727c}</style></head><body>
      <header><div><img class="brand-logo" src="${logoDataUrl || new URL('assets/logo.png', location.href).href}" alt="ENERGÉTICOS"></div><div class="legal"><strong>${COMPANY.legal}</strong><br>RUC ${COMPANY.ruc}<br>${COMPANY.address}<br>${COMPANY.phone} · ${COMPANY.email}</div></header>
      <h1>Ficha de recopilación de datos para diseño fotovoltaico</h1><div class="meta">Fecha: ${new Date().toLocaleString('es-PE')} · Documento generado por la aplicación ENERGÉTICOS Solar</div>
      <h2>Datos del proyecto</h2><table class="data">${fieldRows}</table>
      <h2>Inventario de cargas</h2><table class="loads"><thead><tr><th>Equipo</th><th>Cant.</th><th>W</th><th>h/día</th><th>Horario</th><th>Crítica</th><th>kWh/día</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="metrics"><div><span>Potencia conectada</span><strong>${formatNum(metrics.connectedW / 1000, 2)} kW</strong></div><div><span>Energía diaria</span><strong>${formatNum(metrics.dailyKwh, 2)} kWh/día</strong></div><div><span>Energía crítica</span><strong>${formatNum(metrics.criticalKwh, 2)} kWh/día</strong></div></div>
      ${pumpBlock}
      <h2>Fotografías adjuntas al expediente</h2><ul class="photos">${photoRows}</ul>
      ${data.expectation ? `<h2>Expectativa del cliente</h2><p>${escapeHtml(data.expectation)}</p>` : ''}
      ${data.finalNotes ? `<h2>Observaciones finales</h2><p>${escapeHtml(data.finalNotes)}</p>` : ''}
      <div class="note"><strong>Alcance:</strong> La información fue proporcionada por el cliente para elaborar una evaluación, diseño y cotización preliminar. Antes de ejecutar la instalación, ENERGÉTICOS podrá solicitar verificación técnica, mediciones o datos complementarios.</div>
      <div class="signature"><strong>${COMPANY.engineer}</strong><span>${COMPANY.profession} · CIP ${COMPANY.cip}</span><span>Especialista en Sistemas Fotovoltaicos y Térmicos</span><span>${COMPANY.brand}</span></div>
      <p class="small">${COMPANY.legal} · RUC ${COMPANY.ruc}</p>
    </body></html>`;
  }

  function loadsCsv() {
    const rows = [['Equipo', 'Cantidad', 'Potencia_W', 'Horas_dia', 'Horario', 'Carga_critica', 'Energia_kWh_dia']];
    loads.forEach(load => rows.push([
      load.name, load.qty, load.watts, load.hours, load.usage, load.critical ? 'Sí' : 'No',
      (Number(load.qty || 0) * Number(load.watts || 0) * Number(load.hours || 0) / 1000).toFixed(3)
    ]));
    return '\ufeff' + rows.map(row => row.map(csvEscape).join(';')).join('\r\n');
  }

  function backupJson() {
    return JSON.stringify({
      application: 'ENERGÉTICOS · Datos para Diseño Solar',
      generatedAt: new Date().toISOString(), company: COMPANY,
      clientData: serializeForm(), loads, metrics: loadMetrics(),
      photos: allPhotoRecords().map(photo => ({ id: photo.id, category: photo.category, label: PHOTO_LABELS[photo.category] || photo.category, name: photo.name, type: photo.type, createdAt: photo.createdAt }))
    }, null, 2);
  }

  function photoFileName(record, index) {
    const ext = record.type === 'image/png' ? 'png' : 'jpg';
    const label = safeName(PHOTO_LABELS[record.category] || record.category);
    return `fotos/${label}_${String(index + 1).padStart(2, '0')}.${ext}`;
  }

  async function buildDossierZip() {
    await loadLogoDataUrl();
    const data = serializeForm();
    const client = safeName(data.clientName);
    const entries = [
      { name: '01_Informe_Solicitud_Solar.html', data: new Blob([reportHtml()], { type: 'text/html;charset=utf-8' }) },
      { name: '02_Resumen_WhatsApp.txt', data: new Blob([buildSummary()], { type: 'text/plain;charset=utf-8' }) },
      { name: '03_Inventario_Cargas.csv', data: new Blob([loadsCsv()], { type: 'text/csv;charset=utf-8' }) },
      { name: '04_Respaldo_Datos.json', data: new Blob([backupJson()], { type: 'application/json;charset=utf-8' }) }
    ];
    allPhotoRecords().forEach((record, index) => entries.push({ name: photoFileName(record, index), data: record.blob }));
    const blob = await createZip(entries);
    return new File([blob], `ENERGETICOS_Expediente_${client}_${todayISO()}.zip`, { type: 'application/zip' });
  }

  function bindFinalActions() {
    $('#copySummary').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(buildSummary()); toast('Resumen copiado.'); }
      catch (_) { fallbackCopy(buildSummary()); }
    });

    $('#whatsappBtn').addEventListener('click', () => {
      const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(buildSummary())}`;
      window.open(url, '_blank', 'noopener');
    });

    $('#shareDossierBtn').addEventListener('click', async () => {
      const button = $('#shareDossierBtn');
      button.disabled = true;
      button.textContent = 'Preparando expediente…';
      try {
        const file = await buildDossierZip();
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: `Solicitud solar - ${getValue('clientName') || 'Cliente'}`,
            text: 'Expediente técnico preliminar y fotografías para ENERGÉTICOS.',
            files: [file]
          });
          toast('Expediente compartido.');
        } else {
          downloadBlob(file, file.name);
          toast('Expediente descargado. Envíelo por WhatsApp o correo.');
        }
      } catch (error) {
        if (error?.name !== 'AbortError') {
          console.error(error);
          toast('No se pudo preparar el expediente. Inténtelo nuevamente.');
        }
      } finally {
        button.disabled = false;
        button.textContent = 'Compartir expediente y fotografías';
      }
    });

    $('#printReportBtn').addEventListener('click', async () => {
      const win = window.open('', '_blank');
      if (!win) return toast('Permita las ventanas emergentes para generar el informe.');
      await loadLogoDataUrl();
      win.document.open();
      win.document.write(reportHtml());
      win.document.close();
      win.onload = () => setTimeout(() => win.print(), 250);
    });

    $('#downloadBackupBtn').addEventListener('click', async () => {
      const button = $('#downloadBackupBtn');
      button.disabled = true;
      try {
        const file = await buildDossierZip();
        downloadBlob(file, file.name);
        toast('Respaldo descargado.');
      } finally { button.disabled = false; }
    });

    $('#newRequestBtn').addEventListener('click', async () => {
      if (!confirm('¿Desea borrar los datos y fotografías de esta solicitud para comenzar otra?')) return;
      localStorage.removeItem(APP_KEY);
      await dbClearPhotos();
      form.reset();
      loads = [];
      photos = {};
      renderLoads();
      Object.keys(PHOTO_LABELS).forEach(renderPhotoCategory);
      updateSupplyFields();
      updateRoofArea();
      showStep(0);
      toast('Nueva solicitud iniciada.');
    });
  }

  function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try { document.execCommand('copy'); toast('Resumen copiado.'); }
    catch (_) { toast('No se pudo copiar el resumen.'); }
    textarea.remove();
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function csvEscape(value) {
    const text = String(value ?? '');
    return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  }

  function bindInstall() {
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      deferredInstallPrompt = event;
      $('#installBtn').title = 'Instalar aplicación en el celular';
    });

    $('#installBtn').addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        return;
      }
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const instructions = isIOS
        ? '<p>En Safari, toque el botón <strong>Compartir</strong> y luego <strong>Agregar a pantalla de inicio</strong>.</p>'
        : '<p>Abra el menú del navegador (⋮) y seleccione <strong>Instalar aplicación</strong> o <strong>Agregar a pantalla principal</strong>.</p><p>La instalación requiere que la aplicación esté publicada en una dirección HTTPS, como GitHub Pages.</p>';
      $('#installInstructions').innerHTML = instructions;
      $('#installDialog').showModal();
    });

    window.addEventListener('appinstalled', () => toast('Aplicación instalada correctamente.'));
  }

  function updateNetworkStatus() {
    const online = navigator.onLine;
    $('#netStatus').textContent = online ? 'En línea' : 'Sin conexión';
    $('#netStatus').classList.toggle('offline', !online);
  }

  function startHeroRotation() {
    const images = ['obra-02.webp', 'obra-04.webp', 'obra-08.webp', 'obra-10.webp', 'obra-13.webp', 'obra-18.webp'];
    let index = 0;
    const img = $('#heroImage');
    clearInterval(heroTimer);
    heroTimer = setInterval(() => {
      index = (index + 1) % images.length;
      img.style.opacity = '0';
      setTimeout(() => { img.src = `assets/gallery/${images[index]}`; img.style.opacity = '1'; }, 260);
    }, 4800);
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(error => console.warn('Service worker:', error));
    }
  }

  // ZIP sin compresión, compatible con lectores estándar. Evita dependencias externas.
  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
    const day = (year - 1980) << 9 | (date.getMonth() + 1) << 5 | date.getDate();
    return { time, day };
  }

  function concatArrays(arrays) {
    const total = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    arrays.forEach(arr => { out.set(arr, offset); offset += arr.length; });
    return out;
  }

  function writeHeader(size, writer) {
    const buffer = new ArrayBuffer(size);
    const view = new DataView(buffer);
    writer(view);
    return new Uint8Array(buffer);
  }

  async function createZip(entries) {
    const encoder = new TextEncoder();
    const locals = [];
    const centrals = [];
    let offset = 0;
    const { time, day } = dosDateTime();

    for (const entry of entries) {
      const nameBytes = encoder.encode(entry.name.replace(/\\/g, '/'));
      const dataBytes = new Uint8Array(await entry.data.arrayBuffer());
      const crc = crc32(dataBytes);
      const local = writeHeader(30, view => {
        view.setUint32(0, 0x04034b50, true);
        view.setUint16(4, 20, true);
        view.setUint16(6, 0x0800, true);
        view.setUint16(8, 0, true);
        view.setUint16(10, time, true);
        view.setUint16(12, day, true);
        view.setUint32(14, crc, true);
        view.setUint32(18, dataBytes.length, true);
        view.setUint32(22, dataBytes.length, true);
        view.setUint16(26, nameBytes.length, true);
        view.setUint16(28, 0, true);
      });
      locals.push(local, nameBytes, dataBytes);

      const central = writeHeader(46, view => {
        view.setUint32(0, 0x02014b50, true);
        view.setUint16(4, 20, true);
        view.setUint16(6, 20, true);
        view.setUint16(8, 0x0800, true);
        view.setUint16(10, 0, true);
        view.setUint16(12, time, true);
        view.setUint16(14, day, true);
        view.setUint32(16, crc, true);
        view.setUint32(20, dataBytes.length, true);
        view.setUint32(24, dataBytes.length, true);
        view.setUint16(28, nameBytes.length, true);
        view.setUint16(30, 0, true);
        view.setUint16(32, 0, true);
        view.setUint16(34, 0, true);
        view.setUint16(36, 0, true);
        view.setUint32(38, 0, true);
        view.setUint32(42, offset, true);
      });
      centrals.push(central, nameBytes);
      offset += local.length + nameBytes.length + dataBytes.length;
    }

    const centralBytes = concatArrays(centrals);
    const eocd = writeHeader(22, view => {
      view.setUint32(0, 0x06054b50, true);
      view.setUint16(4, 0, true);
      view.setUint16(6, 0, true);
      view.setUint16(8, entries.length, true);
      view.setUint16(10, entries.length, true);
      view.setUint32(12, centralBytes.length, true);
      view.setUint32(16, offset, true);
      view.setUint16(20, 0, true);
    });
    return new Blob([concatArrays([...locals, centralBytes, eocd])], { type: 'application/zip' });
  }

  async function init() {
    loadState();
    renderPresets();
    renderLoads();
    bindNavigation();
    bindDialogs();
    bindChoiceCards();
    bindFormBehavior();
    bindPhotoUploaders();
    bindFinalActions();
    bindInstall();
    await loadPhotos();
    await loadLogoDataUrl();
    updateSupplyFields();
    updateSpecialSection();
    updateRoofArea();
    $$('.choice-card').forEach(card => card.classList.toggle('selected', card.querySelector('input').checked));
    showStep(currentStep, { scroll: false });
    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    startHeroRotation();
    registerServiceWorker();
  }

  init().catch(error => {
    console.error(error);
    toast('La aplicación encontró un problema al iniciar. Recargue la página.');
  });
})();
