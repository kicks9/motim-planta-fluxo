// Motim — Gerador de planta + risco de fluxo
// Protótipo: aloca expositores nos corredores respeitando restrições de acessibilidade,
// som, tomada e cota de novato, e sinaliza risco de aglomeração por corredor.

// ---------- Biblioteca de perfis de local ----------
// A Motim muda de local a cada edição, então não existe "o" mapa certo — cada perfil
// descreve um espaço real (ou provisório) que a organização pode escolher antes de gerar
// a alocação. "verified: true" = baseado em dado concreto; "false" = esqueleto provisório,
// a ser ajustado por quem conhece o local de verdade antes de usar pra valer.

// Espalha N pontos de energia ao longo de `slots` posições (só define a capacidade, não a
// posição física exata — a planta real decide isso).
function computePowerPoints(slots, rate = 0.25) {
  const count = Math.max(1, Math.ceil(slots * rate));
  return Array.from({ length: count }, (_, k) => Math.floor(((k + 1) * slots) / (count + 1)));
}

// Gera um esqueleto de corredores repetindo o padrão largo/médio/estreito — usado como ponto
// de partida provisório (perfis não verificados) ou pelo botão "gerar esqueleto" do formulário
// de novo local; nunca deve ser tratado como mapa real sem revisão.
function makeArchetypeCorridors(numCorridors, slotsPerCorridor) {
  const archetypes = [
    { width: "largo", widthFactor: 3, accessibleBathroomNearby: true, soundZoneNear: false },
    { width: "médio", widthFactor: 2, accessibleBathroomNearby: false, soundZoneNear: false },
    { width: "estreito", widthFactor: 1, accessibleBathroomNearby: false, soundZoneNear: true },
  ];
  return Array.from({ length: numCorridors }, (_, i) => {
    const archetype = archetypes[i % archetypes.length];
    const id = String.fromCharCode(65 + i); // A, B, C, D...
    return {
      id,
      label: `Corredor ${id}`,
      width: archetype.width,
      widthFactor: archetype.widthFactor,
      slots: slotsPerCorridor,
      powerPoints: computePowerPoints(slotsPerCorridor),
      accessibleBathroomNearby: archetype.accessibleBathroomNearby,
      soundZoneNear: archetype.soundZoneNear,
    };
  });
}

const VENUE_PROFILES = [
  {
    id: "exemplo",
    name: "Exemplo pequeno (demo)",
    verified: true,
    note: "Local fictício, só pra demonstração rápida com poucos expositores.",
    extensionBudget: 2,
    dailyVisitors: 150,
    corridors: [
      { id: "A", label: "Corredor A", width: "largo", widthFactor: 3, slots: 10, powerPoints: [2, 7], accessibleBathroomNearby: true, soundZoneNear: false },
      { id: "B", label: "Corredor B", width: "médio", widthFactor: 2, slots: 10, powerPoints: [4], accessibleBathroomNearby: false, soundZoneNear: false },
      { id: "C", label: "Corredor C", width: "estreito", widthFactor: 1, slots: 10, powerPoints: [1, 5], accessibleBathroomNearby: false, soundZoneNear: true },
    ],
  },
  {
    id: "conic-n22",
    name: "Conic — SDS Conic (edição N22)",
    verified: true,
    note: "Baseado na lista pública de expositores da N22 (motim.art/expositores-n22): 3 corredores (A/B/C), entrada Sul e Norte. A contagem de mesas é aproximada — a numeração real tem lacunas e subdivisões (ex: A103.1/A103.2) — e a posição do banheiro acessível/zona de som não está confirmada, ajuste se souber o real. Visitantes/dia: estimativa (N22 é o formato reduzido 'Montim', menor que as grandes edições de +10 mil/dia) — ajuste se souber o real.",
    extensionBudget: 10,
    dailyVisitors: 3000,
    corridors: [
      { id: "A", label: "Corredor A", width: "largo", widthFactor: 3, slots: 113, powerPoints: computePowerPoints(113), accessibleBathroomNearby: true, soundZoneNear: false },
      { id: "B", label: "Corredor B", width: "médio", widthFactor: 2, slots: 52, powerPoints: computePowerPoints(52), accessibleBathroomNearby: false, soundZoneNear: false },
      { id: "C", label: "Corredor C", width: "estreito", widthFactor: 1, slots: 52, powerPoints: computePowerPoints(52), accessibleBathroomNearby: false, soundZoneNear: true },
    ],
  },
  {
    id: "galeria-dos-estados",
    name: "Galeria dos Estados (perfil provisório)",
    verified: false,
    note: "Local mais recorrente da Motim nas edições grandes (+325 expositores), mas ainda sem mapeamento detalhado de corredores — esqueleto gerado automaticamente. Substitua pelos corredores reais antes de usar pra decisão de verdade. Visitantes/dia: 10 mil, direto da pesquisa exploratória (edições grandes).",
    extensionBudget: 10,
    dailyVisitors: 10000,
    corridors: makeArchetypeCorridors(5, 24),
  },
  {
    id: "museu-nacional",
    name: "Museu Nacional da República (perfil provisório)",
    verified: false,
    note: "Edição recorde de público (+14 mil em 2 dias ≈ 7 mil/dia), sem mapeamento detalhado ainda — esqueleto provisório.",
    extensionBudget: 8,
    dailyVisitors: 7000,
    corridors: makeArchetypeCorridors(4, 24),
  },
  {
    id: "ccbb",
    name: "CCBB Brasília (perfil provisório)",
    verified: false,
    note: "Sem mapeamento detalhado ainda — esqueleto provisório. Visitantes/dia: estimativa, sem dado específico da pesquisa.",
    extensionBudget: 6,
    dailyVisitors: 4000,
    corridors: makeArchetypeCorridors(3, 20),
  },
];

