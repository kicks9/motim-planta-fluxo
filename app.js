// Motim — Gerador de planta + risco de fluxo
// Protótipo: aloca expositores nos corredores respeitando restrições de acessibilidade,
// som, tomada e cota de novato, e sinaliza risco de aglomeração por corredor.

// ---------- Biblioteca de perfis de local ----------
// A Motim muda de local a cada edição, então não existe "o" mapa certo — cada perfil
// descreve um espaço real (ou provisório) que a organização pode escolher antes de gerar
// a alocação. "verified: true" = baseado em dado concreto; "false" = esqueleto provisório,
// a ser ajustado por quem conhece o local de verdade antes de usar pra valer.
//
// Um local é dividido em zonas (setores físicos — ex: "Pátio Externo", "Galpão 2"), e cada
// zona pode ter vários corredores de passagem dentro dela. A zona carrega os dados que só
// fazem sentido no nível do setor como um todo: área aproximada (m²), quantos banheiros tem
// ali, se é uma área coberta ou exposta ao tempo, quantos pontos de tomada fixos o setor
// realmente tem, e quantas extensões (e de que tamanho) a organização planeja levar pra lá —
// nenhum desses é propriedade de "um corredor", são do espaço físico que os corredores
// dividem entre si.

// Espalha N pontos de energia ao longo de `slots` posições (só define a capacidade, não a
// posição física exata — a planta real decide isso).
function computePowerPoints(slots, rate = 0.25) {
  const count = Math.max(1, Math.ceil(slots * rate));
  return Array.from({ length: count }, (_, k) => Math.floor(((k + 1) * slots) / (count + 1)));
}

