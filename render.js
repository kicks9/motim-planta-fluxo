// Renderização do mapa de corredores/mesas e do relatório de pendências.

function categoryBadge(category) {
  const map = {
    Risografia: "RI",
    Serigrafia: "SE",
    Encadernação: "EN",
    Ilustração: "IL",
    Cerâmica: "CE",
    Fanzine: "FZ",
  };
  return map[category] || category.slice(0, 2).toUpperCase();
}

function tableNode(exhibitor, corridor) {
  const div = document.createElement("div");
  div.className = "mesa";
  div.title = `${exhibitor.name} — ${exhibitor.category}`;

  const badge = document.createElement("span");
  badge.className = "mesa-badge";
  badge.textContent = categoryBadge(exhibitor.category);
  div.appendChild(badge);

  const tags = document.createElement("div");
  tags.className = "mesa-tags";
  if (exhibitor.accessibility === "wheelchair") tags.appendChild(tagEl("acessibilidade", "acessibilidade"));
  if (exhibitor.soundSensitive) tags.appendChild(tagEl("som", "sensível a som"));
  if (exhibitor.needsOutlet) tags.appendChild(tagEl("tomada", "precisa de tomada"));
  if (exhibitor.novice) tags.appendChild(tagEl("novato", "novato"));
  div.appendChild(tags);

  const name = document.createElement("div");
  name.className = "mesa-nome";
  name.textContent = exhibitor.name;
  div.appendChild(name);

  return div;
}

const TAG_CODE = {
  acessibilidade: "PCD",
  som: "SOM",
  tomada: "ENERG",
  novato: "NOVO",
};

function tagEl(kind, label) {
  const span = document.createElement("span");
  span.className = `mesa-tag mesa-tag--${kind}`;
  span.textContent = TAG_CODE[kind] || kind;
  span.title = label;
  return span;
}

function renderMap(corridors, flowRisk, showRisk) {
  const container = document.getElementById("mapa");
  container.innerHTML = "";

  corridors.forEach((corridor) => {
    const row = document.createElement("div");
    row.className = "corredor";
    if (showRisk) row.classList.add("risco-" + flowRisk[corridor.id].level);

    const header = document.createElement("div");
    header.className = "corredor-header";
    const risk = flowRisk[corridor.id];
    const riskLabel = showRisk
      ? ` · risco de fluxo: <strong>${risk.level}</strong> (${risk.density.toFixed(1)} pessoas/m², ~${Math.round(risk.occupancyEstimate)} pessoas no pico)`
      : "";
    header.innerHTML = `<strong>${corridor.label}</strong> <span class="corredor-meta">(${corridor.width}, ${corridor.assigned.length}/${corridor.slots} mesas)${riskLabel}</span>`;
    row.appendChild(header);

    const trail = document.createElement("div");
    trail.className = "mesas-trilha";
    corridor.assigned.forEach((e) => trail.appendChild(tableNode(e, corridor)));
    // slots vazios, se sobrar
    for (let i = corridor.assigned.length; i < corridor.slots; i++) {
      const empty = document.createElement("div");
      empty.className = "mesa mesa-vazia";
      empty.textContent = "vago";
      trail.appendChild(empty);
    }
    row.appendChild(trail);
    container.appendChild(row);
  });
}

function renderPending(pendingRaw) {
  const { formatPending } = window.MotimApp;
  const lines = formatPending(pendingRaw);
  const list = document.getElementById("pendencias-lista");
  list.innerHTML = "";
  if (!lines.length) {
    const li = document.createElement("li");
    li.className = "pendencia-ok";
    li.textContent = "Nenhuma pendência física detectada nesta alocação.";
    list.appendChild(li);
    return;
  }
  lines.forEach((line) => {
    const li = document.createElement("li");
    li.textContent = line;
    list.appendChild(li);
  });
}

function renderResumo(n, corridors, elapsedMs, extensionsUsed, extensionBudget) {
  const resumo = document.getElementById("resumo");
  const totalSlots = corridors.reduce((acc, c) => acc + c.slots, 0);
  const extInfo = extensionBudget ? ` · ${extensionsUsed}/${extensionBudget} extensões de estoque usadas` : "";
  resumo.textContent = `${n} expositores · ${corridors.length} corredores · ${totalSlots} mesas disponíveis · gerado em ${elapsedMs.toFixed(1)}ms${extInfo}`;
}