// ---------- Algoritmo de alocação ----------
// Regras, em ordem de prioridade (restrição dura primeiro):
// 1) cadeirante -> corredor largo + banheiro acessível por perto
// 2) sensível a som -> nunca no corredor perto da zona de som
// 3) precisa de tomada -> prioriza slot marcado como ponto de energia
// 4) cota de novato -> pelo menos ~30% de novatos em cada corredor
// 5) proximidade pedida -> tenta deixar lado a lado no mesmo corredor
// 6) resto -> preenche balanceando contagem de mesas por corredor

function allocate(exhibitors, venue) {
  const corridors = venue.corridors.map((c) => ({ ...c, assigned: [] }));
  const pending = []; // restrições não atendidas, viram "pendências físicas"
  const byId = Object.fromEntries(exhibitors.map((e) => [e.id, e]));
  const placed = new Set();
  let extensionsLeft = venue.extensionBudget || 0;
  let extensionsUsed = 0;

  function corridorById(id) {
    return corridors.find((c) => c.id === id);
  }
  function hasSpace(corridor) {
    return corridor.assigned.length < corridor.slots;
  }
  function place(exhibitor, corridor) {
    corridor.assigned.push(exhibitor);
    placed.add(exhibitor.id);
  }
  function freeOutletSlotCount(corridor) {
    const used = corridor.assigned.filter((e) => e.needsOutlet).length;
    return Math.max(corridor.powerPoints.length - used, 0);
  }

  // 1) cadeirantes — corredor largo com banheiro acessível perto
  const wheelchairTargets = corridors.filter((c) => c.accessibleBathroomNearby && c.width === "largo");
  exhibitors
    .filter((e) => e.accessibility === "wheelchair")
    .forEach((e) => {
      const target = wheelchairTargets.find(hasSpace) || corridors.filter(hasSpace)[0];
      if (target) place(e, target);
      else pending.push({ kind: "wheelchair-no-space", name: e.name });
    });

  // 2) sensíveis a som — nunca no corredor perto da zona de som
  exhibitors
    .filter((e) => !placed.has(e.id) && e.soundSensitive)
    .forEach((e) => {
      const target = corridors.filter((c) => !c.soundZoneNear && hasSpace(c)).sort((a, b) => a.assigned.length - b.assigned.length)[0];
      if (target) place(e, target);
      else pending.push({ kind: "sound-no-space", name: e.name });
    });

  // 3) precisam de tomada — prioriza corredor com ponto de energia livre
  exhibitors
    .filter((e) => !placed.has(e.id) && e.needsOutlet)
    .forEach((e) => {
      const withFreeOutlet = corridors.filter((c) => hasSpace(c) && freeOutletSlotCount(c) > 0).sort((a, b) => b.widthFactor - a.widthFactor)[0];
      if (withFreeOutlet) {
        place(e, withFreeOutlet);
      } else {
        const fallback = corridors.filter(hasSpace).sort((a, b) => a.assigned.length - b.assigned.length)[0];
        if (fallback) {
          place(e, fallback);
          if (extensionsLeft > 0) {
            // cobre com extensão do estoque da organização em vez de virar pendência de infraestrutura
            extensionsLeft -= 1;
            extensionsUsed += 1;
          } else {
            pending.push({ kind: "outlet-shortage", name: e.name, corridorId: fallback.id });
          }
        }
      }
    });

  // 4) resto — distribui mantendo cota de novato equilibrada entre corredores
  const rest = exhibitors.filter((e) => !placed.has(e.id));
  rest.forEach((e) => {
    const available = corridors.filter(hasSpace);
    if (!available.length) {
      pending.push({ kind: "no-space", name: e.name });
      return;
    }
    // prioriza o corredor com a menor proporção de novatos até agora, se o próprio for novato;
    // senão o corredor mais vazio.
    let target;
    if (e.novice) {
      target = available
        .map((c) => ({ c, noviceRatio: c.assigned.filter((x) => x.novice).length / Math.max(c.assigned.length, 1) }))
        .sort((a, b) => a.noviceRatio - b.noviceRatio)[0].c;
    } else {
      target = available.sort((a, b) => a.assigned.length - b.assigned.length)[0];
    }
    place(e, target);
  });

  // 5) proximidade pedida — troca posição dentro do próprio corredor quando possível (best-effort,
  // só reordena a sequência interna; não força mudar de corredor pra não quebrar as regras duras)
  corridors.forEach((corridor) => {
    corridor.assigned.forEach((e, idx) => {
      if (e.wantsNear && byId[e.wantsNear]) {
        const targetIdx = corridor.assigned.findIndex((x) => x.id === e.wantsNear);
        if (targetIdx !== -1 && Math.abs(targetIdx - idx) > 1) {
          // aproxima movendo o vizinho pedido para o slot logo depois de e
          const [neighbor] = corridor.assigned.splice(targetIdx, 1);
          const newIdx = corridor.assigned.findIndex((x) => x.id === e.id);
          corridor.assigned.splice(newIdx + 1, 0, neighbor);
        }
      }
    });
  });

  // cota de novato: sinaliza corredor que ficou abaixo de 20% de novato
  corridors.forEach((c) => {
    const ratio = c.assigned.filter((e) => e.novice).length / Math.max(c.assigned.length, 1);
    if (ratio < 0.2) {
      pending.push({ kind: "novice-quota", corridorId: c.id, ratioPct: Math.round(ratio * 100) });
    }
  });

  return { corridors, pending, extensionsUsed, extensionBudget: venue.extensionBudget || 0 };
}