// Gera um esqueleto de corredores repetindo o padrão largo/médio/estreito — usado como ponto
// de partida provisório (perfis não verificados) ou pelo formulário de novo local; nunca deve
// ser tratado como mapa real sem revisão.
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
    zones: [
      {
        id: "Z1",
        label: "Setor único",
        areaM2: 120,
        bathrooms: 2,
        covered: true,
        outletPoints: 6,
        extensionCount: 2,
        extensionLengthMeters: 10,
        corridors: [
          { id: "A", label: "Corredor A", width: "largo", widthFactor: 3, slots: 10, powerPoints: [2, 7], accessibleBathroomNearby: true, soundZoneNear: false },
          { id: "B", label: "Corredor B", width: "médio", widthFactor: 2, slots: 10, powerPoints: [4], accessibleBathroomNearby: false, soundZoneNear: false },
          { id: "C", label: "Corredor C", width: "estreito", widthFactor: 1, slots: 10, powerPoints: [1, 5], accessibleBathroomNearby: false, soundZoneNear: true },
        ],
      },
    ],
  },
  {
    id: "conic-n22",
    name: "Conic — SDS Conic (edição N22)",
    verified: true,
    note: "Baseado na lista pública de expositores da N22 (motim.art/expositores-n22): 3 setores (A/B/C), entrada Sul e Norte — Setor A é o grande, B e C são médios. A contagem de mesas é aproximada — a numeração real tem lacunas e subdivisões (ex: A103.1/A103.2) — e a posição do banheiro acessível/zona de som não está confirmada, ajuste se souber o real. Visitantes/dia: estimativa (N22 é o formato reduzido 'Montim', menor que as grandes edições de +10 mil/dia) — ajuste se souber o real. Área de cada setor, nº de banheiros, cobertura e tomadas ainda não foram confirmados com o local — por isso ficam em branco até alguém da organização preencher.",
    extensionBudget: 10,
    dailyVisitors: 3000,
    zones: [
      {
        id: "ZA",
        label: "Setor A — grande",
        areaM2: null,
        bathrooms: null,
        covered: null,
        outletPoints: null,
        extensionCount: null,
        extensionLengthMeters: null,
        corridors: [{ id: "A", label: "Corredor A", width: "largo", widthFactor: 3, slots: 113, powerPoints: computePowerPoints(113), accessibleBathroomNearby: true, soundZoneNear: false }],
      },
      {
        id: "ZB",
        label: "Setor B — médio",
        areaM2: null,
        bathrooms: null,
        covered: null,
        outletPoints: null,
        extensionCount: null,
        extensionLengthMeters: null,
        corridors: [{ id: "B", label: "Corredor B", width: "médio", widthFactor: 2, slots: 52, powerPoints: computePowerPoints(52), accessibleBathroomNearby: false, soundZoneNear: false }],
      },
      {
        id: "ZC",
        label: "Setor C — médio",
        areaM2: null,
        bathrooms: null,
        covered: null,
        outletPoints: null,
        extensionCount: null,
        extensionLengthMeters: null,
        corridors: [{ id: "C", label: "Corredor C", width: "médio", widthFactor: 2, slots: 52, powerPoints: computePowerPoints(52), accessibleBathroomNearby: false, soundZoneNear: true }],
      },
    ],
  },
  {
    id: "galeria-dos-estados",
    name: "Galeria dos Estados (perfil provisório)",
    verified: false,
    note: "Local mais recorrente da Motim nas edições grandes (+325 expositores), mas ainda sem mapeamento detalhado de corredores — esqueleto gerado automaticamente. Substitua pelos corredores reais antes de usar pra decisão de verdade. Visitantes/dia: 10 mil, direto da pesquisa exploratória (edições grandes).",
    extensionBudget: 10,
    dailyVisitors: 10000,
    zones: [{ id: "Z1", label: "Área única — provisória", areaM2: null, bathrooms: null, covered: null, outletPoints: null, extensionCount: null, extensionLengthMeters: null, corridors: makeArchetypeCorridors(5, 24) }],
  },
  {
    id: "museu-nacional",
    name: "Museu Nacional da República (perfil provisório)",
    verified: false,
    note: "Edição recorde de público (+14 mil em 2 dias ≈ 7 mil/dia), sem mapeamento detalhado ainda — esqueleto provisório.",
    extensionBudget: 8,
    dailyVisitors: 7000,
    zones: [{ id: "Z1", label: "Área única — provisória", areaM2: null, bathrooms: null, covered: null, outletPoints: null, extensionCount: null, extensionLengthMeters: null, corridors: makeArchetypeCorridors(4, 24) }],
  },
  {
    id: "ccbb",
    name: "CCBB Brasília (perfil provisório)",
    verified: false,
    note: "Sem mapeamento detalhado ainda — esqueleto provisório. Visitantes/dia: estimativa, sem dado específico da pesquisa.",
    extensionBudget: 6,
    dailyVisitors: 4000,
    zones: [{ id: "Z1", label: "Área única — provisória", areaM2: null, bathrooms: null, covered: null, outletPoints: null, extensionCount: null, extensionLengthMeters: null, corridors: makeArchetypeCorridors(3, 20) }],
  },
];

// Achata as zonas de um local numa lista única de corredores, carregando em cada corredor
// os dados do setor a que ele pertence (id/nome, banheiros, cobertura, área, tomadas,
// extensões). Quando a zona informa a área real (m²), ela é repartida entre os corredores da
// zona proporcionalmente ao nº de mesas de cada um — essa fração é usada depois no cálculo de
// risco de fluxo em vez da estimativa por largura de corredor, porque é dado real do local,
// não um chute. O mesmo vale pros pontos de tomada reais: quando o setor informa quantos tem
// de verdade, isso substitui o número calculado pela taxa fixa (25%) na hora de decidir se um
// corredor ainda tem tomada livre.
function flattenZones(zones) {
  return zones.flatMap((zone) => {
    const zoneSlots = zone.corridors.reduce((acc, c) => acc + c.slots, 0) || 1;
    return zone.corridors.map((c) => ({
      ...c,
      zoneId: zone.id,
      zoneLabel: zone.label,
      zoneCovered: zone.covered ?? null,
      zoneBathrooms: zone.bathrooms ?? null,
      zoneTotalAreaM2: zone.areaM2 ?? null,
      zoneOutletPoints: zone.outletPoints ?? null,
      zoneExtensionCount: zone.extensionCount ?? null,
      zoneExtensionLengthMeters: zone.extensionLengthMeters ?? null,
      areaShareM2: zone.areaM2 != null ? (zone.areaM2 * c.slots) / zoneSlots : null,
      realOutletCount: zone.outletPoints != null ? Math.round((zone.outletPoints * c.slots) / zoneSlots) : null,
    }));
  });
}

