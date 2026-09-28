(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const ui = {
    projectName: $('projectName'), profileSelect: $('profileSelect'), addProfileButton: $('addProfileButton'),
    removeProfileButton: $('removeProfileButton'), profileName: $('profileName'), material: $('material'),
    sectionType: $('sectionType'), dimensionFields: $('dimensionFields'), stockBody: $('stockBody'),
    addStockButton: $('addStockButton'), kerf: $('kerf'), cutsBody: $('cutsBody'), addCutButton: $('addCutButton'),
    templateButton: $('templateButton'), excelInput: $('excelInput'), optimizeButton: $('optimizeButton'),
    message: $('message'), resultContent: $('resultContent'), resultSubtitle: $('resultSubtitle'),
    metricBars: $('metricBars'), metricUsage: $('metricUsage'), metricPieces: $('metricPieces'),
    metricWaste: $('metricWaste'), profileBadge: $('profileBadge'), barsVisual: $('barsVisual'),
    patternsBody: $('patternsBody'), printButton: $('printButton'), exportButton: $('exportButton')
  };

  const sectionDefinitions = {
    roundTube: { label: 'Tubo redondo', fields: [['diameter', 'Diâmetro externo', 60], ['thickness', 'Espessura', 3]] },
    squareTube: { label: 'Tubo quadrado', fields: [['side', 'Lado', 50], ['thickness', 'Espessura', 3]] },
    rectTube: { label: 'Tubo retangular', fields: [['width', 'Largura', 80], ['height', 'Altura', 40], ['thickness', 'Espessura', 3]] },
    roundBar: { label: 'Barra redonda', fields: [['diameter', 'Diâmetro', 30]] },
    flatBar: { label: 'Barra chata', fields: [['width', 'Largura', 50], ['thickness', 'Espessura', 6]] },
    angle: { label: 'Cantoneira', fields: [['legA', 'Aba A', 50], ['legB', 'Aba B', 50], ['thickness', 'Espessura', 5]] },
    custom: { label: 'Outro perfil', fields: [['description', 'Descrição da seção', 'Perfil especial', 'text']] }
  };
  const palette = ['#0c8b84', '#ef7b3d', '#5078a5', '#a56d9d', '#c49332', '#4595aa', '#a95d63', '#668c55', '#7769ad'];
  const state = { profiles: [], activeProfileId: null, nextProfileId: 1, nextStockId: 1, nextCutId: 1, result: null };

  function formatNumber(value, digits = 1) { return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: digits }); }
  function numberFrom(value) {
    if (typeof value === 'number') return value;
    let text = String(value ?? '').trim().replace(/\s/g, '');
    if (text.includes(',') && text.includes('.')) text = text.replace(/\./g, '').replace(',', '.');
    else if (text.includes(',')) text = text.replace(',', '.');
    return Number.parseFloat(text);
  }
  function normalizeHeader(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
  function safeFileName(value) { return String(value || 'pipesaver').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'pipesaver'; }
  function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; }
  function setMessage(text, type = '') { ui.message.textContent = text; ui.message.className = `message ${type}`.trim(); }
  function invalidateResult() {
    if (!state.result) return;
    state.result = null; ui.resultContent.hidden = true; ui.exportButton.disabled = ui.printButton.disabled = true;
    ui.resultSubtitle.textContent = 'Dados alterados — gere novamente o plano de corte';
  }
  function defaultDimensions(type) {
    return Object.fromEntries(sectionDefinitions[type].fields.map(([key, , value]) => [key, value]));
  }
  function makeProfile(name = `Perfil ${state.nextProfileId}`) {
    const profileNumber = state.nextProfileId++;
    return {
      id: `profile-${profileNumber}`, name, material: 'Aço carbono', type: 'rectTube', dimensions: defaultDimensions('rectTube'), kerf: 3,
      stocks: [{ id: `stock-${state.nextStockId++}`, kind: 'commercial', length: 6000, quantity: '' }],
      cuts: [{ rowId: `cut-${state.nextCutId++}`, id: '', length: '', quantity: 1 }]
    };
  }
  function activeProfile() { return state.profiles.find(profile => profile.id === state.activeProfileId); }

  function updateProfileOptions() {
    const selected = state.activeProfileId;
    ui.profileSelect.innerHTML = '';
    state.profiles.forEach((profile, index) => {
      const option = document.createElement('option'); option.value = profile.id; option.textContent = profile.name || `Perfil ${index + 1}`; ui.profileSelect.appendChild(option);
    });
    ui.profileSelect.value = selected;
    ui.removeProfileButton.disabled = state.profiles.length === 1;
  }
  function renderDimensionFields(profile) {
    const definition = sectionDefinitions[profile.type];
    ui.dimensionFields.innerHTML = '';
    definition.fields.forEach(([key, label, initial, kind]) => {
      const wrapper = document.createElement('label'); wrapper.className = 'field';
      const inputType = kind === 'text' ? 'text' : 'number', value = profile.dimensions[key] ?? initial;
      wrapper.innerHTML = `<span>${label}${inputType === 'number' ? ' (mm)' : ''}</span><input data-dimension="${key}" type="${inputType}" value="${String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"${inputType === 'number' ? ' min="0.01" step="0.1"' : ' maxlength="80"'}>`;
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
    row.innerHTML = `<select class="stock-kind" aria-label="Tipo do blank"><option value="commercial"${values.kind === 'scrap' ? '' : ' selected'}>Comercial</option><option value="scrap"${values.kind === 'scrap' ? ' selected' : ''}>Retalho</option></select><input class="stock-length" type="number" value="${values.length ?? 6000}" min="1" step="0.1" aria-label="Comprimento do blank"><input class="stock-quantity" type="number" value="${values.quantity ?? ''}" min="1" max="9999" step="1" placeholder="∞" aria-label="Quantidade disponível"><button class="remove-stock" type="button" title="Remover blank" aria-label="Remover blank">×</button>`;
    row.querySelectorAll('input,select').forEach(element => element.addEventListener('change', invalidateResult));
    row.querySelector('.remove-stock').addEventListener('click', () => { if (ui.stockBody.children.length <= 1) return; row.remove(); updateStockRemoveButtons(); invalidateResult(); });
    ui.stockBody.appendChild(row); updateStockRemoveButtons(); if (focus) row.querySelector('.stock-length').focus(); return row;
  }
  function updateCutRemoveButtons() {
    const buttons = [...ui.cutsBody.querySelectorAll('.remove-cut')];
    buttons.forEach(button => { button.disabled = buttons.length === 1; });
  }
  function addCutRow(values = {}, focus = false) {
    const row = document.createElement('tr'); row.dataset.rowId = values.rowId || `cut-${state.nextCutId++}`;
    row.innerHTML = `<td><input class="cut-input cut-id" value="${String(values.id ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" placeholder="Ex.: P01" maxlength="60"></td><td><input class="cut-input cut-length" type="number" value="${values.length ?? ''}" placeholder="0" min="0.01" step="0.1"></td><td><input class="cut-input cut-quantity" type="number" value="${values.quantity ?? 1}" min="1" max="9999" step="1"></td><td><button class="remove-cut" type="button" title="Remover medida" aria-label="Remover medida">×</button></td>`;
    row.querySelectorAll('input').forEach(input => input.addEventListener('change', invalidateResult));
    row.querySelector('.remove-cut').addEventListener('click', () => { if (ui.cutsBody.children.length <= 1) return; row.remove(); updateCutRemoveButtons(); invalidateResult(); });
    ui.cutsBody.appendChild(row); updateCutRemoveButtons(); if (focus) row.querySelector('.cut-id').focus(); return row;
  }
  function serializeActiveProfile() {
    const profile = activeProfile(); if (!profile) return;
    profile.name = ui.profileName.value.trim() || ui.profileName.value;
    profile.material = ui.material.value;
    profile.type = ui.sectionType.value;
    profile.dimensions = {};
    ui.dimensionFields.querySelectorAll('[data-dimension]').forEach(input => { profile.dimensions[input.dataset.dimension] = input.value; });
    profile.kerf = ui.kerf.value;
    profile.stocks = [...ui.stockBody.querySelectorAll('.stock-row')].map(row => ({ id: row.dataset.stockId, kind: row.querySelector('.stock-kind').value, length: row.querySelector('.stock-length').value, quantity: row.querySelector('.stock-quantity').value }));
    profile.cuts = [...ui.cutsBody.rows].map(row => ({ rowId: row.dataset.rowId, id: row.querySelector('.cut-id').value, length: row.querySelector('.cut-length').value, quantity: row.querySelector('.cut-quantity').value }));
  }
  function renderActiveProfile() {
    const profile = activeProfile(); if (!profile) return;
    updateProfileOptions(); ui.profileName.value = profile.name; ui.material.value = profile.material; ui.sectionType.value = profile.type; ui.kerf.value = profile.kerf;
    renderDimensionFields(profile);
    ui.stockBody.innerHTML = ''; (profile.stocks.length ? profile.stocks : [{}]).forEach(stock => addStockRow(stock));
    ui.cutsBody.innerHTML = ''; (profile.cuts.length ? profile.cuts : [{}]).forEach(cut => addCutRow(cut));
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
      default: return String(d.description || 'Perfil personalizado');
    }
  }
  function validatedDimensions(profile) {
    const dimensions = {};
    for (const [key, label, , kind] of sectionDefinitions[profile.type].fields) {
      const raw = profile.dimensions[key];
      if (kind === 'text') { if (!String(raw || '').trim()) throw new Error(`Informe a descrição da seção em “${profile.name}”.`); dimensions[key] = String(raw).trim(); }
      else { const value = numberFrom(raw); if (!(value > 0)) throw new Error(`Informe ${label.toLowerCase()} válido em “${profile.name}”.`); dimensions[key] = value; }
    }
    return dimensions;
  }
  function readProjectConfig() {
    serializeActiveProfile();
    const configuredProfiles = []; let totalPieces = 0;
    state.profiles.forEach((profile, profileIndex) => {
      const cuts = [];
      profile.cuts.forEach((cut, rowIndex) => {
        const rawLength = String(cut.length ?? '').trim(); if (!rawLength) return;
        const length = numberFrom(rawLength), quantity = Math.trunc(numberFrom(cut.quantity));
        if (!(length > 0)) throw new Error(`Comprimento inválido no perfil “${profile.name}”, linha ${rowIndex + 1}.`);
        if (!(quantity >= 1 && quantity <= 9999)) throw new Error(`Quantidade inválida no perfil “${profile.name}”, linha ${rowIndex + 1}.`);
        cuts.push({ id: String(cut.id || '').trim() || `P${String(rowIndex + 1).padStart(2, '0')}`, length, quantity, colorIndex: cuts.length }); totalPieces += quantity;
      });
      if (!cuts.length) return;
      const stocks = profile.stocks.map((stock, stockIndex) => {
        const length = numberFrom(stock.length), rawQuantity = String(stock.quantity ?? '').trim(), quantity = rawQuantity === '' ? null : Math.trunc(numberFrom(rawQuantity));
        if (!(length > 0)) throw new Error(`Comprimento de blank inválido no perfil “${profile.name}”.`);
        if (quantity !== null && !(quantity >= 1 && quantity <= 9999)) throw new Error(`Quantidade de blank inválida no perfil “${profile.name}”.`);
        return { id: stock.id || `stock-${profileIndex}-${stockIndex}`, kind: stock.kind === 'scrap' ? 'scrap' : 'commercial', label: stock.kind === 'scrap' ? 'Retalho' : 'Barra comercial', length, quantity };
      });
      if (!stocks.length) throw new Error(`Adicione pelo menos um blank ao perfil “${profile.name}”.`);
      const largest = Math.max(...stocks.map(stock => stock.length));
      const oversized = cuts.find(cut => cut.length > largest + 1e-7);
      if (oversized) throw new Error(`A peça “${oversized.id}” do perfil “${profile.name}” é maior que todos os blanks disponíveis.`);
      const type = sectionDefinitions[profile.type] ? profile.type : 'custom';
      const normalized = { id: profile.id, name: profile.name.trim() || `Perfil ${profileIndex + 1}`, material: profile.material.trim() || 'Não informado', type, label: sectionDefinitions[type].label, dimensions: validatedDimensions({ ...profile, type }), kerf: numberFrom(profile.kerf), stockTypes: stocks, cuts };
      if (!(normalized.kerf >= 0)) throw new Error(`A espessura de corte do perfil “${normalized.name}” não pode ser negativa.`);
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
      bins.forEach(bin => { const remainder = bin.capacity - bin.effectiveUsed - item.effective; if (remainder >= -1e-7 && remainder < bestRemainder) { selected = bin; bestRemainder = remainder; } });
      if (selected) { selected.items.push(item); selected.effectiveUsed += item.effective; continue; }
      const available = config.stockTypes.filter(type => (type.quantity === null || (usage.get(type.id) || 0) < type.quantity) && item.length <= type.length + 1e-7);
      if (!available.length) return null;
      const future = order.slice(itemIndex + 1);
      const ranked = available.map(type => {
        const projected = projectedRemainder(type, item, future, config.kerf);
        let score;
        if (strategy === 0) score = type.length;
        else if (strategy === 1) score = projected + type.length * 1e-5;
        else if (strategy === 2) score = -type.length;
        else if (strategy === 3) score = (type.kind === 'scrap' && type.quantity !== null ? -1e9 : 0) + projected;
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
    return { totalStockLength, barCount: bins.length, concentratedWaste };
  }
  function betterCandidate(candidate, best, config) {
    if (!best) return true;
    const a = candidateSummary(candidate, config), b = candidateSummary(best, config);
    return a.totalStockLength < b.totalStockLength - 1e-7 || (Math.abs(a.totalStockLength - b.totalStockLength) <= 1e-7 && (a.barCount < b.barCount || (a.barCount === b.barCount && a.concentratedWaste > b.concentratedWaste + 1e-7)));
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
    const stockTypes = Array.isArray(inputConfig.stockTypes) && inputConfig.stockTypes.length ? inputConfig.stockTypes.map((type, index) => ({ id: String(type.id ?? `stock-${index + 1}`), kind: type.kind === 'scrap' ? 'scrap' : 'commercial', label: type.label || (type.kind === 'scrap' ? 'Retalho' : 'Barra comercial'), length: Number(type.length), quantity: type.quantity === null || type.quantity === '' || type.quantity === undefined ? null : Math.max(1, Math.trunc(Number(type.quantity))) })) : [{ id: 'stock-1', kind: 'commercial', label: 'Barra comercial', length: Number(inputConfig.stockLength), quantity: null }];
    const config = { ...inputConfig, stockTypes };
    const items = []; config.cuts.forEach((cut, cutIndex) => { for (let count = 1; count <= cut.quantity; count++) items.push({ ...cut, cutIndex, instance: count, effective: cut.length + config.kerf }); });
    if (!items.length) throw new Error('Nenhuma peça informada.');
    const largestStock = Math.max(...stockTypes.map(type => type.length)); if (items.some(item => item.length > largestStock + 1e-7)) throw new Error('Há uma peça maior que todos os blanks disponíveis.');
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
    if (!best) throw new Error(`O estoque de blanks do perfil “${config.name || ''}” é insuficiente para todas as peças.`);
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
    ui.profileBadge.textContent = `${projectResult.profileResults.length} perfil(is)`;
    ui.resultSubtitle.textContent = `${projectResult.profileResults.length} perfil(is) · ${projectResult.totalBars} blank(s) · ${projectResult.totalPieces} peça(s) · ${projectResult.optimal ? 'mínimo matemático atingido' : 'estoque misto otimizado'}`;
    ui.barsVisual.innerHTML = ''; const maxStock = Math.max(...projectResult.profileResults.flatMap(result => result.bins.map(bin => bin.stockLength)));
    projectResult.profileResults.forEach((result, profileIndex) => {
      const heading = document.createElement('div'); heading.className = 'profile-result-heading'; heading.innerHTML = `${escapeHtml(result.config.name)}<span>${escapeHtml(result.config.label)} · ${escapeHtml(profileDescription(result.config))} · ${result.bins.length} blank(s)</span>`; ui.barsVisual.appendChild(heading);
      result.bins.forEach((bin, index) => {
        const row = document.createElement('div'); row.className = 'bar-row';
        const label = document.createElement('div'); label.className = 'bar-label'; label.innerHTML = `BARRA ${index + 1}<small>${escapeHtml(bin.stockType.label)} · ${formatNumber(bin.stockLength)} mm</small>`;
        const track = document.createElement('div'); track.className = 'bar-track'; track.style.width = `${Math.max(22, bin.stockLength / maxStock * 100)}%`; track.title = `${formatNumber(bin.used)} mm consumidos de ${formatNumber(bin.stockLength)} mm`;
        bin.items.forEach((item, itemIndex) => {
          const piece = document.createElement('div'); piece.className = 'bar-piece'; piece.style.width = `${item.length / bin.stockLength * 100}%`; piece.style.background = palette[(profileIndex * 3 + item.colorIndex) % palette.length]; piece.textContent = item.length / bin.stockLength > .055 ? `${item.id} · ${formatNumber(item.length)}` : formatNumber(item.length); piece.title = `${item.id} — ${formatNumber(item.length)} mm`; track.appendChild(piece);
          if (itemIndex < bin.items.length - 1 && result.config.kerf > 0) { const kerf = document.createElement('span'); kerf.className = 'bar-kerf'; kerf.style.width = `${Math.max(.12, result.config.kerf / bin.stockLength * 100)}%`; kerf.title = `Corte: ${formatNumber(result.config.kerf)} mm`; track.appendChild(kerf); }
        });
        const waste = document.createElement('div'); waste.className = 'bar-waste-label'; waste.innerHTML = `Sobra<br><strong>${formatNumber(bin.waste)} mm</strong>`; row.append(label, track, waste); ui.barsVisual.appendChild(row);
      });
    });
    ui.patternsBody.innerHTML = '';
    projectResult.profileResults.forEach(result => groupedPatterns(result).forEach((group, patternIndex) => {
      const bin = group.example, row = document.createElement('tr'), sequence = bin.items.map(item => `<span class="cut-chip">${escapeHtml(item.id)} · ${formatNumber(item.length)} mm</span>`).join('');
      row.innerHTML = `<td><strong>${escapeHtml(result.config.name)}</strong><br><small>${escapeHtml(profileDescription(result.config))}</small></td><td><span class="pattern-code">PC-${String(patternIndex + 1).padStart(2, '0')}</span><br><small>Barras ${group.bins.join(', ')}</small></td><td>${escapeHtml(bin.stockType.label)}<br><strong>${formatNumber(bin.stockLength)} mm</strong></td><td><strong>${group.bins.length}</strong></td><td class="cut-sequence">${sequence}</td><td>${formatNumber(bin.used)} mm</td><td>${formatNumber(bin.waste)} mm</td><td>${formatNumber(bin.utilization, 1)}%</td>`; ui.patternsBody.appendChild(row);
    }));
  }

  function workbookAvailable() { if (window.XLSX) return true; setMessage('O módulo de Excel não foi carregado. Recarregue a página e tente novamente.', 'error'); return false; }
  function downloadTemplate() {
    if (!workbookAvailable()) return;
    const profiles = XLSX.utils.aoa_to_sheet([
      ['Perfil', 'Material', 'Tipo_secao', 'Dimensao_A_mm', 'Dimensao_B_mm', 'Espessura_mm', 'Kerf_mm', 'Tipo_blank', 'Comprimento_blank_mm', 'Quantidade_blank'],
      ['Tubo principal', 'Aço carbono', 'Tubo redondo', 60, '', 3, 3, 'Comercial', 6000, ''],
      ['Tubo principal', 'Aço carbono', 'Tubo redondo', 60, '', 3, 3, 'Retalho', 1850, 2],
      ['Travessas', 'Aço carbono', 'Tubo retangular', 80, 40, 3, 3, 'Comercial', 6000, '']
    ]);
    const cuts = XLSX.utils.aoa_to_sheet([
      ['Perfil', 'Identificacao', 'Comprimento_mm', 'Quantidade', 'Observacao'],
      ['Tubo principal', 'P01', 1200, 4, 'Exemplo — substitua esta linha'],
      ['Travessas', 'T01', 850, 6, 'Exemplo — substitua esta linha']
    ]);
    const instructions = XLSX.utils.aoa_to_sheet([
      ['MODELO PIPESAVER — PROJETO COMPLETO'],
      ['Cadastre cada seção na aba Perfis. Repita o nome do perfil para adicionar mais blanks ou retalhos à mesma seção.'],
      ['Na aba Cortes, use exatamente o mesmo nome da coluna Perfil para relacionar cada peça à seção correta.'],
      ['Quantidade_blank vazia significa disponibilidade ilimitada.'],
      ['Tipos aceitos', 'Tubo redondo, Tubo quadrado, Tubo retangular, Barra redonda, Barra chata, Cantoneira e Outro perfil.']
    ]);
    profiles['!cols'] = [{wch:22},{wch:18},{wch:20},{wch:17},{wch:17},{wch:17},{wch:12},{wch:14},{wch:24},{wch:20}]; cuts['!cols'] = [{wch:22},{wch:20},{wch:20},{wch:14},{wch:38}]; instructions['!cols'] = [{wch:34},{wch:100}];
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, profiles, 'Perfis'); XLSX.utils.book_append_sheet(workbook, cuts, 'Cortes'); XLSX.utils.book_append_sheet(workbook, instructions, 'Instrucoes'); XLSX.writeFile(workbook, 'modelo_projeto_pipesaver.xlsx'); setMessage('Modelo de projeto completo baixado.', 'success');
  }
  function findHeader(headers, aliases) { return headers.find(header => aliases.includes(normalizeHeader(header))); }
  function sectionTypeFrom(value) {
    const key = normalizeHeader(value), aliases = { roundTube:['tuboredondo','roundtube'], squareTube:['tuboquadrado','squaretube'], rectTube:['tuboretangular','recttube'], roundBar:['barraredonda','roundbar'], flatBar:['barrachata','flatbar'], angle:['cantoneira','angle'], custom:['outroperfil','personalizado','custom'] };
    return Object.keys(aliases).find(type => aliases[type].includes(key)) || 'custom';
  }
  function dimensionsFromSheet(type, a, b, thickness) {
    if (type === 'roundTube') return { diameter:a, thickness };
    if (type === 'squareTube') return { side:a, thickness };
    if (type === 'rectTube') return { width:a, height:b, thickness };
    if (type === 'roundBar') return { diameter:a };
    if (type === 'flatBar') return { width:a, thickness: thickness || b };
    if (type === 'angle') return { legA:a, legB:b, thickness };
    return { description:String(a || 'Perfil personalizado') };
  }
  async function importExcel(file) {
    if (!workbookAvailable()) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type:'array' }), cutsSheetName = workbook.SheetNames.find(name => normalizeHeader(name) === 'cortes') || workbook.SheetNames[0], cutRows = XLSX.utils.sheet_to_json(workbook.Sheets[cutsSheetName], { defval:'' });
      if (!cutRows.length) throw new Error('A planilha não contém linhas de corte.');
      const profilesSheetName = workbook.SheetNames.find(name => normalizeHeader(name) === 'perfis'); let importedProfiles = null;
      if (profilesSheetName) {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[profilesSheetName], { defval:'' }); if (!rows.length) throw new Error('A aba Perfis está vazia.');
        const headers = Object.keys(rows[0]), profileHeader = findHeader(headers,['perfil','profile']), materialHeader = findHeader(headers,['material']), typeHeader = findHeader(headers,['tiposecao','tipoperfil','sectiontype']), aHeader = findHeader(headers,['dimensaoamm','dimensaoa','diametroexternomm','larguramm']), bHeader = findHeader(headers,['dimensaobmm','dimensaob','alturamm']), thicknessHeader = findHeader(headers,['espessuramm','espessura']), kerfHeader = findHeader(headers,['kerfmm','kerf','espessuradecortemm']), kindHeader = findHeader(headers,['tipoblank','origemblank']), lengthHeader = findHeader(headers,['comprimentoblankmm','comprimentoblank']), quantityHeader = findHeader(headers,['quantidadeblank','qtdblank']);
        if (!profileHeader || !lengthHeader) throw new Error('A aba Perfis deve conter Perfil e Comprimento_blank_mm.');
        const map = new Map();
        rows.forEach((row, index) => {
          const name = String(row[profileHeader]).trim(); if (!name) throw new Error(`Perfil vazio na linha ${index + 2}.`);
          const key = normalizeHeader(name); let profile = map.get(key);
          if (!profile) { profile = makeProfile(name); profile.material = String(materialHeader ? row[materialHeader] : '').trim() || 'Não informado'; profile.type = sectionTypeFrom(typeHeader ? row[typeHeader] : 'Outro perfil'); profile.dimensions = dimensionsFromSheet(profile.type, aHeader ? row[aHeader] : '', bHeader ? row[bHeader] : '', thicknessHeader ? row[thicknessHeader] : ''); profile.kerf = kerfHeader ? row[kerfHeader] : 3; profile.stocks = []; profile.cuts = []; map.set(key, profile); }
          const length = numberFrom(row[lengthHeader]); if (!(length > 0)) throw new Error(`Comprimento de blank inválido na linha ${index + 2}.`);
          const rawQuantity = quantityHeader ? String(row[quantityHeader]).trim() : '';
          profile.stocks.push({ id:`stock-${state.nextStockId++}`, kind: normalizeHeader(kindHeader ? row[kindHeader] : '') === 'retalho' ? 'scrap' : 'commercial', length, quantity: rawQuantity });
        });
        importedProfiles = [...map.values()];
      }
      const headers = Object.keys(cutRows[0]), profileHeader = findHeader(headers,['perfil','profile']), idHeader = findHeader(headers,['identificacao','id','codigo','peca','descricao','nome']), lengthHeader = findHeader(headers,['comprimentomm','comprimento','medidamm','medida','lengthmm','length']), quantityHeader = findHeader(headers,['quantidade','qtd','qtde','quantity','qty']);
      if (!lengthHeader || !quantityHeader) throw new Error('A aba Cortes deve conter Comprimento_mm e Quantidade.');
      if (importedProfiles) {
        const map = new Map(importedProfiles.map(profile => [normalizeHeader(profile.name), profile]));
        cutRows.forEach((row, index) => { const profileKey = normalizeHeader(profileHeader ? row[profileHeader] : ''); const profile = map.get(profileKey); if (!profile) throw new Error(`Perfil não encontrado na linha ${index + 2} da aba Cortes.`); const length = numberFrom(row[lengthHeader]), quantity = Math.trunc(numberFrom(row[quantityHeader])); if (!(length > 0) || !(quantity >= 1)) throw new Error(`Corte inválido na linha ${index + 2}.`); profile.cuts.push({ rowId:`cut-${state.nextCutId++}`, id:String(idHeader ? row[idHeader] : '').trim() || `P${profile.cuts.length + 1}`, length, quantity }); });
        state.profiles = importedProfiles; state.activeProfileId = importedProfiles[0].id;
      } else {
        serializeActiveProfile(); const profile = activeProfile(); profile.cuts = [];
        cutRows.forEach((row, index) => { const length = numberFrom(row[lengthHeader]), quantity = Math.trunc(numberFrom(row[quantityHeader])); if (!(length > 0) || !(quantity >= 1)) throw new Error(`Dados inválidos na linha ${index + 2}.`); profile.cuts.push({ rowId:`cut-${state.nextCutId++}`, id:String(idHeader ? row[idHeader] : '').trim() || `P${index + 1}`, length, quantity }); });
      }
      renderActiveProfile(); invalidateResult(); setMessage(`${cutRows.length} medida(s) e ${importedProfiles ? importedProfiles.length : 1} perfil(is) importado(s) de “${file.name}”.`, 'success');
    } catch (error) { setMessage(error.message, 'error'); }
    finally { ui.excelInput.value = ''; }
  }
  function exportResult() {
    if (!state.result || !workbookAvailable()) return;
    const project = state.result, summaryData = [['PIPESAVER — PROJETO COMPLETO'],['Projeto',project.config.projectName],['Perfis',project.profileResults.length],['Blanks utilizados',project.totalBars],['Peças',project.totalPieces],['Aproveitamento (%)',Number(project.utilization.toFixed(2))],['Perda de corte (mm)',Number(project.totalKerfLoss.toFixed(2))],['Sobra total (mm)',Number(project.totalWaste.toFixed(2))],['Gerado em',project.createdAt.toLocaleString('pt-BR')]], stockData = [['Perfil','Material','Seção','Tipo_blank','Comprimento_blank_mm','Quantidade_disponivel','Quantidade_utilizada']], planData = [['Perfil','Barra','Padrão','Tipo_blank','Comprimento_blank_mm','Ordem','Identificação','Comprimento_mm','Kerf_apos_mm','Usado_barra_mm','Sobra_barra_mm']], demandData = [['Perfil','Identificacao','Comprimento_mm','Quantidade']];
    project.profileResults.forEach(result => {
      const usage = new Map(); result.bins.forEach(bin => usage.set(bin.stockType.id,(usage.get(bin.stockType.id)||0)+1));
      result.config.stockTypes.forEach(stock => stockData.push([result.config.name,result.config.material,profileDescription(result.config),stock.label,stock.length,stock.quantity === null ? 'Ilimitada' : stock.quantity,usage.get(stock.id)||0]));
      const patternMap = new Map(); groupedPatterns(result).forEach((group,index) => group.bins.forEach(bar => patternMap.set(bar,`PC-${String(index+1).padStart(2,'0')}`)));
      result.bins.forEach((bin,barIndex) => bin.items.forEach((item,itemIndex) => planData.push([result.config.name,barIndex+1,patternMap.get(barIndex+1),bin.stockType.label,bin.stockLength,itemIndex+1,item.id,item.length,itemIndex<bin.items.length-1?result.config.kerf:0,Number(bin.used.toFixed(3)),Number(bin.waste.toFixed(3))])));
      result.config.cuts.forEach(cut => demandData.push([result.config.name,cut.id,cut.length,cut.quantity]));
    });
    const workbook = XLSX.utils.book_new(); [['Resumo',summaryData],['Estoque',stockData],['Plano_de_corte',planData],['Demanda',demandData]].forEach(([name,data]) => XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet(data),name)); XLSX.writeFile(workbook,`${safeFileName(project.config.projectName)}_pipesaver.xlsx`); setMessage('Projeto completo exportado para Excel.','success');
  }
  async function executeOptimization() {
    try { const config = readProjectConfig(); ui.optimizeButton.disabled = true; ui.optimizeButton.firstElementChild.textContent = 'Otimizando projeto…'; setMessage('Calculando todos os perfis e blanks…'); await new Promise(resolve => setTimeout(resolve,30)); const started = performance.now(), result = optimizeProject(config); result.elapsedMs = performance.now()-started; renderResult(result); setMessage(`Projeto concluído em ${formatNumber(result.elapsedMs,0)} ms.`,'success'); }
    catch (error) { setMessage(error.message,'error'); }
    finally { ui.optimizeButton.disabled = false; ui.optimizeButton.firstElementChild.textContent = 'Gerar plano de corte'; }
  }

  ui.profileSelect.addEventListener('change', event => { serializeActiveProfile(); state.activeProfileId = event.target.value; renderActiveProfile(); });
  ui.addProfileButton.addEventListener('click', () => { serializeActiveProfile(); const profile = makeProfile(`Perfil ${state.profiles.length + 1}`); state.profiles.push(profile); state.activeProfileId = profile.id; renderActiveProfile(); invalidateResult(); ui.profileName.focus(); });
  ui.removeProfileButton.addEventListener('click', () => { if (state.profiles.length <= 1) return; const index = state.profiles.findIndex(profile => profile.id === state.activeProfileId); state.profiles.splice(index,1); state.activeProfileId = state.profiles[Math.max(0,index-1)].id; renderActiveProfile(); invalidateResult(); });
  ui.profileName.addEventListener('input', () => { const profile=activeProfile(); if(profile){profile.name=ui.profileName.value; const option=ui.profileSelect.querySelector(`option[value="${profile.id}"]`); if(option) option.textContent=profile.name||'Perfil sem nome';} invalidateResult(); });
  ui.sectionType.addEventListener('change', () => { const profile=activeProfile(); if(!profile)return; profile.type=ui.sectionType.value; profile.dimensions=defaultDimensions(profile.type); renderDimensionFields(profile); invalidateResult(); });
  [ui.projectName,ui.material,ui.kerf].forEach(input => input.addEventListener('change',invalidateResult));
  ui.addStockButton.addEventListener('click', () => addStockRow({kind:'scrap',length:1000,quantity:1},true)); ui.addCutButton.addEventListener('click', () => addCutRow({},true));
  ui.templateButton.addEventListener('click',downloadTemplate); ui.excelInput.addEventListener('change',event => event.target.files[0]&&importExcel(event.target.files[0])); ui.optimizeButton.addEventListener('click',executeOptimization); ui.exportButton.addEventListener('click',exportResult); ui.printButton.addEventListener('click',()=>window.print());

  const firstProfile = makeProfile('Perfil 1'); state.profiles.push(firstProfile); state.activeProfileId = firstProfile.id; renderActiveProfile();
  window.PipeSaverCore = Object.freeze({ optimizeCuttingList, optimizeProject, groupedPatterns, profileDescription, numberFrom });
})();