// Agrega a lista de pendências (objetos estruturados) em linhas de texto legíveis.
// Com poucos casos, nomeia cada expositor; com muitos (ex: teste de carga com 200+),
// resume em contagem por corredor/tipo pra não virar uma lista de 200 linhas.
function formatPending(pending, maxNamed = 6) {
  const groups = new Map();
  pending.forEach((p) => {
    const key = `${p.kind}:${p.corridorId || ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  });

  const lines = [];
  groups.forEach((items, key) => {
    const [kind, corridorId] = key.split(":");
    if (kind === "novice-quota") {
      items.forEach((p) => lines.push(`Corredor ${p.corridorId}: só ${p.ratioPct}% de novatos — abaixo da cota mínima de 20%.`));
      return;
    }
    const labelByKind = {
      "wheelchair-no-space": "nenhum corredor com vaga perto do banheiro acessível",
      "sound-no-space": "todos os corredores sem zona de som estão lotados",
      "outlet-shortage": `pediu tomada mas não havia ponto de energia livre no corredor ${corridorId} — providenciar extensão`,
      "no-space": "não há mais vagas em nenhum corredor",
    };
    const desc = labelByKind[kind] || kind;
    if (items.length <= maxNamed) {
      items.forEach((p) => lines.push(`${p.name}: ${desc}.`));
    } else {
      lines.push(`${items.length} expositores: ${desc} (ex: ${items.slice(0, 3).map((p) => p.name).join(", ")}…).`);
    }
  });
  return lines;
}

// ---------- Risco de fluxo ----------
// Densidade real (pessoas/m²) classificada pelo Level of Service de pedestres de Fruin
// (J. Fruin, "Pedestrian Planning and Design", 1971 — padrão usado em planejamento de
// circulação de eventos e egressos): LOS A-C (confortável) < 1,0 p/m²; LOS D (restrito,
// mas ok) 1,0–2,0 p/m²; LOS E-F (aglomerado, contato físico frequente) > 2,0 p/m².
// Isso substitui a versão anterior, que só comparava corredores entre si sem nenhum
// limite absoluto — por isso ela não conseguia dizer se algo ia "ficar apertado" de
// verdade, só se estava relativamente pior que o resto do mesmo evento.
const WIDTH_METERS_BY_CLASS = { largo: 4, médio: 2.5, estreito: 1.5 };
const TABLE_FRONTAGE_METERS = 1.5; // frente média de uma mesa de expositor + vão de circulação
const PEAK_CONCURRENCY_RATE = 0.15; // fração do público do dia presente simultaneamente no pico (estimativa, ajustável)
const DENSITY_LIMIT_MEDIO = 1.0; // pessoas/m² — início do LOS D (Fruin)
const DENSITY_LIMIT_ALTO = 2.0; // pessoas/m² — início do LOS E (Fruin), ponto de aglomeração

function corridorAreaM2(corridor) {
  const widthM = WIDTH_METERS_BY_CLASS[corridor.width] || 2.5;
  const lengthM = corridor.slots * TABLE_FRONTAGE_METERS;
  return widthM * lengthM;
}

function computeFlowRisk(corridors, dailyVisitors = 0) {
  const totalPopularity = corridors.reduce((acc, c) => acc + c.assigned.reduce((a, e) => a + e.popularity, 0), 0) || 1;
  const peakOccupancyTotal = dailyVisitors * PEAK_CONCURRENCY_RATE;

  return Object.fromEntries(
    corridors.map((c) => {
      const corridorPopularity = c.assigned.reduce((a, e) => a + e.popularity, 0);
      const share = corridorPopularity / totalPopularity;
      const occupancyEstimate = peakOccupancyTotal * share;
      const areaM2 = corridorAreaM2(c);
      const density = areaM2 > 0 ? occupancyEstimate / areaM2 : 0;
      const level = density > DENSITY_LIMIT_ALTO ? "alto" : density > DENSITY_LIMIT_MEDIO ? "médio" : "baixo";
      return [c.id, { density, level, occupancyEstimate, areaM2 }];
    })
  );
}

// ---------- Plano de sinalização ----------
// Deriva, do próprio perfil do local + do resultado da alocação, quais placas são
// necessárias e onde colocar cada uma — não é o desenho gráfico da placa, é a lista de
// providência (o quê, onde, por quê) pra quem vai produzir a sinalização física.
function generateSignagePlan(corridors, flowRisk) {
  const signs = [];

  const accessibleCorridor = corridors.find((c) => c.accessibleBathroomNearby);

  corridors.forEach((c) => {
    // identificação do corredor — sempre necessária, é o que resolve "achar a banca"
    signs.push({
      category: "corredor",
      location: `Entrada do Corredor ${c.id}`,
      text: `Corredor ${c.id} — mesas 1 a ${c.slots}`,
    });

    if (c.accessibleBathroomNearby) {
      signs.push({
        category: "acessibilidade",
        location: `Corredor ${c.id}`,
        text: "Banheiro acessível nesta direção",
      });
    } else if (accessibleCorridor) {
      signs.push({
        category: "acessibilidade",
        location: `Entrada do Corredor ${c.id}`,
        text: `Banheiro acessível: siga para o Corredor ${accessibleCorridor.id}`,
      });
    }

    if (c.soundZoneNear) {
      signs.push({
        category: "som",
        location: `Entrada do Corredor ${c.id}`,
        text: "Atenção: próximo à área de som — nível de ruído mais alto",
      });
    }

    const risk = flowRisk && flowRisk[c.id];
    if (risk && risk.level === "alto") {
      signs.push({
        category: "fluxo",
        location: `Entrada do Corredor ${c.id}`,
        text: "Corredor estreito, fluxo intenso — prefira rotas alternativas em horário de pico",
      });
    }
  });

  // mapa geral — um só, pro ponto de entrada principal, resume a ordem dos corredores
  signs.unshift({
    category: "mapa-geral",
    location: "Entrada principal",
    text: `Mapa geral: ${corridors.map((c) => `Corredor ${c.id} (${c.width})`).join(" → ")}`,
  });

  if (!accessibleCorridor) {
    signs.push({
      category: "acessibilidade",
      location: "—",
      text: "Nenhum corredor deste perfil está marcado com banheiro acessível perto — confirmar com o local antes do evento.",
    });
  }

  return signs;
}

// ---------- Geração de dados em escala (teste de carga) ----------
// RNG com seed fixa pra reproduzir o mesmo teste sempre (mulberry32).
function seededRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATEGORIES = ["Risografia", "Serigrafia", "Encadernação", "Ilustração", "Cerâmica", "Fanzine"];

// Taxa de quem pede tomada na inscrição — usada tanto pra gerar os expositores de teste
// quanto pra calibrar quantos pontos de energia o venue precisa oferecer por corredor.
const OUTLET_RATE = 0.25;

// Gera n expositores sintéticos com proporções inspiradas na pesquisa exploratória:
// ~5% cadeirante, ~8% sensível a som, ~25% precisa de tomada, ~35% novato.
function generateExhibitors(n, seed = 42) {
  const rng = seededRng(seed);
  const list = [];
  for (let i = 1; i <= n; i++) {
    const r = rng();
    list.push({
      id: i,
      name: `Expositor ${i}`,
      category: CATEGORIES[Math.floor(rng() * CATEGORIES.length)],
      needsOutlet: rng() < OUTLET_RATE,
      accessibility: rng() < 0.05 ? "wheelchair" : "none",
      soundSensitive: rng() < 0.08,
      novice: rng() < 0.35,
      // a maioria com popularidade baixa/média, poucos "consolidados" puxando a média pra cima
      popularity: rng() < 0.12 ? 0.75 + rng() * 0.25 : 0.1 + rng() * 0.5,
    });
  }
  return list;
}

// Monta um novo perfil de local a partir das linhas do formulário "+ Cadastrar novo local"
// (cada row: { width, slots, outletRate, accessibleBathroomNearby, soundZoneNear }).
function buildProfileFromRows(name, rows, dailyVisitors = 1000) {
  const widthFactorByLabel = { largo: 3, médio: 2, estreito: 1 };
  const corridors = rows.map((row, i) => {
    const id = String.fromCharCode(65 + i);
    return {
      id,
      label: `Corredor ${id}`,
      width: row.width,
      widthFactor: widthFactorByLabel[row.width] || 2,
      slots: row.slots,
      powerPoints: computePowerPoints(row.slots, row.outletRate ?? OUTLET_RATE),
      accessibleBathroomNearby: !!row.accessibleBathroomNearby,
      soundZoneNear: !!row.soundZoneNear,
    };
  });
  const totalSlots = corridors.reduce((acc, c) => acc + c.slots, 0);
  return {
    id: `custom-${Date.now()}`,
    name: name || "Local sem nome",
    verified: true,
    note: "Cadastrado manualmente nesta sessão do navegador.",
    extensionBudget: Math.max(2, Math.ceil(totalSlots * 0.04)),
    dailyVisitors,
    corridors,
  };
}

window.MotimApp = {
  VENUE_PROFILES,
  allocate,
  computeFlowRisk,
  formatPending,
  generateExhibitors,
  makeArchetypeCorridors,
  computePowerPoints,
  buildProfileFromRows,
  generateSignagePlan,
};