const SIGNAGE_LABEL = {
  "mapa-geral": "Mapa geral",
  corredor: "Identificação de corredor",
  acessibilidade: "Rota acessível",
  som: "Zona de som",
  fluxo: "Risco de fluxo",
};

function renderSignage(signs) {
  const container = document.getElementById("sinalizacao-lista");
  container.innerHTML = "";
  signs.forEach((sign) => {
    const li = document.createElement("li");
    li.className = `sinalizacao-item sinalizacao-item--${sign.category}`;
    li.innerHTML = `<span class="sinalizacao-tipo">${SIGNAGE_LABEL[sign.category] || sign.category}</span><span class="sinalizacao-local">${sign.location}</span><span class="sinalizacao-texto">${sign.text}</span>`;
    container.appendChild(li);
  });
  document.getElementById("sinalizacao-contagem").textContent = `${signs.length} placas`;
}

// ---------- Biblioteca de perfis de local (estado em memória + localStorage) ----------
const NOVO_LOCAL_VALUE = "__novo__";
let profiles = [];
let lastProfileId = null;

function loadCustomProfiles() {
  try {
    const raw = localStorage.getItem("motim-perfis-custom");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomProfile(profile) {
  try {
    const custom = loadCustomProfiles();
    custom.push(profile);
    localStorage.setItem("motim-perfis-custom", JSON.stringify(custom));
  } catch {
    // armazenamento indisponível (ex: aba anônima) — perfil continua valendo só nesta sessão
  }
}

function profileCapacity(profile) {
  return profile.corridors.reduce((acc, c) => acc + c.slots, 0);
}

function populatePerfilSelect(selectedId) {
  const select = document.getElementById("perfil-local");
  select.innerHTML = "";
  profiles.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.verified ? p.name : `${p.name} ⚠`;
    select.appendChild(opt);
  });
  const novoOpt = document.createElement("option");
  novoOpt.value = NOVO_LOCAL_VALUE;
  novoOpt.textContent = "+ Cadastrar novo local";
  select.appendChild(novoOpt);
  select.value = selectedId || profiles[0].id;
}

function renderPerfilInfo(profile) {
  const info = document.getElementById("perfil-info");
  if (!profile) {
    info.textContent = "";
    return;
  }
  const badge = profile.verified ? "" : "⚠ provisório — ";
  info.textContent = `${badge}${profile.note || ""}`;
  info.classList.toggle("perfil-info--alerta", !profile.verified);
}

// ---------- Formulário "+ Cadastrar novo local" ----------
function addCorredorRow(prefill) {
  const container = document.getElementById("corredores-rows");
  const row = document.createElement("div");
  row.className = "corredor-row";
  row.innerHTML = `
    <select class="row-width">
      <option value="largo">largo</option>
      <option value="médio">médio</option>
      <option value="estreito">estreito</option>
    </select>
    <input type="number" class="row-slots" min="1" value="${prefill?.slots ?? 20}" placeholder="mesas" />
    <label><input type="checkbox" class="row-bathroom" ${prefill?.accessibleBathroomNearby ? "checked" : ""} /> banheiro acessível perto</label>
    <label><input type="checkbox" class="row-sound" ${prefill?.soundZoneNear ? "checked" : ""} /> perto da zona de som</label>
    <button type="button" class="row-remover" title="Remover corredor">✕</button>
  `;
  row.querySelector(".row-width").value = prefill?.width || "médio";
  row.querySelector(".row-remover").addEventListener("click", () => row.remove());
  container.appendChild(row);
}

function resetNovoLocalForm() {
  document.getElementById("novo-local-nome").value = "";
  document.getElementById("novo-local-visitantes").value = 1000;
  document.getElementById("corredores-rows").innerHTML = "";
  addCorredorRow({ width: "largo", slots: 20, accessibleBathroomNearby: true });
  addCorredorRow({ width: "médio", slots: 20 });
  addCorredorRow({ width: "estreito", slots: 20, soundZoneNear: true });
}

function readCorredorRows() {
  return Array.from(document.querySelectorAll("#corredores-rows .corredor-row")).map((row) => ({
    width: row.querySelector(".row-width").value,
    slots: Math.max(1, parseInt(row.querySelector(".row-slots").value, 10) || 1),
    accessibleBathroomNearby: row.querySelector(".row-bathroom").checked,
    soundZoneNear: row.querySelector(".row-sound").checked,
  }));
}

