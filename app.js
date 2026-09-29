(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const ui = {
    languageSelect: $('languageSelect'), languagePicker: $('languagePicker'), languageButton: $('languageButton'),
    languageMenu: $('languageMenu'), currentFlag: $('currentFlag'), currentLanguage: $('currentLanguage'),
    projectName: $('projectName'), profileList: $('profileList'), addProfileButton: $('addProfileButton'),
    profileName: $('profileName'), material: $('material'),
    sectionType: $('sectionType'), dimensionFields: $('dimensionFields'), stockBody: $('stockBody'),
    addStockButton: $('addStockButton'), kerf: $('kerf'), cutsBody: $('cutsBody'), addCutButton: $('addCutButton'),
    templateButton: $('templateButton'), saveProjectButton: $('saveProjectButton'), excelInput: $('excelInput'), optimizeButton: $('optimizeButton'),
    message: $('message'), resultContent: $('resultContent'), resultSubtitle: $('resultSubtitle'),
    metricBars: $('metricBars'), metricUsage: $('metricUsage'), metricPieces: $('metricPieces'),
    metricWaste: $('metricWaste'), profileBadge: $('profileBadge'), barsVisual: $('barsVisual'),
    patternsBody: $('patternsBody'), printButton: $('printButton'), exportButton: $('exportButton')
  };

  const translations = window.PipeSaverI18n?.translations || { 'pt-BR': {} };
  const languageMeta = window.PipeSaverI18n?.meta || { 'pt-BR': { label:'Português', flag:'br' } };
  const languageCodes = Object.keys(languageMeta);
  function initialLanguage() {
    let saved = '';
    try { saved = localStorage.getItem('pipesaver-language') || ''; } catch (_) {}
    if (languageCodes.includes(saved)) return saved;
    return 'pt-BR';
  }

  const sectionDefinitions = {
    roundTube: { labelKey: 'roundTube', fields: [['diameter', 'outerDiameter', 60], ['thickness', 'thickness', 3]] },
    squareTube: { labelKey: 'squareTube', fields: [['side', 'side', 50], ['thickness', 'thickness', 3]] },
    rectTube: { labelKey: 'rectTube', fields: [['width', 'width', 80], ['height', 'height', 40], ['thickness', 'thickness', 3]] },
    roundBar: { labelKey: 'roundBar', fields: [['diameter', 'diameter', 30]] },
    flatBar: { labelKey: 'flatBar', fields: [['width', 'width', 50], ['thickness', 'thickness', 6]] },
    angle: { labelKey: 'angle', fields: [['legA', 'legA', 50], ['legB', 'legB', 50], ['thickness', 'thickness', 5]] },
    custom: { labelKey: 'customProfile', fields: [['description', 'sectionDescription', 'Perfil especial', 'text']] }
  };
  const palette = ['#0c8b84', '#ef7b3d', '#5078a5', '#a56d9d', '#c49332', '#4595aa', '#a95d63', '#668c55', '#7769ad'];
  const state = { profiles: [], stocks: [], cuts: [], activeProfileId: null, nextProfileId: 1, nextStockId: 1, nextCutId: 1, result: null, language: initialLanguage() };

  function t(key, values = {}) {
    const template = translations[state.language]?.[key] ?? translations['en-US']?.[key] ?? translations['pt-BR']?.[key] ?? key;
    return String(template).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? `{${name}}`);
  }
  function sectionLabel(type) { return t(sectionDefinitions[type]?.labelKey || 'customProfile'); }
  function formatNumber(value, digits = 1) { return Number(value).toLocaleString(state.language, { maximumFractionDigits: digits }); }
  function numberFrom(value) {
    if (typeof value === 'number') return value;
    let text = String(value ?? '').trim().replace(/\s/g, '');
    if (text.includes(',') && text.includes('.')) text = text.replace(/\./g, '').replace(',', '.');
    else if (text.includes(',')) text = text.replace(',', '.');
    return Number.parseFloat(text);
  }
  function booleanFrom(value) { return ['1', 'true', 'sim', 'yes', 'x', 'priorizar', 'prioritario', 'prioritaria'].includes(normalizeHeader(value)); }
  function normalizeHeader(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
  function safeFileName(value) { return String(value || 'pipesaver').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'pipesaver'; }
  function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; }
  function setMessage(text, type = '') { ui.message.textContent = text; ui.message.className = `message ${type}`.trim(); }
  function setLanguageMenu(open) {
    ui.languageMenu.hidden = !open;
    ui.languageButton.setAttribute('aria-expanded', String(open));
    if (open) ui.languageMenu.querySelector(`[data-language="${state.language}"]`)?.focus();
  }
  function applyLanguage(language, persist = true) {
    if (state.profiles.length) serializeActiveProfile();
    state.language = languageCodes.includes(language) ? language : 'pt-BR';
    document.documentElement.lang = state.language;
    document.documentElement.dir = state.language.startsWith('ar') ? 'rtl' : 'ltr';
    document.title = t('pageTitle');
    const meta = languageMeta[state.language];
    ui.languageSelect.value = state.language;
    ui.currentFlag.src = `flags/${meta.flag}.svg`;
    ui.currentFlag.alt = '';
    ui.currentLanguage.textContent = meta.label;
    ui.languageButton.setAttribute('aria-label', t('languageLabel', { language:meta.label }));
    ui.languageMenu.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.language === state.language)));
    document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => { element.placeholder = t(element.dataset.i18nPlaceholder); });
    if (state.profiles.length) { renderActiveProfile(); renderRelationRows(); }
    if (state.result) renderResult(state.result);
    if (persist) try { localStorage.setItem('pipesaver-language', state.language); } catch (_) {}
  }
  function invalidateResult() {
    if (!state.result) return;
    state.result = null; ui.resultContent.hidden = true; ui.exportButton.disabled = ui.printButton.disabled = true;
    ui.resultSubtitle.textContent = t('changedData');
  }
  function defaultDimensions(type) {
    return Object.fromEntries(sectionDefinitions[type].fields.map(([key, , value]) => [key, value]));
  }
  function makeProfile(name = t('profileDefault', { number:state.nextProfileId })) {
    const profileNumber = state.nextProfileId++;
    return {
      id: `profile-${profileNumber}`, name, material: t('carbonSteel'), type: 'rectTube', dimensions: defaultDimensions('rectTube')
    };
  }
  function activeProfile() { return state.profiles.find(profile => profile.id === state.activeProfileId); }

  function updateProfileOptions() {
    ui.profileList.innerHTML = '';
    state.profiles.forEach((profile, index) => {
      const row = document.createElement('div'); row.className = `profile-list-item${profile.id === state.activeProfileId ? ' active' : ''}`; row.dataset.profileId = profile.id; row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(profile.id === state.activeProfileId));
      const fallbackName = t('profileDefault', { number:index + 1 });
      const select = document.createElement('button'); select.type = 'button'; select.className = 'profile-list-select'; select.innerHTML = `<strong>${escapeHtml(profile.name || fallbackName)}</strong><small>${escapeHtml(sectionLabel(profile.type))} · ${escapeHtml(profileDescription(profile))}</small>`;
      select.addEventListener('click', () => { if (state.activeProfileId === profile.id) return; serializeActiveProfile(); state.activeProfileId = profile.id; renderActiveProfile(); });
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'profile-list-remove'; remove.title = t('removeProfile'); remove.setAttribute('aria-label', t('removeNamed', { name:profile.name || fallbackName })); remove.textContent = '×'; remove.disabled = state.profiles.length === 1; remove.addEventListener('click', () => removeProfile(profile.id));
      row.append(select, remove); ui.profileList.appendChild(row);
    });
    refreshRelationSelects();
  }
  function profileOptionsMarkup(selectedId) {
    return state.profiles.map((profile, index) => `<option value="${profile.id}"${profile.id === selectedId ? ' selected' : ''}>${escapeHtml(profile.name || t('profileDefault', { number:index + 1 }))}</option>`).join('');
  }
  function refreshRelationSelects() {
    document.querySelectorAll('.stock-profile, .cut-profile').forEach(select => {
      const selected = state.profiles.some(profile => profile.id === select.value) ? select.value : state.profiles[0]?.id;
      select.innerHTML = profileOptionsMarkup(selected);
    });
  }
  function renderDimensionFields(profile) {
    const definition = sectionDefinitions[profile.type];
    ui.dimensionFields.innerHTML = '';
    ui.dimensionFields.style.gridTemplateColumns = `repeat(${Math.min(3, definition.fields.length)}, minmax(0, 1fr))`;
    definition.fields.forEach(([key, labelKey, initial, kind]) => {
      const wrapper = document.createElement('label'); wrapper.className = 'field';
      const inputType = kind === 'text' ? 'text' : 'number', value = profile.dimensions[key] ?? initial;
      wrapper.innerHTML = `<span>${escapeHtml(t(labelKey))}${inputType === 'number' ? ' (mm)' : ''}</span><input data-dimension="${key}" type="${inputType}" value="${String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"${inputType === 'number' ? ' min="0.01" step="0.1"' : ' maxlength="80"'}>`;
      wrapper.querySelector('input').addEventListener('change', invalidateResult);
      ui.dimensionFields.appendChild(wrapper);
    });
  }
  function updateStockRemoveButtons() {
    const buttons = [...ui.stockBody.querySelectorAll('.remove-stock')];
    buttons.forEach(button => { button.disabled = buttons.length === 1; });
  }
  function addStockRow(values = {}, focus = false) {
    const row = document.createElement('div'); row.className = 'stock-row'; row.dataset.stockId = values.id || `stock-${state.nextStockId++}`;
    const profileId = values.profileId || state.activeProfileId || state.profiles[0]?.id;
    row.innerHTML = `<select class="stock-profile" aria-label="${escapeHtml(t('stockProfile'))}">${profileOptionsMarkup(profileId)}</select><input class="stock-length" type="number" value="${values.length ?? 6000}" min="1" step="0.1" aria-label="${escapeHtml(t('stockLength'))}"><input class="stock-quantity" type="number" value="${values.quantity ?? 1}" min="1" max="9999" step="1" aria-label="${escapeHtml(t('stockQuantity'))}"><label class="stock-priority-label" title="${escapeHtml(t('priorityHelp'))}"><input class="stock-priority" type="checkbox"${values.priority ? ' checked' : ''} aria-label="${escapeHtml(t('priorityBar'))}"></label><button class="remove-stock" type="button" title="${escapeHtml(t('removeBar'))}" aria-label="${escapeHtml(t('removeBar'))}">×</button>`;
    row.querySelectorAll('input,select').forEach(element => element.addEventListener('change', invalidateResult));
    row.querySelector('.remove-stock').addEventListener('click', () => { if (ui.stockBody.children.length <= 1) return; row.remove(); updateStockRemoveButtons(); syncRelationRows(); invalidateResult(); });
    ui.stockBody.appendChild(row); updateStockRemoveButtons(); if (focus) row.querySelector('.stock-length').focus(); return row;
  }
  function updateCutRemoveButtons() {
    const buttons = [...ui.cutsBody.querySelectorAll('.remove-cut')];
    buttons.forEach(button => { button.disabled = buttons.length === 1; });
  }
  function addCutRow(values = {}, focus = false) {
    const row = document.createElement('div'); row.className = 'cut-row'; row.dataset.rowId = values.rowId || `cut-${state.nextCutId++}`;
    row.dataset.observation = values.observation || '';
    const profileId = values.profileId || state.activeProfileId || state.profiles[0]?.id;
    row.innerHTML = `<select class="cut-input cut-profile" aria-label="${escapeHtml(t('cutProfile'))}">${profileOptionsMarkup(profileId)}</select><input class="cut-input cut-id" value="${String(values.id ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" placeholder="Ex.: P01" maxlength="60" aria-label="${escapeHtml(t('pieceIdentification'))}"><input class="cut-input cut-length" type="number" value="${values.length ?? ''}" placeholder="0" min="0.01" step="0.1" aria-label="${escapeHtml(t('pieceLength'))}"><input class="cut-input cut-quantity" type="number" value="${values.quantity ?? 1}" min="1" max="9999" step="1" aria-label="${escapeHtml(t('pieceQuantity'))}"><button class="remove-cut" type="button" title="${escapeHtml(t('removeMeasure'))}" aria-label="${escapeHtml(t('removeMeasure'))}">×</button>`;
    row.querySelectorAll('input,select').forEach(input => input.addEventListener('change', invalidateResult));
    row.querySelector('.remove-cut').addEventListener('click', () => { if (ui.cutsBody.children.length <= 1) return; row.remove(); updateCutRemoveButtons(); syncRelationRows(); invalidateResult(); });
    ui.cutsBody.appendChild(row); updateCutRemoveButtons(); if (focus) row.querySelector('.cut-id').focus(); return row;
  }
  function syncRelationRows() {
    state.stocks = [...ui.stockBody.querySelectorAll('.stock-row')].map(row => ({ id: row.dataset.stockId, profileId: row.querySelector('.stock-profile').value, length: row.querySelector('.stock-length').value, quantity: row.querySelector('.stock-quantity').value, priority: row.querySelector('.stock-priority').checked }));
    state.cuts = [...ui.cutsBody.querySelectorAll('.cut-row')].map(row => ({ rowId: row.dataset.rowId, profileId: row.querySelector('.cut-profile').value, id: row.querySelector('.cut-id').value, length: row.querySelector('.cut-length').value, quantity: row.querySelector('.cut-quantity').value, observation: row.dataset.observation || '' }));
  }
  function renderRelationRows() {
    ui.stockBody.innerHTML = '';
    (state.stocks.length ? state.stocks : [{ profileId: state.profiles[0]?.id, length: 6000, quantity: 1, priority: false }]).forEach(stock => addStockRow(stock));
    ui.cutsBody.innerHTML = '';
    (state.cuts.length ? state.cuts : [{ profileId: state.profiles[0]?.id, id: '', length: '', quantity: 1 }]).forEach(cut => addCutRow(cut));
    syncRelationRows();
  }
  function serializeActiveProfile() {
    const profile = activeProfile(); if (!profile) return;
    profile.name = ui.profileName.value.trim() || ui.profileName.value;
    profile.material = ui.material.value;
    profile.type = ui.sectionType.value;
    profile.dimensions = {};
    ui.dimensionFields.querySelectorAll('[data-dimension]').forEach(input => { profile.dimensions[input.dataset.dimension] = input.value; });
    syncRelationRows();
  }
  function renderActiveProfile() {
    const profile = activeProfile(); if (!profile) return;
    updateProfileOptions(); ui.profileName.value = profile.name; ui.material.value = profile.material; ui.sectionType.value = profile.type;
    renderDimensionFields(profile);
  }
  function removeProfile(profileId) {
    if (state.profiles.length <= 1) return;
    serializeActiveProfile();
    const index = state.profiles.findIndex(profile => profile.id === profileId); if (index < 0) return;
    state.profiles.splice(index, 1); state.stocks = state.stocks.filter(stock => stock.profileId !== profileId); state.cuts = state.cuts.filter(cut => cut.profileId !== profileId);
    if (state.activeProfileId === profileId) state.activeProfileId = state.profiles[Math.max(0, index - 1)].id;
    renderActiveProfile(); renderRelationRows(); invalidateResult(); setMessage(t('profileRemoved'));
  }

  function profileDescription(profile) {
    const d = profile.dimensions;
    switch (profile.type) {
      case 'roundTube': return `Ø ${formatNumber(d.diameter)} × ${formatNumber(d.thickness)} mm`;
      case 'squareTube': return `${formatNumber(d.side)} × ${formatNumber(d.side)} × ${formatNumber(d.thickness)} mm`;
      case 'rectTube': return `${formatNumber(d.width)} × ${formatNumber(d.height)} × ${formatNumber(d.thickness)} mm`;
      case 'roundBar': return `Ø ${formatNumber(d.diameter)} mm`;
      case 'flatBar': return `${formatNumber(d.width)} × ${formatNumber(d.thickness)} mm`;
      case 'angle': return `${formatNumber(d.legA)} × ${formatNumber(d.legB)} × ${formatNumber(d.thickness)} mm`;
      default: return String(d.description || t('customDescription'));
    }
  }
  function validatedDimensions(profile) {
    const dimensions = {};
    for (const [key, labelKey, , kind] of sectionDefinitions[profile.type].fields) {
      const raw = profile.dimensions[key];
      if (kind === 'text') { if (!String(raw || '').trim()) throw new Error(`Informe a descrição da seção em “${profile.name}”.`); dimensions[key] = String(raw).trim(); }
      else { const value = numberFrom(raw); if (!(value > 0)) throw new Error(`Informe ${t(labelKey).toLowerCase()} válido em “${profile.name}”.`); dimensions[key] = value; }
    }
    return dimensions;
  }
  function readProjectConfig() {
    serializeActiveProfile();
    const kerf = numberFrom(ui.kerf.value);
    if (!(kerf >= 0)) throw new Error('A espessura de corte não pode ser negativa.');
    const configuredProfiles = []; let totalPieces = 0;
    state.profiles.forEach((profile, profileIndex) => {
      const cuts = [];
      state.cuts.filter(cut => cut.profileId === profile.id).forEach((cut, rowIndex) => {
        const rawLength = String(cut.length ?? '').trim(); if (!rawLength) return;
        const length = numberFrom(rawLength), quantity = Math.trunc(numberFrom(cut.quantity));
        if (!(length > 0)) throw new Error(`Comprimento inválido no perfil “${profile.name}”, linha ${rowIndex + 1}.`);
        if (!(quantity >= 1 && quantity <= 9999)) throw new Error(`Quantidade inválida no perfil “${profile.name}”, linha ${rowIndex + 1}.`);
        cuts.push({ id: String(cut.id || '').trim() || `P${String(rowIndex + 1).padStart(2, '0')}`, length, quantity, observation:cut.observation || '', colorIndex: cuts.length }); totalPieces += quantity;
      });
      if (!cuts.length) return;
      const stocks = state.stocks.filter(stock => stock.profileId === profile.id).map((stock, stockIndex) => {
        const length = numberFrom(stock.length), quantity = Math.trunc(numberFrom(stock.quantity));
        if (!(length > 0)) throw new Error(`Comprimento de barra inválido no perfil “${profile.name}”.`);
        if (!(quantity >= 1 && quantity <= 9999)) throw new Error(`Quantidade de barras inválida no perfil “${profile.name}”.`);
        return { id: stock.id || `stock-${profileIndex}-${stockIndex}`, kind: 'commercial', labelKey: stock.priority ? 'preferredBar' : 'availableBar', length, quantity, priority: Boolean(stock.priority) };
      });
      if (!stocks.length) throw new Error(`Adicione pelo menos uma barra ao perfil “${profile.name}”.`);
      const largest = Math.max(...stocks.map(stock => stock.length));
      const oversized = cuts.find(cut => cut.length > largest + 1e-7);
      if (oversized) throw new Error(`A peça “${oversized.id}” do perfil “${profile.name}” é maior que todas as barras disponíveis.`);
      const type = sectionDefinitions[profile.type] ? profile.type : 'custom';
      const normalized = { id: profile.id, name: profile.name.trim() || t('profileDefault', { number:profileIndex + 1 }), material: profile.material.trim() || t('notProvided'), type, dimensions: validatedDimensions({ ...profile, type }), kerf, stockTypes: stocks, cuts };
      configuredProfiles.push(normalized);
    });
    if (!configuredProfiles.length) throw new Error('Adicione medidas a pelo menos um perfil do projeto.');
    if (totalPieces > 5000) throw new Error('Esta versão aceita até 5.000 peças por projeto.');
    return { projectName: ui.projectName.value.trim() || 'Nova lista de corte', profiles: configuredProfiles };
  }

  function seededRandom(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let value = Math.imul(seed ^ seed >>> 15, 1 | seed); value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value; return ((value ^ value >>> 14) >>> 0) / 4294967296; }; }
  function binMeasurements(items, stockLength, kerf) {
    const productLength = items.reduce((sum, item) => sum + item.length, 0), internalKerf = Math.max(0, items.length - 1) * kerf;
    const remainderBeforeFinalCut = Math.max(0, stockLength - productLength - internalKerf), finalKerf = remainderBeforeFinalCut > 1e-7 ? Math.min(kerf, remainderBeforeFinalCut) : 0;
    const kerfLoss = internalKerf + finalKerf, used = productLength + kerfLoss;
    return { productLength, kerfLoss, used, waste: Math.max(0, stockLength - used), utilization: productLength / stockLength * 100 };
  }
  function projectedRemainder(type, firstItem, futureItems, kerf) {
    let remaining = type.length + kerf - firstItem.effective;
    for (const item of futureItems) if (item.effective <= remaining + 1e-7) remaining -= item.effective;
    return remaining;
  }
  function packMixedOrder(order, config, strategy, random) {
    const bins = [], usage = new Map(config.stockTypes.map(type => [type.id, 0]));
    for (let itemIndex = 0; itemIndex < order.length; itemIndex++) {
      const item = order[itemIndex]; let selected = null, bestRemainder = Infinity;
      const available = config.stockTypes.filter(type => (type.quantity === null || (usage.get(type.id) || 0) < type.quantity) && item.length <= type.length + 1e-7);
      bins.filter(bin => bin.stockType.priority).forEach(bin => { const remainder = bin.capacity - bin.effectiveUsed - item.effective; if (remainder >= -1e-7 && remainder < bestRemainder) { selected = bin; bestRemainder = remainder; } });
      if (selected) { selected.items.push(item); selected.effectiveUsed += item.effective; continue; }
      const priorityAvailable = available.filter(type => type.priority);
      if (!priorityAvailable.length) {
        bins.forEach(bin => { const remainder = bin.capacity - bin.effectiveUsed - item.effective; if (remainder >= -1e-7 && remainder < bestRemainder) { selected = bin; bestRemainder = remainder; } });
        if (selected) { selected.items.push(item); selected.effectiveUsed += item.effective; continue; }
      }
      if (!available.length) return null;
      const future = order.slice(itemIndex + 1);
      const ranked = (priorityAvailable.length ? priorityAvailable : available).map(type => {
        const projected = projectedRemainder(type, item, future, config.kerf);
        let score;
        if (strategy === 0) score = type.length;
        else if (strategy === 1) score = projected + type.length * 1e-5;
        else if (strategy === 2) score = -type.length;
        else if (strategy === 3) score = (type.priority ? -1e9 : 0) + projected;
        else score = projected * (.75 + random() * .5) + type.length * random() * .08;
        return { type, score };
      }).sort((a, b) => a.score - b.score);
      const type = ranked[0].type; usage.set(type.id, (usage.get(type.id) || 0) + 1);
      bins.push({ stockType: type, stockLength: type.length, capacity: type.length + config.kerf, effectiveUsed: item.effective, items: [item] });
    }
    return bins;
  }
  function candidateSummary(bins, config) {
    const totalStockLength = bins.reduce((sum, bin) => sum + bin.stockLength, 0);
    const concentratedWaste = bins.reduce((sum, bin) => { const waste = binMeasurements(bin.items, bin.stockLength, config.kerf).waste; return sum + waste * waste; }, 0);
    const priorityBars = bins.reduce((sum, bin) => sum + (bin.stockType.priority ? 1 : 0), 0);
    return { totalStockLength, barCount: bins.length, concentratedWaste, priorityBars };
  }
  function betterCandidate(candidate, best, config) {
    if (!best) return true;
    const a = candidateSummary(candidate, config), b = candidateSummary(best, config);
    return a.priorityBars > b.priorityBars || (a.priorityBars === b.priorityBars && (a.totalStockLength < b.totalStockLength - 1e-7 || (Math.abs(a.totalStockLength - b.totalStockLength) <= 1e-7 && (a.barCount < b.barCount || (a.barCount === b.barCount && a.concentratedWaste > b.concentratedWaste + 1e-7)))));
  }
  function exactImprove(items, capacity, initialBins, timeBudgetMs = 700) {
    if (items.length > 44) return { bins: initialBins, completed: false };
    const lowerBound = Math.ceil(items.reduce((sum, item) => sum + item.effective, 0) / capacity - 1e-10);
    if (initialBins.length === lowerBound) return { bins: initialBins, completed: true };
    const ordered = [...items].sort((a, b) => b.effective - a.effective), suffix = new Array(items.length + 1).fill(0);
    for (let i = ordered.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + ordered[i].effective;
    const deadline = performance.now() + timeBudgetMs, loads = [], contents = []; let best = initialBins.map(bin => ({ items: [...bin.items], effectiveUsed: bin.effectiveUsed })), timedOut = false;
    function search(index) {
      if (performance.now() > deadline) { timedOut = true; return; }
      if (index === ordered.length) { if (loads.length < best.length) best = contents.map((list, i) => ({ items: [...list], effectiveUsed: loads[i] })); return; }
      const free = loads.reduce((sum, load) => sum + capacity - load, 0), needed = Math.ceil(Math.max(0, suffix[index] - free) / capacity - 1e-10);
      if (loads.length + needed >= best.length) return;
      const item = ordered[index], candidates = loads.map((load, i) => ({ i, after: capacity - load - item.effective })).filter(entry => entry.after >= -1e-7).sort((a, b) => a.after - b.after), seen = new Set();
      for (const entry of candidates) {
        const key = loads[entry.i].toFixed(6); if (seen.has(key)) continue; seen.add(key);
        loads[entry.i] += item.effective; contents[entry.i].push(item); search(index + 1); contents[entry.i].pop(); loads[entry.i] -= item.effective;
        if (timedOut || best.length === lowerBound) return;
      }
      if (loads.length + 1 < best.length) { loads.push(item.effective); contents.push([item]); search(index + 1); loads.pop(); contents.pop(); }
    }
    search(0); return { bins: best, completed: !timedOut || best.length === lowerBound };
  }
  function optimizeCuttingList(inputConfig) {
    const stockTypes = Array.isArray(inputConfig.stockTypes) && inputConfig.stockTypes.length ? inputConfig.stockTypes.map((type, index) => ({ id: String(type.id ?? `stock-${index + 1}`), kind: type.kind === 'scrap' ? 'scrap' : 'commercial', labelKey: type.labelKey || (type.priority ? 'preferredBar' : 'availableBar'), length: Number(type.length), quantity: type.quantity === null || type.quantity === '' || type.quantity === undefined ? null : Math.max(1, Math.trunc(Number(type.quantity))), priority: Boolean(type.priority) })) : [{ id: 'stock-1', kind: 'commercial', labelKey: 'availableBar', length: Number(inputConfig.stockLength), quantity: null, priority: false }];
    const config = { ...inputConfig, stockTypes };
    const items = []; config.cuts.forEach((cut, cutIndex) => { for (let count = 1; count <= cut.quantity; count++) items.push({ ...cut, cutIndex, instance: count, effective: cut.length + config.kerf }); });
    if (!items.length) throw new Error('Nenhuma peça informada.');
    const largestStock = Math.max(...stockTypes.map(type => type.length)); if (items.some(item => item.length > largestStock + 1e-7)) throw new Error('Há uma peça maior que todas as barras disponíveis.');
    const singleType = stockTypes.length === 1 ? stockTypes[0] : null, lowerBound = singleType ? Math.ceil(items.reduce((sum, item) => sum + item.effective, 0) / (singleType.length + config.kerf) - 1e-10) : null;
    let best = null;
    const trials = Math.min(400, Math.max(90, Math.ceil(22000 / Math.max(20, items.length))));
    for (let trial = 0; trial < trials; trial++) {
      const random = seededRandom(11717 + trial * 7919); let order;
      if (trial === 0) order = [...items].sort((a, b) => b.effective - a.effective || a.cutIndex - b.cutIndex);
      else if (trial === 1) order = [...items].sort((a, b) => a.effective - b.effective || a.cutIndex - b.cutIndex);
      else order = items.map(item => ({ item, key: item.effective * (.8 + random() * .4) + random() * largestStock * .02 })).sort((a, b) => b.key - a.key).map(entry => entry.item);
      const candidate = packMixedOrder(order, config, trial % 5, random); if (candidate && betterCandidate(candidate, best, config)) best = candidate;
      if (singleType && best?.length === lowerBound) break;
    }
    if (!best) throw new Error(`O estoque de barras do perfil “${config.name || ''}” é insuficiente para todas as peças.`);
    if (singleType && (singleType.quantity === null || singleType.quantity >= best.length)) {
      const exact = exactImprove(items, singleType.length + config.kerf, best, items.length <= 30 ? 1200 : 650);
      if (exact.bins.length < best.length) best = exact.bins.map(bin => ({ ...bin, stockType: singleType, stockLength: singleType.length, capacity: singleType.length + config.kerf }));
    }
    best.forEach(bin => { bin.items.sort((a, b) => b.length - a.length || a.cutIndex - b.cutIndex); Object.assign(bin, binMeasurements(bin.items, bin.stockLength, config.kerf)); });
    best.sort((a, b) => a.stockLength - b.stockLength || a.waste - b.waste);
    const totalStockLength = best.reduce((sum, bin) => sum + bin.stockLength, 0), totalProductLength = best.reduce((sum, bin) => sum + bin.productLength, 0), totalKerfLoss = best.reduce((sum, bin) => sum + bin.kerfLoss, 0), totalWaste = best.reduce((sum, bin) => sum + bin.waste, 0);
    return { config, bins: best, totalPieces: items.length, totalStockLength, totalProductLength, totalKerfLoss, totalUsed: totalProductLength + totalKerfLoss, totalWaste, utilization: totalProductLength / totalStockLength * 100, lowerBound, optimal: Boolean(singleType && best.length === lowerBound), createdAt: new Date() };
  }
  function optimizeProject(config) {
    const profileResults = config.profiles.map(profile => optimizeCuttingList(profile));
    const totalStockLength = profileResults.reduce((sum, result) => sum + result.totalStockLength, 0), totalProductLength = profileResults.reduce((sum, result) => sum + result.totalProductLength, 0);
    return { config, profileResults, totalBars: profileResults.reduce((sum, result) => sum + result.bins.length, 0), totalPieces: profileResults.reduce((sum, result) => sum + result.totalPieces, 0), totalStockLength, totalProductLength, totalKerfLoss: profileResults.reduce((sum, result) => sum + result.totalKerfLoss, 0), totalWaste: profileResults.reduce((sum, result) => sum + result.totalWaste, 0), utilization: totalProductLength / totalStockLength * 100, optimal: profileResults.every(result => result.optimal), createdAt: new Date() };
  }
  function groupedPatterns(result) {
    const groups = new Map();
    result.bins.forEach((bin, barIndex) => {
      const signature = `${bin.stockType.id}|${bin.items.map(item => `${item.cutIndex}:${item.length.toFixed(6)}`).sort().join('|')}`;
      if (!groups.has(signature)) groups.set(signature, { bins: [], example: bin }); groups.get(signature).bins.push(barIndex + 1);
    });
    return [...groups.values()].sort((a, b) => a.bins[0] - b.bins[0]);
  }

  function renderResult(projectResult) {
    state.result = projectResult; ui.resultContent.hidden = false; ui.exportButton.disabled = ui.printButton.disabled = false;
    ui.metricBars.textContent = projectResult.totalBars; ui.metricUsage.textContent = `${formatNumber(projectResult.utilization, 1)}%`; ui.metricPieces.textContent = projectResult.totalPieces; ui.metricWaste.textContent = `${formatNumber(projectResult.totalWaste, 1)} mm`;
    ui.profileBadge.textContent = `${projectResult.profileResults.length} ${t('profiles')}`;
    ui.resultSubtitle.textContent = t('resultSummary', { profiles:`${projectResult.profileResults.length} ${t('profiles')}`, bars:`${projectResult.totalBars} ${t('bars')}`, pieces:`${projectResult.totalPieces} ${t('pieces').toLowerCase()}`, status:t(projectResult.optimal ? 'mathematicalMinimum' : 'mixedStockOptimized') });
    ui.barsVisual.innerHTML = ''; const maxStock = Math.max(...projectResult.profileResults.flatMap(result => result.bins.map(bin => bin.stockLength)));
    projectResult.profileResults.forEach((result, profileIndex) => {
      const heading = document.createElement('div'); heading.className = 'profile-result-heading'; heading.innerHTML = `${escapeHtml(result.config.name)}<span>${escapeHtml(sectionLabel(result.config.type))} · ${escapeHtml(profileDescription(result.config))} · ${result.bins.length} ${escapeHtml(t('bars'))}</span>`; ui.barsVisual.appendChild(heading);
      result.bins.forEach((bin, index) => {
        const row = document.createElement('div'); row.className = 'bar-row';
        const stockLabel = t(bin.stockType.labelKey || (bin.stockType.priority ? 'preferredBar' : 'availableBar'));
        const label = document.createElement('div'); label.className = 'bar-label'; label.innerHTML = `${escapeHtml(t('barUpper', { number:index + 1 }))}<small>${escapeHtml(stockLabel)} · ${formatNumber(bin.stockLength)} mm</small>`;
        const track = document.createElement('div'); track.className = 'bar-track'; track.style.width = `${Math.max(22, bin.stockLength / maxStock * 100)}%`; track.title = t('consumedOf', { used:formatNumber(bin.used), total:formatNumber(bin.stockLength) });
        bin.items.forEach((item, itemIndex) => {
          const piece = document.createElement('div'); piece.className = 'bar-piece'; piece.style.width = `${item.length / bin.stockLength * 100}%`; piece.style.background = palette[(profileIndex * 3 + item.colorIndex) % palette.length]; piece.textContent = item.length / bin.stockLength > .055 ? `${item.id} · ${formatNumber(item.length)}` : formatNumber(item.length); piece.title = `${item.id} — ${formatNumber(item.length)} mm`; track.appendChild(piece);
          if (itemIndex < bin.items.length - 1 && result.config.kerf > 0) { const kerf = document.createElement('span'); kerf.className = 'bar-kerf'; kerf.style.width = `${Math.max(.12, result.config.kerf / bin.stockLength * 100)}%`; kerf.title = t('cutThickness', { value:formatNumber(result.config.kerf) }); track.appendChild(kerf); }
        });
        const waste = document.createElement('div'); waste.className = 'bar-waste-label'; waste.innerHTML = `${escapeHtml(t('waste'))}<br><strong>${formatNumber(bin.waste)} mm</strong>`; row.append(label, track, waste); ui.barsVisual.appendChild(row);
      });
    });
    ui.patternsBody.innerHTML = '';
    projectResult.profileResults.forEach(result => groupedPatterns(result).forEach((group, patternIndex) => {
      const bin = group.example, row = document.createElement('tr'), sequence = bin.items.map(item => `<span class="cut-chip">${escapeHtml(item.id)} · ${formatNumber(item.length)} mm</span>`).join('');
      row.innerHTML = `<td><strong>${escapeHtml(result.config.name)}</strong><br><small>${escapeHtml(profileDescription(result.config))}</small></td><td><span class="pattern-code">PC-${String(patternIndex + 1).padStart(2, '0')}</span><br><small>${escapeHtml(t('barNumbers', { numbers:group.bins.join(', ') }))}</small></td><td>${escapeHtml(t(bin.stockType.labelKey || (bin.stockType.priority ? 'preferredBar' : 'availableBar')))}<br><strong>${formatNumber(bin.stockLength)} mm</strong></td><td><strong>${group.bins.length}</strong></td><td class="cut-sequence">${sequence}</td><td>${formatNumber(bin.used)} mm</td><td>${formatNumber(bin.waste)} mm</td><td>${formatNumber(bin.utilization, 1)}%</td>`; ui.patternsBody.appendChild(row);
    }));
  }

  function workbookAvailable() { if (window.XLSX) return true; setMessage(t('excelMissing'), 'error'); return false; }
  const projectSheetHeaders = {
    profiles: ['Perfil','Material','Tipo_secao','Diametro_mm','Lado_mm','Largura_mm','Altura_mm','Aba_A_mm','Aba_B_mm','Espessura_mm','Descricao_secao'],
    stocks: ['Perfil','Comprimento_barra_mm','Quantidade','Priorizar'],
    cuts: ['Perfil','Identificacao','Comprimento_mm','Quantidade','Observacao'],
    settings: ['Configuracao','Valor']
  };
  const workbookInstructions = [
    ['PIPESAVER — ARQUIVO COMPLETO DO PROJETO'],
    ['Este arquivo pode ser preenchido do zero ou gerado pelo botão Salvar projeto preenchido para continuar o trabalho mais tarde.'],
    ['1. Perfis', 'Cadastre uma linha por seção. Use somente as colunas de dimensão aplicáveis ao tipo escolhido.'],
    ['2. Barras', 'Informe perfil, comprimento, quantidade e Sim em Priorizar quando desejar consumir aquela barra antes das demais.'],
    ['3. Cortes', 'Relacione cada medida ao nome exato do perfil. Observacao é opcional e fica preservada no arquivo.'],
    ['4. Configuracoes', 'Nome_projeto e Espessura_corte_mm são lidos pelo site. Unidade deve permanecer mm.'],
    ['Tipos de seção aceitos', 'Tubo redondo, Tubo quadrado, Tubo retangular, Barra redonda, Barra chata, Cantoneira e Outro perfil.'],
    ['Dimensões por tipo', 'Tubo redondo: Diametro_mm + Espessura_mm | Tubo quadrado: Lado_mm + Espessura_mm | Tubo retangular: Largura_mm + Altura_mm + Espessura_mm | Barra redonda: Diametro_mm | Barra chata: Largura_mm + Espessura_mm | Cantoneira: Aba_A_mm + Aba_B_mm + Espessura_mm | Outro perfil: Descricao_secao.'],
    ['Importante', 'Não altere os nomes das abas. Os nomes usados em Barras e Cortes devem ser idênticos aos da aba Perfis.']
  ];
  function buildProjectWorkbook(profileRows, stockRows, cutRows, settingsRows) {
    const profiles = XLSX.utils.aoa_to_sheet([projectSheetHeaders.profiles, ...profileRows]), stocks = XLSX.utils.aoa_to_sheet([projectSheetHeaders.stocks, ...stockRows]), cuts = XLSX.utils.aoa_to_sheet([projectSheetHeaders.cuts, ...cutRows]), settings = XLSX.utils.aoa_to_sheet([projectSheetHeaders.settings, ...settingsRows]), instructions = XLSX.utils.aoa_to_sheet(workbookInstructions);
    profiles['!cols'] = [{wch:22},{wch:18},{wch:20},{wch:15},{wch:13},{wch:15},{wch:14},{wch:13},{wch:13},{wch:17},{wch:34}]; stocks['!cols'] = [{wch:22},{wch:24},{wch:14},{wch:14}]; cuts['!cols'] = [{wch:22},{wch:20},{wch:20},{wch:14},{wch:42}]; settings['!cols'] = [{wch:26},{wch:30}]; instructions['!cols'] = [{wch:30},{wch:125}];
    profiles['!autofilter'] = { ref:profiles['!ref'] }; stocks['!autofilter'] = { ref:stocks['!ref'] }; cuts['!autofilter'] = { ref:cuts['!ref'] };
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, profiles, 'Perfis'); XLSX.utils.book_append_sheet(workbook, stocks, 'Barras'); XLSX.utils.book_append_sheet(workbook, cuts, 'Cortes'); XLSX.utils.book_append_sheet(workbook, settings, 'Configuracoes'); XLSX.utils.book_append_sheet(workbook, instructions, 'Instrucoes'); return workbook;
  }
  function profileSheetRow(profile) {
    const d = profile.dimensions || {};
    const canonicalLabels = { roundTube:'Tubo redondo', squareTube:'Tubo quadrado', rectTube:'Tubo retangular', roundBar:'Barra redonda', flatBar:'Barra chata', angle:'Cantoneira', custom:'Outro perfil' };
    return [profile.name, profile.material, canonicalLabels[profile.type] || 'Outro perfil', d.diameter ?? '', d.side ?? '', d.width ?? '', d.height ?? '', d.legA ?? '', d.legB ?? '', d.thickness ?? '', d.description ?? ''];
  }
  function downloadTemplate() {
    if (!workbookAvailable()) return;
    const profileRows = [
      ['Perfil 1','Aço carbono','Tubo redondo',60,'','','','','',3,''],
      ['Perfil 2','Aço carbono','Tubo quadrado','',50,'','','','',3,''],
      ['Perfil 3','Aço carbono','Tubo retangular','','',80,40,'','',3,''],
      ['Perfil 4','Aço carbono','Barra redonda',30,'','','','','','',''],
      ['Perfil 5','Aço carbono','Barra chata','','',50,'','','',6,''],
      ['Perfil 6','Aço carbono','Cantoneira','','','','',50,50,5,''],
      ['Perfil 7','Aço carbono','Outro perfil','','','','','','','','Descrição livre da seção']
    ];
    const workbook = buildProjectWorkbook(profileRows, [['Perfil 1',6000,2,'Não'],['Perfil 1',4000,1,'Sim'],['Perfil 3',6000,4,'Não']], [['Perfil 1','P01',1200,4,'Exemplo — substitua esta linha'],['Perfil 3','P02',850,6,'Exemplo — substitua esta linha']], [['Versao_modelo',2],['Nome_projeto','Novo projeto'],['Espessura_corte_mm',3],['Unidade','mm']]);
    XLSX.writeFile(workbook, 'modelo_completo_pipesaver.xlsx'); setMessage(t('templateDownloaded'), 'success');
  }
  function saveProjectExcel() {
    if (!workbookAvailable()) return;
    serializeActiveProfile();
    const profileName = new Map(state.profiles.map(profile => [profile.id, profile.name || 'Perfil sem nome']));
    const profileRows = state.profiles.map(profileSheetRow), stockRows = state.stocks.map(stock => [profileName.get(stock.profileId) || '', stock.length, stock.quantity, stock.priority ? 'Sim' : 'Não']), cutRows = state.cuts.map(cut => [profileName.get(cut.profileId) || '', cut.id, cut.length, cut.quantity, cut.observation || '']);
    const workbook = buildProjectWorkbook(profileRows, stockRows, cutRows, [['Versao_modelo',2],['Nome_projeto',ui.projectName.value],['Espessura_corte_mm',ui.kerf.value],['Unidade','mm'],['Salvo_em',new Date().toLocaleString(state.language)]]);
    XLSX.writeFile(workbook, `${safeFileName(ui.projectName.value)}_projeto_pipesaver.xlsx`); setMessage(t('projectSaved'), 'success');
  }
  function findHeader(headers, aliases) { return headers.find(header => aliases.includes(normalizeHeader(header))); }
  function sectionTypeFrom(value) {
    const key = normalizeHeader(value), aliases = { roundTube:['tuboredondo','roundtube'], squareTube:['tuboquadrado','squaretube'], rectTube:['tuboretangular','recttube'], roundBar:['barraredonda','roundbar'], flatBar:['barrachata','flatbar'], angle:['cantoneira','angle'], custom:['outroperfil','personalizado','custom'] };
    return Object.keys(aliases).find(type => aliases[type].includes(key)) || 'custom';
  }
  function dimensionsFromSheet(type, row, columns) {
    const value = (header, fallback = '') => header ? row[header] : fallback, a = value(columns.genericA), b = value(columns.genericB), thickness = value(columns.thickness);
    if (type === 'roundTube') return { diameter:value(columns.diameter,a), thickness };
    if (type === 'squareTube') return { side:value(columns.side,a), thickness };
    if (type === 'rectTube') return { width:value(columns.width,a), height:value(columns.height,b), thickness };
    if (type === 'roundBar') return { diameter:value(columns.diameter,a) };
    if (type === 'flatBar') return { width:value(columns.width,a), thickness:thickness || b };
    if (type === 'angle') return { legA:value(columns.legA,a), legB:value(columns.legB,b), thickness };
    return { description:String(value(columns.description,a) || 'Perfil personalizado') };
  }
  async function importExcel(file) {
    if (!workbookAvailable()) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type:'array' }), cutsSheetName = workbook.SheetNames.find(name => normalizeHeader(name) === 'cortes') || workbook.SheetNames[0], cutRows = XLSX.utils.sheet_to_json(workbook.Sheets[cutsSheetName], { defval:'' });
      if (!cutRows.length) throw new Error('A planilha não contém linhas de corte.');
      const profilesSheetName = workbook.SheetNames.find(name => normalizeHeader(name) === 'perfis'); let importedProfiles = null, importedStocks = [], importedCuts = [], importedKerf = null;
      if (profilesSheetName) {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[profilesSheetName], { defval:'' }); if (!rows.length) throw new Error('A aba Perfis está vazia.');
        const headers = Object.keys(rows[0]), profileHeader = findHeader(headers,['perfil','profile']), materialHeader = findHeader(headers,['material']), typeHeader = findHeader(headers,['tiposecao','tipoperfil','sectiontype']), dimensionColumns = { genericA:findHeader(headers,['dimensaoamm','dimensaoa']), genericB:findHeader(headers,['dimensaobmm','dimensaob']), diameter:findHeader(headers,['diametromm','diametroexternomm','diametroexterno','diametro']), side:findHeader(headers,['ladomm','lado']), width:findHeader(headers,['larguramm','largura']), height:findHeader(headers,['alturamm','altura']), legA:findHeader(headers,['abaamm','abaa','legamm','lega']), legB:findHeader(headers,['ababmm','abab','legbmm','legb']), thickness:findHeader(headers,['espessuramm','espessura']), description:findHeader(headers,['descricaosecao','descricao','perfilpersonalizado']) }, kerfHeader = findHeader(headers,['kerfmm','kerf','espessuradecortemm']), legacyLengthHeader = findHeader(headers,['comprimentoblankmm','comprimentoblank']), legacyQuantityHeader = findHeader(headers,['quantidadeblank','qtdblank']), legacyKindHeader = findHeader(headers,['tipoblank','origemblank']), legacyPriorityHeader = findHeader(headers,['priorizar','prioridade','prioritario']);
        if (!profileHeader) throw new Error('A aba Perfis deve conter a coluna Perfil.');
        const map = new Map();
        rows.forEach((row, index) => {
          const name = String(row[profileHeader]).trim(); if (!name) throw new Error(`Perfil vazio na linha ${index + 2}.`);
          const key = normalizeHeader(name); let profile = map.get(key);
          if (!profile) { profile = makeProfile(name); profile.material = String(materialHeader ? row[materialHeader] : '').trim() || 'Não informado'; profile.type = sectionTypeFrom(typeHeader ? row[typeHeader] : 'Outro perfil'); profile.dimensions = dimensionsFromSheet(profile.type, row, dimensionColumns); map.set(key, profile); }
          if (kerfHeader && String(row[kerfHeader]).trim() !== '' && importedKerf === null) importedKerf = row[kerfHeader];
          if (legacyLengthHeader && String(row[legacyLengthHeader]).trim() !== '') { const length = numberFrom(row[legacyLengthHeader]), rawQuantity = legacyQuantityHeader ? String(row[legacyQuantityHeader]).trim() : ''; const quantity = rawQuantity === '' ? 1 : Math.trunc(numberFrom(rawQuantity)), priority = booleanFrom(legacyPriorityHeader ? row[legacyPriorityHeader] : '') || normalizeHeader(legacyKindHeader ? row[legacyKindHeader] : '') === 'retalho'; if (!(length > 0) || !(quantity >= 1)) throw new Error(`Barra inválida na linha ${index + 2} da aba Perfis.`); importedStocks.push({ id:`stock-${state.nextStockId++}`, profileKey:key, length, quantity, priority }); }
        });
        importedProfiles = [...map.values()];

        const stocksSheetName = workbook.SheetNames.find(name => ['barras','estoque'].includes(normalizeHeader(name)));
        if (stocksSheetName) {
          importedStocks = [];
          const stockRows = XLSX.utils.sheet_to_json(workbook.Sheets[stocksSheetName], { defval:'' }); if (!stockRows.length) throw new Error('A aba Barras está vazia.');
          const stockHeaders = Object.keys(stockRows[0]), stockProfileHeader = findHeader(stockHeaders,['perfil','profile']), stockLengthHeader = findHeader(stockHeaders,['comprimentobarramm','comprimentobarra','comprimentomm','comprimento']), stockQuantityHeader = findHeader(stockHeaders,['quantidade','qtd','qtde','quantity','qty']), stockPriorityHeader = findHeader(stockHeaders,['priorizar','prioridade','prioritario']);
          if (!stockProfileHeader || !stockLengthHeader || !stockQuantityHeader) throw new Error('A aba Barras deve conter Perfil, Comprimento_barra_mm e Quantidade.');
          stockRows.forEach((row, index) => { const profileKey = normalizeHeader(row[stockProfileHeader]), rawLength = String(row[stockLengthHeader]).trim(), rawQuantity = String(row[stockQuantityHeader]).trim(), length = rawLength === '' ? '' : numberFrom(rawLength), quantity = rawQuantity === '' ? 1 : Math.trunc(numberFrom(rawQuantity)), priority = booleanFrom(stockPriorityHeader ? row[stockPriorityHeader] : ''); if (!map.has(profileKey)) throw new Error(`Perfil não encontrado na linha ${index + 2} da aba Barras.`); if ((rawLength !== '' && !(length > 0)) || !(quantity >= 1)) throw new Error(`Barra inválida na linha ${index + 2} da aba Barras.`); importedStocks.push({ id:`stock-${state.nextStockId++}`, profileKey, length, quantity, priority }); });
        }
        if (!importedStocks.length) throw new Error('Adicione ao menos uma barra na aba Barras.');

        const settingsSheetName = workbook.SheetNames.find(name => ['configuracoes','configuracao','settings'].includes(normalizeHeader(name)));
        if (settingsSheetName) {
          const settingsRows = XLSX.utils.sheet_to_json(workbook.Sheets[settingsSheetName], { header:1, defval:'' });
          settingsRows.slice(1).forEach(row => { const key = normalizeHeader(row[0]); if (key === 'nomeprojeto' && String(row[1]).trim()) ui.projectName.value = String(row[1]).trim(); if (['espessuracortemm','kerfmm','kerf'].includes(key) && String(row[1]).trim() !== '') importedKerf = row[1]; });
        }
      }
      const headers = Object.keys(cutRows[0]), profileHeader = findHeader(headers,['perfil','profile']), idHeader = findHeader(headers,['identificacao','id','codigo','peca','descricao','nome']), lengthHeader = findHeader(headers,['comprimentomm','comprimento','medidamm','medida','lengthmm','length']), quantityHeader = findHeader(headers,['quantidade','qtd','qtde','quantity','qty']), observationHeader = findHeader(headers,['observacao','obs','nota','notes']);
      if (!lengthHeader || !quantityHeader) throw new Error('A aba Cortes deve conter Comprimento_mm e Quantidade.');
      if (importedProfiles) {
        const map = new Map(importedProfiles.map(profile => [normalizeHeader(profile.name), profile]));
        if (!profileHeader) throw new Error('A aba Cortes deve conter a coluna Perfil.');
        cutRows.forEach((row, index) => { const profileKey = normalizeHeader(row[profileHeader]), profile = map.get(profileKey); if (!profile) throw new Error(`Perfil não encontrado na linha ${index + 2} da aba Cortes.`); const rawLength = String(row[lengthHeader]).trim(), rawQuantity = String(row[quantityHeader]).trim(), length = rawLength === '' ? '' : numberFrom(rawLength), quantity = rawQuantity === '' ? 1 : Math.trunc(numberFrom(rawQuantity)); if ((rawLength !== '' && !(length > 0)) || !(quantity >= 1)) throw new Error(`Corte inválido na linha ${index + 2}.`); importedCuts.push({ rowId:`cut-${state.nextCutId++}`, profileId:profile.id, id:String(idHeader ? row[idHeader] : '').trim(), length, quantity, observation:String(observationHeader ? row[observationHeader] : '').trim() }); });
        importedStocks.forEach(stock => { stock.profileId = map.get(stock.profileKey).id; delete stock.profileKey; });
        state.profiles = importedProfiles; state.stocks = importedStocks; state.cuts = importedCuts; state.activeProfileId = importedProfiles[0].id; if (importedKerf !== null) ui.kerf.value = importedKerf;
      } else {
        serializeActiveProfile(); const profile = activeProfile(); state.cuts = state.cuts.filter(cut => cut.profileId !== profile.id);
        cutRows.forEach((row, index) => { const length = numberFrom(row[lengthHeader]), quantity = Math.trunc(numberFrom(row[quantityHeader])); if (!(length > 0) || !(quantity >= 1)) throw new Error(`Dados inválidos na linha ${index + 2}.`); state.cuts.push({ rowId:`cut-${state.nextCutId++}`, profileId:profile.id, id:String(idHeader ? row[idHeader] : '').trim() || `P${index + 1}`, length, quantity, observation:String(observationHeader ? row[observationHeader] : '').trim() }); });
      }
      renderActiveProfile(); renderRelationRows(); invalidateResult(); setMessage(t('imported', { cuts:cutRows.length, profiles:importedProfiles ? importedProfiles.length : 1, file:file.name }), 'success');
    } catch (error) { setMessage(error.message, 'error'); }
    finally { ui.excelInput.value = ''; }
  }
  function exportResult() {
    if (!state.result || !workbookAvailable()) return;
    const project = state.result, summaryData = [['PIPESAVER — PROJETO COMPLETO'],['Projeto',project.config.projectName],['Perfis',project.profileResults.length],['Barras utilizadas',project.totalBars],['Peças',project.totalPieces],['Aproveitamento (%)',Number(project.utilization.toFixed(2))],['Perda de corte (mm)',Number(project.totalKerfLoss.toFixed(2))],['Sobra total (mm)',Number(project.totalWaste.toFixed(2))],['Gerado em',project.createdAt.toLocaleString(state.language)]], stockData = [['Perfil','Material','Seção','Comprimento_barra_mm','Quantidade_disponivel','Priorizar','Quantidade_utilizada']], planData = [['Perfil','Barra','Padrão','Comprimento_barra_mm','Prioritária','Ordem','Identificação','Comprimento_mm','Kerf_apos_mm','Usado_barra_mm','Sobra_barra_mm']], demandData = [['Perfil','Identificacao','Comprimento_mm','Quantidade','Observacao']];
    project.profileResults.forEach(result => {
      const usage = new Map(); result.bins.forEach(bin => usage.set(bin.stockType.id,(usage.get(bin.stockType.id)||0)+1));
      result.config.stockTypes.forEach(stock => stockData.push([result.config.name,result.config.material,profileDescription(result.config),stock.length,stock.quantity,stock.priority?'Sim':'Não',usage.get(stock.id)||0]));
      const patternMap = new Map(); groupedPatterns(result).forEach((group,index) => group.bins.forEach(bar => patternMap.set(bar,`PC-${String(index+1).padStart(2,'0')}`)));
      result.bins.forEach((bin,barIndex) => bin.items.forEach((item,itemIndex) => planData.push([result.config.name,barIndex+1,patternMap.get(barIndex+1),bin.stockLength,bin.stockType.priority?'Sim':'Não',itemIndex+1,item.id,item.length,itemIndex<bin.items.length-1?result.config.kerf:0,Number(bin.used.toFixed(3)),Number(bin.waste.toFixed(3))])));
      result.config.cuts.forEach(cut => demandData.push([result.config.name,cut.id,cut.length,cut.quantity,cut.observation||'']));
    });
    const workbook = XLSX.utils.book_new(); [['Resumo',summaryData],['Estoque',stockData],['Plano_de_corte',planData],['Demanda',demandData]].forEach(([name,data]) => XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet(data),name)); XLSX.writeFile(workbook,`${safeFileName(project.config.projectName)}_pipesaver.xlsx`); setMessage(t('projectExported'),'success');
  }
  async function executeOptimization() {
    try { const config = readProjectConfig(); ui.optimizeButton.disabled = true; ui.optimizeButton.firstElementChild.textContent = t('optimizing'); setMessage(t('calculations')); await new Promise(resolve => setTimeout(resolve,30)); const started = performance.now(), result = optimizeProject(config); result.elapsedMs = performance.now()-started; renderResult(result); setMessage(t('completedIn', { time:formatNumber(result.elapsedMs,0) }),'success'); }
    catch (error) { setMessage(error.message,'error'); }
    finally { ui.optimizeButton.disabled = false; ui.optimizeButton.firstElementChild.textContent = t('generatePlan'); }
  }

  ui.addProfileButton.addEventListener('click', () => { serializeActiveProfile(); const profile = makeProfile(t('profileDefault', { number:state.profiles.length + 1 })); state.profiles.push(profile); state.activeProfileId = profile.id; renderActiveProfile(); invalidateResult(); ui.profileName.focus(); });
  ui.profileName.addEventListener('input', () => { const profile=activeProfile(); if(profile){profile.name=ui.profileName.value; updateProfileOptions();} invalidateResult(); });
  ui.sectionType.addEventListener('change', () => { const profile=activeProfile(); if(!profile)return; profile.type=ui.sectionType.value; profile.dimensions=defaultDimensions(profile.type); renderDimensionFields(profile); invalidateResult(); });
  [ui.projectName,ui.material,ui.kerf].forEach(input => input.addEventListener('change',invalidateResult));
  ui.addStockButton.addEventListener('click', () => addStockRow({profileId:state.activeProfileId,length:6000,quantity:1},true)); ui.addCutButton.addEventListener('click', () => addCutRow({profileId:state.activeProfileId},true));
  ui.templateButton.addEventListener('click',downloadTemplate); ui.saveProjectButton.addEventListener('click',saveProjectExcel); ui.excelInput.addEventListener('change',event => event.target.files[0]&&importExcel(event.target.files[0])); ui.optimizeButton.addEventListener('click',executeOptimization); ui.exportButton.addEventListener('click',exportResult); ui.printButton.addEventListener('click',()=>window.print());

  ui.languageSelect.addEventListener('change', event => applyLanguage(event.target.value));
  ui.languageButton.addEventListener('click', () => setLanguageMenu(ui.languageMenu.hidden));
  ui.languageMenu.addEventListener('click', event => {
    const option = event.target.closest('[data-language]'); if (!option) return;
    applyLanguage(option.dataset.language); setLanguageMenu(false); ui.languageButton.focus();
  });
  ui.languagePicker.addEventListener('keydown', event => {
    if (event.key === 'Escape') { setLanguageMenu(false); ui.languageButton.focus(); return; }
    if (!['ArrowDown','ArrowUp'].includes(event.key)) return;
    event.preventDefault(); setLanguageMenu(true);
    const options = [...ui.languageMenu.querySelectorAll('[data-language]')], current = Math.max(0, options.indexOf(document.activeElement));
    options[(current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length].focus();
  });
  document.addEventListener('click', event => { if (!ui.languagePicker.contains(event.target)) setLanguageMenu(false); });

  const firstProfile = makeProfile(t('profileDefault', { number:1 })); state.profiles.push(firstProfile); state.activeProfileId = firstProfile.id; state.stocks.push({id:`stock-${state.nextStockId++}`,profileId:firstProfile.id,length:6000,quantity:1}); state.cuts.push({rowId:`cut-${state.nextCutId++}`,profileId:firstProfile.id,id:'',length:'',quantity:1}); renderActiveProfile(); renderRelationRows(); applyLanguage(state.language, false);
  window.PipeSaverCore = Object.freeze({ optimizeCuttingList, optimizeProject, groupedPatterns, profileDescription, numberFrom, applyLanguage });
})();
