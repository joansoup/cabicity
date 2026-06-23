// Motor determinista del comparador (Cabify Transit)
// Resumen aplicado de transit-model.md

export type ModoTipo =
  | "cabify"
  | "metro"
  | "cercanias"
  | "ave"
  | "andando"
  | "bicimad"
  | "bus";

export interface Paso {
  instruccion: string;
  duracionMin: number;
}

export interface Tramo {
  tipo: ModoTipo;
  titulo: string;
  subtitulo?: string;
  duracionMin: number;
  distanciaKm: number;
  pasos: Paso[];
  color: string;
  icono: string; // /icons/... o "lucide:Bus"
}

export interface Opcion {
  id: string;
  tipo: "simple" | "combo";
  nombre: string;
  modos: ModoTipo[];
  tramos: Tramo[];
  etaMin: number;
  precioEur: number; // 0 = Gratis
  co2Kg: number;
  puntos: number; // puntos Cabify Club (más por rutas sostenibles)
  desglose?: string;
  esSostenible: boolean;
}

// --- hash determinista ----------------------------------------------------
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  const x = s.trim().toLowerCase();
  for (let i = 0; i < x.length; i++) {
    h ^= x.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function distanciaPara(destino: string): number {
  const d = destino.trim().toLowerCase();
  if (!d) return 0;
  if (/sevilla|barcelona|valencia|zaragoza|m[áa]laga|c[óo]rdoba/.test(d)) {
    const opts = [395, 505, 305, 295, 525, 345];
    return opts[hashStr(d) % opts.length];
  }
  if (/toledo|segovia|guadalajara|alcal[áa]/.test(d)) return 65 + (hashStr(d) % 30);
  if (/aeropuerto|barajas|t1|t2|t3|t4/.test(d)) return 14;
  // Lugares cercanos a Chamartín (el origen): trayectos cortos -> aparecen
  // "a pie" y BiciMAD entre las opciones.
  if (/bernab[eé]u|nuevos ministerios|plaza castilla|chamart[ií]n|cuzco|prosperidad|concha espina|am[eé]rica|gregorio mara|alonso mart|colombia|pradillo|alfonso xiii/.test(d)) {
    return Math.round((0.8 + (hashStr(d) % 21) / 10) * 10) / 10; // 0.8 – 2.8 km (andable)
  }
  // urbano 1.5 – 22 km
  const r = (hashStr(d) % 210) / 10 + 1.5;
  return Math.round(r * 10) / 10;
}

// --- Categorías Cabify ----------------------------------------------------
// Multiplicador sobre el precio base. La más barata (Eco) se usa al mostrar
// el precio de Cabify en /resultados y /viaje; en /categoria-cabify el usuario
// elige la concreta antes de iniciar la navegación.
export type CabifyCategoriaId = "eco" | "electric" | "estandar" | "group";
export interface CabifyCategoria {
  id: CabifyCategoriaId;
  nombre: string;
  descripcion: string;
  multiplicador: number;
  etaExtraMin: number;
  img: string;
}
export const CABIFY_CATEGORIAS: CabifyCategoria[] = [
  { id: "eco",      nombre: "Cabify Eco",      descripcion: "100% eléctrico, la opción más económica", multiplicador: 0.88, etaExtraMin: 1, img: "/illustrations/cat-eco.svg" },
  { id: "electric", nombre: "Cabify Electric", descripcion: "Vehículo 100% eléctrico",                 multiplicador: 1.08, etaExtraMin: 2, img: "/illustrations/cat-electric.svg" },
  { id: "estandar", nombre: "Cabify",          descripcion: "Coche estándar para hasta 4 personas",    multiplicador: 1.00, etaExtraMin: 0, img: "/illustrations/cabify.svg" },
  { id: "group",    nombre: "Cabify Group",    descripcion: "Hasta 6 plazas o equipaje extra",         multiplicador: 1.45, etaExtraMin: 2, img: "/illustrations/cat-group.svg" },
];
const CHEAPEST_CABIFY_MULTI = Math.min(...CABIFY_CATEGORIAS.map((c) => c.multiplicador));

export function categoriasCabifyConPrecio(precioBaseCabify: number) {
  return CABIFY_CATEGORIAS.map((c) => ({
    ...c,
    precioEur: Math.round(precioBaseCabify * (c.multiplicador / CHEAPEST_CABIFY_MULTI) * 100) / 100,
  }));
}

// --- parámetros ----------------------------------------------------------
const MODOS = {
  cabify:    { speed: 25,  price: (d: number) => (2.5 + 1.25 * d) * CHEAPEST_CABIFY_MULTI, co2: 0.15,  avail: () => true,        color: "#7145d6", icono: "/icons/ic_cabify.svg" },
  metro:     { speed: 30,  price: () => 2.0,                     co2: 0.04,  avail: (d: number) => d < 20, color: "#2760c2", icono: "lucide:TramFront" },
  cercanias: { speed: 45,  price: (d: number) => 2.6 + 0.05 * d, co2: 0.035, avail: (d: number) => d >= 5 && d < 60, color: "#017251", icono: "lucide:TrainFrontTunnel" },
  ave:       { speed: 200, price: (d: number) => 25 + 0.18 * d,  co2: 0.03,  avail: (d: number) => d >= 60, color: "#5b34ac", icono: "lucide:TrainFront" },
  andando:   { speed: 5,   price: () => 0,                       co2: 0,     avail: (d: number) => d < 3,  color: "#5e6088", icono: "/icons/ic_walking.svg" },
  bicimad:   { speed: 13,  price: () => 0.5,                     co2: 0,     avail: (d: number) => d < 8,  color: "#ea8c2e", icono: "/icons/ic_bicycle.svg" },
  bus:       { speed: 14,  price: () => 1.5,                     co2: 0.08,  avail: (d: number) => d < 30, color: "#bf2721", icono: "lucide:Bus" },
} as const;

// Modos sostenibles: a pie, bici pública y transporte público/ferroviario.
// Cabify (coche con conductor) NO es sostenible y nunca genera cashback.
const SOSTENIBLE: Record<ModoTipo, boolean> = {
  andando: true, bicimad: true, metro: true, cercanias: true, ave: true, bus: true, cabify: false,
};

// Puntos Cabify Club por km. Los modos sostenibles dan más; Cabify (coche con
// conductor) también suma puntos siempre, aunque en menor proporción, porque
// el viaje se hace dentro del ecosistema Cabify.
const PUNTOS_POR_KM: Record<ModoTipo, number> = {
  andando: 12, bicimad: 9, metro: 6, cercanias: 6, bus: 5, ave: 4, cabify: 3,
};

const NOMBRES: Record<ModoTipo, string> = {
  cabify: "Cabify",
  metro: "Metro",
  cercanias: "Cercanías",
  ave: "AVE",
  andando: "Andando",
  bicimad: "BiciMAD",
  bus: "Bus EMT",
};

const LINEAS_METRO = ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10"];
const ESTACIONES = ["Sol", "Nuevos Ministerios", "Chamartín", "Atocha", "Príncipe Pío", "Goya", "Plaza España", "Bilbao", "Tribunal", "Diego de León"];
const DIR_METRO = ["Pinar de Chamartín", "Cuatro Caminos", "Aluche", "Pitis", "Laguna", "Pueblo Nuevo", "Argüelles", "Villaverde Alto"];
const CERCANIAS_LINEAS = ["C-1", "C-3", "C-4", "C-5", "C-7"];

function pick<T>(arr: readonly T[], seed: number, i = 0): T {
  return arr[(seed + i * 31) % arr.length];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function capPuntos(p: number, interurbano: boolean): number {
  return Math.min(Math.round(p), interurbano ? 600 : 250);
}

// --- generación de tramos ---------------------------------------------------
function tramoCabify(distKm: number, titulo: string, instruccion: string): Tramo {
  const duracion = Math.max(2, Math.round((distKm / MODOS.cabify.speed) * 60));
  return {
    tipo: "cabify", titulo, duracionMin: duracion, distanciaKm: distKm,
    color: MODOS.cabify.color, icono: MODOS.cabify.icono,
    pasos: [
      { instruccion: "Tu Cabify llega en 3 min", duracionMin: 3 },
      { instruccion, duracionMin: duracion },
    ],
  };
}

function tramoAndando(distKm: number, hacia: string): Tramo {
  const duracion = Math.max(1, Math.round((distKm / MODOS.andando.speed) * 60));
  return {
    tipo: "andando", titulo: `Camina ${Math.round(distKm * 1000)} m hasta ${hacia}`,
    duracionMin: duracion, distanciaKm: distKm,
    color: MODOS.andando.color, icono: MODOS.andando.icono,
    pasos: [{ instruccion: `Camina ${Math.round(distKm * 1000)} m y dirígete a ${hacia}`, duracionMin: duracion }],
  };
}

function tramoMetro(distKm: number, seed: number): Tramo {
  const linea = pick(LINEAS_METRO, seed);
  const direccion = pick(DIR_METRO, seed, 1);
  const origen = pick(ESTACIONES, seed, 2);
  const destino = pick(ESTACIONES, seed, 3);
  const paradas = Math.max(2, Math.round(distKm * 1.2));
  const duracion = Math.max(4, Math.round((distKm / MODOS.metro.speed) * 60) + 2);
  return {
    tipo: "metro", titulo: `${linea} · ${origen} → ${destino}`, subtitulo: `dirección ${direccion} · ${paradas} paradas`,
    duracionMin: duracion, distanciaKm: distKm, color: MODOS.metro.color, icono: MODOS.metro.icono,
    pasos: [
      { instruccion: `Coge la ${linea} dirección ${direccion} en ${origen}`, duracionMin: 1 },
      { instruccion: `Continúa ${paradas} paradas`, duracionMin: duracion - 2 },
      { instruccion: `Baja en ${destino}`, duracionMin: 1 },
    ],
  };
}

function tramoCercanias(distKm: number, seed: number): Tramo {
  const linea = pick(CERCANIAS_LINEAS, seed);
  const origen = pick(["Atocha", "Chamartín", "Nuevos Ministerios", "Recoletos"], seed, 1);
  const destino = pick(["Aeropuerto T4", "Pinar de las Rozas", "Alcalá de Henares", "Aranjuez"], seed, 2);
  const duracion = Math.max(8, Math.round((distKm / MODOS.cercanias.speed) * 60) + 3);
  return {
    tipo: "cercanias", titulo: `${linea} · ${origen} → ${destino}`, subtitulo: "Cercanías Renfe",
    duracionMin: duracion, distanciaKm: distKm, color: MODOS.cercanias.color, icono: MODOS.cercanias.icono,
    pasos: [
      { instruccion: `Toma ${linea} en ${origen}`, duracionMin: 1 },
      { instruccion: `Trayecto en tren hasta ${destino}`, duracionMin: duracion - 2 },
      { instruccion: `Baja en ${destino}`, duracionMin: 1 },
    ],
  };
}

function tramoAVE(distKm: number, seed: number): Tramo {
  const destino = pick(["Sevilla Santa Justa", "Barcelona Sants", "Valencia Joaquín Sorolla", "Zaragoza Delicias", "Málaga María Zambrano", "Córdoba Central"], seed);
  const duracion = Math.max(90, Math.round((distKm / MODOS.ave.speed) * 60) + 15);
  return {
    tipo: "ave", titulo: `AVE Madrid Atocha → ${destino}`, subtitulo: "Renfe AVE",
    duracionMin: duracion, distanciaKm: distKm, color: MODOS.ave.color, icono: MODOS.ave.icono,
    pasos: [
      { instruccion: "Acude a Madrid Atocha 30 min antes", duracionMin: 30 },
      { instruccion: `Trayecto AVE hasta ${destino}`, duracionMin: duracion - 30 },
    ],
  };
}

function tramoBici(distKm: number): Tramo {
  const dur = Math.max(3, Math.round((distKm / MODOS.bicimad.speed) * 60));
  return {
    tipo: "bicimad", titulo: `BiciMAD ${distKm.toFixed(1)} km`, subtitulo: "Bici eléctrica pública",
    duracionMin: dur, distanciaKm: distKm, color: MODOS.bicimad.color, icono: MODOS.bicimad.icono,
    pasos: [
      { instruccion: "Recoge una BiciMAD en la estación más cercana", duracionMin: 1 },
      { instruccion: `Pedalea ${distKm.toFixed(1)} km hasta tu destino`, duracionMin: dur - 1 },
    ],
  };
}

function tramoBus(distKm: number, seed: number): Tramo {
  const linea = (10 + (seed % 140)).toString();
  const dur = Math.max(8, Math.round((distKm / MODOS.bus.speed) * 60));
  return {
    tipo: "bus", titulo: `Bus EMT línea ${linea}`, subtitulo: "Empresa Municipal de Transportes",
    duracionMin: dur, distanciaKm: distKm, color: MODOS.bus.color, icono: MODOS.bus.icono,
    pasos: [
      { instruccion: `Espera el bus ${linea}`, duracionMin: 4 },
      { instruccion: `Trayecto en bus hasta destino`, duracionMin: dur - 4 },
    ],
  };
}

// --- builders de opciones --------------------------------------------------
function opcionSimple(tipo: ModoTipo, distKm: number, seed: number): Opcion {
  const m = MODOS[tipo];
  const precio = round2(m.price(distKm));
  const co2 = round2(m.co2 * distKm);
  const interurbano = distKm > 60;
  const esSostenible = SOSTENIBLE[tipo];
  // Todos los modos generan puntos Cabify Club (incluido Cabify).
  const puntos = capPuntos(PUNTOS_POR_KM[tipo] * distKm, interurbano);
  let tramos: Tramo[];
  if (tipo === "cabify") {
    tramos = [tramoCabify(distKm, "Cabify directo a destino", "Trayecto en Cabify hasta tu destino")];
  } else if (tipo === "metro") {
    tramos = [tramoMetro(distKm, seed)];
  } else if (tipo === "cercanias") {
    tramos = [tramoCercanias(distKm, seed)];
  } else if (tipo === "ave") {
    tramos = [tramoAVE(distKm, seed)];
  } else if (tipo === "andando") {
    tramos = [tramoAndando(distKm, "tu destino")];
  } else if (tipo === "bicimad") {
    tramos = [tramoBici(distKm)];
  } else {
    tramos = [tramoBus(distKm, seed)];
  }
  const eta = tramos.reduce((s, t) => s + t.duracionMin, 0);
  return {
    id: `simple-${tipo}`, tipo: "simple", nombre: NOMBRES[tipo], modos: [tipo], tramos,
    etaMin: eta, precioEur: precio, co2Kg: co2, puntos,
    esSostenible,
  };
}

function opcionCombo(modos: ModoTipo[], distKm: number, seed: number, idSuffix: string): Opcion | null {
  const interurbano = distKm > 60;
  // Cabify a estación: tramo first/last mile ajustado para que el precio total
  // del combo cuadre con el dataset real (p. ej. Cabify+Metro ≈ 9,89 €).
  const cabifyKm = 4.5;
  let principalKm: number;
  const ultimo = modos[modos.length - 1];
  const cabifyFinal = ultimo === "cabify" && modos.length > 1;
  const transbordos = modos.length - 1;

  if (cabifyFinal) principalKm = Math.max(1, distKm - cabifyKm * 2);
  else principalKm = Math.max(1, distKm - cabifyKm);

  if (principalKm < 1) return null;

  const tramos: Tramo[] = [];
  let cabifyPrecio = 0, cabifyCo2 = 0;
  let publicoPrecio = 0, publicoCo2 = 0;
  let puntos = 0;

  modos.forEach((m, i) => {
    if (m === "cabify") {
      const t = tramoCabify(cabifyKm, i === 0 ? "Cabify hasta la estación" : "Cabify hasta tu destino",
        i === 0 ? "Cabify te lleva a la estación" : "Cabify te lleva del destino");
      tramos.push(t);
      cabifyPrecio += MODOS.cabify.price(cabifyKm);
      cabifyCo2 += MODOS.cabify.co2 * cabifyKm;
      puntos += PUNTOS_POR_KM.cabify * cabifyKm;
    } else {
      let t: Tramo;
      if (m === "metro") t = tramoMetro(principalKm, seed);
      else if (m === "cercanias") t = tramoCercanias(principalKm, seed);
      else if (m === "ave") t = tramoAVE(principalKm, seed);
      else if (m === "bus") t = tramoBus(principalKm, seed);
      else if (m === "andando") t = tramoAndando(principalKm, "tu destino");
      else t = tramoBici(principalKm);
      tramos.push(t);
      publicoPrecio += MODOS[m].price(principalKm);
      publicoCo2 += MODOS[m].co2 * principalKm;
      puntos += PUNTOS_POR_KM[m] * principalKm;
    }
  });

  const fee = modos.includes("ave") ? 4 : 0.5;
  const precio = round2(cabifyPrecio + publicoPrecio + fee);
  const co2 = round2(cabifyCo2 + publicoCo2);
  // Una ruta es sostenible si al menos un tramo lo es.
  const esSostenible = modos.some((m) => SOSTENIBLE[m]);
  puntos = capPuntos(puntos, interurbano);
  const eta = tramos.reduce((s, t) => s + t.duracionMin, 0) + transbordos * 8;

  // insertar tramos de transbordo a pie ligeros (representativos)
  // los dejamos en eta pero no creamos tramos extra para no romper navegación

  const desglose = [
    cabifyPrecio > 0 ? `Cabify ${cabifyPrecio.toFixed(2).replace(".", ",")} €` : null,
    publicoPrecio > 0 ? `${NOMBRES[modos.find((x) => x !== "cabify") as ModoTipo]} ${publicoPrecio.toFixed(2).replace(".", ",")} €` : null,
    `gestión ${fee.toFixed(2).replace(".", ",")} €`,
  ].filter(Boolean).join(" + ");

  const nombre = modos.map((m) => NOMBRES[m]).join(" + ");

  return {
    id: `combo-${idSuffix}`, tipo: "combo", nombre, modos, tramos,
    etaMin: eta, precioEur: precio, co2Kg: co2, puntos,
    desglose, esSostenible,
  };
}

// --- API pública -----------------------------------------------------------
export type Criterio = "equilibrado" | "rapido" | "barato" | "ecologico";

export function generarOpciones(destino: string): { distKm: number; opciones: Opcion[] } {
  const distKm = distanciaPara(destino);
  const seed = hashStr(destino || "x");
  const opciones: Opcion[] = [];

  (["cabify", "metro", "cercanias", "ave", "andando", "bicimad", "bus"] as ModoTipo[]).forEach((m) => {
    if (MODOS[m].avail(distKm)) opciones.push(opcionSimple(m, distKm, seed));
  });

  // combos
  const interurbano = distKm > 60;
  if (interurbano) {
    const c1 = opcionCombo(["cabify", "ave", "cabify"], distKm, seed, "cabify-ave-cabify");
    const c2 = opcionCombo(["cabify", "ave"], distKm, seed, "cabify-ave");
    const c3 = opcionCombo(["ave", "cabify"], distKm, seed, "ave-cabify");
    [c1, c2, c3].forEach((c) => c && opciones.push(c));
  } else if (distKm > 4) {
    if (MODOS.metro.avail(distKm - 3.5)) {
      const c = opcionCombo(["cabify", "metro"], distKm, seed, "cabify-metro");
      if (c) opciones.push(c);
      const c2 = opcionCombo(["cabify", "metro", "cabify"], distKm, seed, "cabify-metro-cabify");
      if (c2) opciones.push(c2);
    }
    if (distKm >= 7 && MODOS.cercanias.avail(distKm - 3.5)) {
      const c = opcionCombo(["cabify", "cercanias"], distKm, seed, "cabify-cercanias");
      if (c) opciones.push(c);
    }
  }

  // Cabify siempre debe ser la opción más rápida del listado. Si por la
  // distancia el metro u otro modo sale antes, ajustamos el etaMin del Cabify
  // simple (y la duración del tramo de viaje) para garantizarlo visualmente.
  const cabifySimple = opciones.find((o) => o.id === "simple-cabify");
  if (cabifySimple) {
    const minOtros = Math.min(
      ...opciones.filter((o) => o !== cabifySimple).map((o) => o.etaMin),
      Infinity
    );
    if (Number.isFinite(minOtros) && cabifySimple.etaMin >= minOtros) {
      const objetivo = Math.max(2, minOtros - 1);
      const delta = cabifySimple.etaMin - objetivo;
      cabifySimple.etaMin = objetivo;
      // Recortamos la duración del paso de trayecto (último) del único tramo.
      const tramo = cabifySimple.tramos[0];
      if (tramo) {
        tramo.duracionMin = Math.max(1, tramo.duracionMin - delta);
        const ultimoPaso = tramo.pasos[tramo.pasos.length - 1];
        if (ultimoPaso) ultimoPaso.duracionMin = Math.max(1, ultimoPaso.duracionMin - delta);
      }
    }
  }

  return { distKm, opciones };
}

export function ordenarOpciones(ops: Opcion[], criterio: Criterio): Opcion[] {
  const eta = ops.map((o) => o.etaMin);
  const pre = ops.map((o) => o.precioEur);
  const co2 = ops.map((o) => o.co2Kg);
  const norm = (v: number, arr: number[]) => {
    const mn = Math.min(...arr), mx = Math.max(...arr);
    return mx === mn ? 0 : (v - mn) / (mx - mn);
  };
  const sorted = [...ops];
  sorted.sort((a, b) => {
    if (criterio === "rapido") return a.etaMin - b.etaMin || a.precioEur - b.precioEur;
    if (criterio === "barato") {
      const d = a.precioEur - b.precioEur;
      return d !== 0 ? d : a.etaMin - b.etaMin;
    }
    if (criterio === "ecologico") return a.co2Kg - b.co2Kg || a.etaMin - b.etaMin;
    const sa = 0.5 * norm(a.etaMin, eta) + 0.3 * norm(a.precioEur, pre) + 0.2 * norm(a.co2Kg, co2);
    const sb = 0.5 * norm(b.etaMin, eta) + 0.3 * norm(b.precioEur, pre) + 0.2 * norm(b.co2Kg, co2);
    return sa - sb || a.etaMin - b.etaMin;
  });
  return sorted;
}

// --- Helpers de categorías Cabify por opción --------------------------------
// Devuelve la suma de "precio Cabify" de la opción aplicando un multiplicador
// determinado. Si no hay tramos Cabify, devuelve 0.
export function precioCabifyParaOpcion(op: Opcion, multiplicador: number): number {
  return op.tramos
    .filter((t) => t.tipo === "cabify")
    .reduce((s, t) => s + (2.5 + 1.25 * t.distanciaKm) * multiplicador, 0);
}

// ¿La opción incluye algún tramo Cabify?
export function opcionTieneCabify(op: Opcion): boolean {
  return op.modos.includes("cabify");
}

// Devuelve la lista de categorías con su precio total para la opción dada.
// El total se obtiene reemplazando el coste Cabify (calculado al multiplicador
// más barato) por el coste con el multiplicador de cada categoría.
export function categoriasParaOpcion(op: Opcion) {
  const precioBaseCabify = precioCabifyParaOpcion(op, CHEAPEST_CABIFY_MULTI);
  return CABIFY_CATEGORIAS.map((c) => {
    const precioCabifyCategoria = precioCabifyParaOpcion(op, c.multiplicador);
    const totalEur = Math.round((op.precioEur - precioBaseCabify + precioCabifyCategoria) * 100) / 100;
    const precioCabifyEur = Math.round(precioCabifyCategoria * 100) / 100;
    return { ...c, precioCabifyEur, totalEur };
  });
}