function toggleNovoLocalForm(show) {
  document.getElementById("form-novo-local").hidden = !show;
}

// ---------- Dataset atual + execução ----------
function currentDataset() {
  const { generateExhibitors } = window.MotimApp;
  const profile = profiles.find((p) => p.id === document.getElementById("perfil-local").value);
  const capacity = profileCapacity(profile);
  let n = parseInt(document.getElementById("qtd-expositores").value, 10) || capacity;
  let overflow = false;
  if (n > capacity) {
    overflow = true;
    n = capacity;
  }
  const dailyVisitors = parseInt(document.getElementById("qtd-visitantes").value, 10) || profile.dailyVisitors || 0;
  return { exhibitors: generateExhibitors(n), venue: { corridors: profile.corridors, extensionBudget: profile.extensionBudget }, profile, overflow, capacity, dailyVisitors };
}

function runAndRender() {
  const { allocate, computeFlowRisk, generateSignagePlan } = window.MotimApp;
  const { exhibitors, venue, profile, overflow, capacity, dailyVisitors } = currentDataset();
  renderPerfilInfo(profile);
  const t0 = performance.now();
  const { corridors, pending, extensionsUsed, extensionBudget } = allocate(exhibitors, venue);
  const flowRisk = computeFlowRisk(corridors, dailyVisitors);
  const elapsedMs = performance.now() - t0;
  const showRisk = document.getElementById("toggle-risco").checked;
  renderMap(corridors, flowRisk, showRisk);
  renderPending(pending);
  renderResumo(exhibitors.length, corridors, elapsedMs, extensionsUsed, extensionBudget);
  renderSignage(generateSignagePlan(corridors, flowRisk));
  if (overflow) {
    const resumo = document.getElementById("resumo");
    resumo.textContent += ` · quantidade pedida excedia a capacidade (${capacity} mesas) — ajustada pra ${capacity}.`;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const { VENUE_PROFILES, buildProfileFromRows } = window.MotimApp;
  profiles = [...VENUE_PROFILES, ...loadCustomProfiles()];
  lastProfileId = profiles[0].id;
  populatePerfilSelect(lastProfileId);
  document.getElementById("qtd-expositores").value = profileCapacity(profiles[0]);
  document.getElementById("qtd-visitantes").value = profiles[0].dailyVisitors || 0;

  document.getElementById("perfil-local").addEventListener("change", (ev) => {
    if (ev.target.value === NOVO_LOCAL_VALUE) {
      toggleNovoLocalForm(true);
      resetNovoLocalForm();
      return;
    }
    toggleNovoLocalForm(false);
    lastProfileId = ev.target.value;
    const profile = profiles.find((p) => p.id === lastProfileId);
    document.getElementById("qtd-expositores").value = profileCapacity(profile);
    document.getElementById("qtd-visitantes").value = profile.dailyVisitors || 0;
    runAndRender();
  });

  document.getElementById("add-corredor").addEventListener("click", () => addCorredorRow());

  document.getElementById("cancelar-novo-local").addEventListener("click", () => {
    toggleNovoLocalForm(false);
    populatePerfilSelect(lastProfileId);
  });

  document.getElementById("salvar-perfil").addEventListener("click", () => {
    const nome = document.getElementById("novo-local-nome").value.trim();
    const rows = readCorredorRows();
    if (!rows.length) {
      alert("Adicione pelo menos um corredor antes de salvar.");
      return;
    }
    const dailyVisitors = Math.max(1, parseInt(document.getElementById("novo-local-visitantes").value, 10) || 1000);
    const profile = buildProfileFromRows(nome, rows, dailyVisitors);
    profiles.push(profile);
    saveCustomProfile(profile);
    toggleNovoLocalForm(false);
    lastProfileId = profile.id;
    populatePerfilSelect(lastProfileId);
    document.getElementById("qtd-expositores").value = profileCapacity(profile);
    document.getElementById("qtd-visitantes").value = profile.dailyVisitors;
    runAndRender();
  });

  document.getElementById("gerar").addEventListener("click", runAndRender);
  document.getElementById("toggle-risco").addEventListener("change", runAndRender);
  document.getElementById("imprimir-sinalizacao").addEventListener("click", () => window.print());
  runAndRender();
});