// ---------- Algoritmo de alocação ----------
// Regras, em ordem de prioridade (restrição dura primeiro):
// 1) cadeirante -> corredor largo + banheiro acessível por perto
// 2) sensível a som -> nunca no corredor perto da zona de som
// 3) precisa de tomada -> prioriza slot marcado como ponto de energia
// 4) cota de novato -> pelo menos ~30% de novatos em cada corredor
// 5) proximidade pedida -> tenta deixar lado a lado no mesmo corredor
// 6) resto -> preenche balanceando contagem de mesas por corredor
//
// O algoritmo continua operando sobre corredores individuais (a restrição física é sempre
// de corredor, não de zona inteira) — a zona só viaja junto como metadado de cada corredor.

function allocate(exhibitors, venue) {
  const corridors = flattenZones(venue.zones).map((c) => ({ ...c, assigned: [] }));
  const pending = []; // restrições não atendidas, viram "pendências físicas"
  const byId = Object.fromEntries(exhibitors.map((e) => [e.id, e]));
  const placed = new Set();
  let extensionsLeft = venue.extensionBudget || 0;
  let extensionsUsed = 0;

  function hasSpace(corridor) {
    return corridor.assigned.length < corridor.slots;
  }
  function place(exhibitor, corridor) {
    corridor.assigned.push(exhibitor);
    placed.add(exhibitor.id);
  }
  function freeOutletSlotCount(corridor) {
    const totalOutlets = corridor.realOutletCount ?? corridor.powerPoints.length;
    const used = corridor.assigned.filter((e) => e.needsOutlet).length;
    return Math.max(totalOutlets - used, 0);
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
const WIDTH_METERS_BY_CLASS = { largo: 4, médio: 2.5, estreito: 1.5 };
const TABLE_FRONTAGE_METERS = 1.5; // frente média de uma mesa de expositor + vão de circulação
const PEAK_CONCURRENCY_RATE = 0.15; // fração do público do dia presente simultaneamente no pico (estimativa, ajustável)
const DENSITY_LIMIT_MEDIO = 1.0; // pessoas/m² — início do LOS D (Fruin)
const DENSITY_LIMIT_ALTO = 2.0; // pessoas/m² — início do LOS E (Fruin), ponto de aglomeração

// Área do corredor: usa a área real do setor (repartida por nº de mesas) quando o setor
// informou a área em m² — senão cai pra estimativa por classe de largura, igual antes.
function corridorAreaM2(corridor) {
  if (corridor.areaShareM2 != null) return corridor.areaShareM2;
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
// Agrupa por zona primeiro: banheiros e cobertura são informação do setor como um todo,
// não de um corredor específico dentro dele.
function generateSignagePlan(corridors, flowRisk) {
  const signs = [];

  const zoneOrder = [];
  const zonesById = new Map();
  corridors.forEach((c) => {
    if (!zonesById.has(c.zoneId)) {
      zonesById.set(c.zoneId, {
        label: c.zoneLabel,
        bathrooms: c.zoneBathrooms,
        covered: c.zoneCovered,
        outletPoints: c.zoneOutletPoints,
        extensionCount: c.zoneExtensionCount,
        extensionLengthMeters: c.zoneExtensionLengthMeters,
        corridors: [],
      });
      zoneOrder.push(c.zoneId);
    }
    zonesById.get(c.zoneId).corridors.push(c);
  });

  const accessibleCorridor = corridors.find((c) => c.accessibleBathroomNearby);

  zoneOrder.forEach((zoneId) => {
    const zone = zonesById.get(zoneId);

    if (zone.bathrooms === 0) {
      signs.push({
        category: "infraestrutura",
        location: `Zona ${zone.label}`,
        text: "Nenhum banheiro nesta zona — sinalizar rota até o banheiro mais próximo ou providenciar um químico.",
      });
    } else if (zone.bathrooms != null) {
      signs.push({
        category: "infraestrutura",
        location: `Zona ${zone.label}`,
        text: `${zone.bathrooms} banheiro${zone.bathrooms > 1 ? "s" : ""} nesta zona.`,
      });
    }

    if (zone.covered === false) {
      signs.push({
        category: "clima",
        location: `Zona ${zone.label}`,
        text: "Área descoberta — expositores desta zona devem prever proteção contra sol/chuva; avisar na inscrição.",
      });
    }

    if (zone.outletPoints === 0) {
      signs.push({
        category: "energia",
        location: `Zona ${zone.label}`,
        text: "Nenhum ponto de tomada fixo nesta zona — expositores que precisam de energia dependem só de extensão.",
      });
    } else if (zone.outletPoints != null) {
      signs.push({
        category: "energia",
        location: `Zona ${zone.label}`,
        text: zone.outletPoints === 1 ? "1 ponto de tomada fixo nesta zona." : `${zone.outletPoints} pontos de tomada fixos nesta zona.`,
      });
    }

    if (zone.extensionCount != null) {
      const lengthText = zone.extensionLengthMeters != null ? ` de ~${zone.extensionLengthMeters}m${zone.extensionCount === 1 ? "" : " cada"}` : "";
      signs.push({
        category: "energia",
        location: `Zona ${zone.label}`,
        text: `Levar ${zone.extensionCount} ${zone.extensionCount === 1 ? "extensão" : "extensões"}${lengthText} pra cobrir a demanda de tomada aqui.`,
      });
    }

    zone.corridors.forEach((c) => {
      // identificação do corredor — sempre necessária, é o que resolve "achar a banca"
      signs.push({
        category: "corredor",
        location: `Entrada do Corredor ${c.id} (${zone.label})`,
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
  });

  // mapa geral — um só, pro ponto de entrada principal, resume a ordem dos corredores por zona
  signs.unshift({
    category: "mapa-geral",
    location: "Entrada principal",
    text: `Mapa geral: ${corridors.map((c) => `Corredor ${c.id} (${c.zoneLabel})`).join(" → ")}`,
  });

  if (!accessibleCorridor) {
    signs.push({
      category: "acessibilidade",
      location: "—",
      text: "Nenhuma zona está marcada com banheiro acessível perto — confirmar com o local antes do evento.",
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

// Monta um novo perfil de local a partir dos setores do formulário "+ Cadastrar novo local".
// `zonesInput`: [{ label, areaM2, bathrooms, covered, rows: [{width,slots,outletRate,
// accessibleBathroomNearby,soundZoneNear}, ...] }, ...] — um setor pode ter vários corredores.
// Os ids de corredor (A, B, C...) são globais pro local inteiro, não reiniciam por setor.
function buildProfileFromRows(name, zonesInput, dailyVisitors = 1000) {
  const widthFactorByLabel = { largo: 3, médio: 2, estreito: 1 };
  let letterIndex = 0;
  const zones = zonesInput.map((zoneInput, zi) => {
    const corridors = zoneInput.rows.map((row) => {
      const id = String.fromCharCode(65 + letterIndex++);
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
    return {
      id: `Z${zi + 1}`,
      label: zoneInput.label || `Setor ${zi + 1}`,
      areaM2: zoneInput.areaM2 ?? null,
      bathrooms: zoneInput.bathrooms ?? null,
      covered: zoneInput.covered ?? null,
      outletPoints: zoneInput.outletPoints ?? null,
      extensionCount: zoneInput.extensionCount ?? null,
      extensionLengthMeters: zoneInput.extensionLengthMeters ?? null,
      corridors,
    };
  });
  const totalSlots = zones.reduce((acc, z) => acc + z.corridors.reduce((a, c) => a + c.slots, 0), 0);
  return {
    id: `custom-${Date.now()}`,
    name: name || "Local sem nome",
    verified: true,
    note: "Cadastrado manualmente nesta sessão do navegador.",
    extensionBudget: Math.max(2, Math.ceil(totalSlots * 0.04)),
    dailyVisitors,
    zones,
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
