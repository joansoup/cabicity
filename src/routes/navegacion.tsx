import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Volume2, VolumeX, ChevronRight } from "lucide-react";
import { PhoneFrame } from "@/components/transit/PhoneFrame";
import { clearTrip, getTrip, type TripState } from "@/lib/transit/store";
import { fmtEur, fmtMin, fmtCo2 } from "@/lib/transit/format";
import { ModoIcon } from "@/components/transit/ModoIcon";
import { MetroLineBadge, extractMetroLinea, CercaniasLineBadge, extractCercaniasLinea } from "@/components/transit/MetroLineBadge";
import type { Paso, Tramo } from "@/lib/transit/engine";
import { buildRouteGeo, type LngLat } from "@/lib/transit/routeGeo";
import { MapaMapbox, type MapaRutaSegmento, type MapaMarcador } from "@/components/transit/MapaMapbox";
import { speakRosalia } from "@/lib/tts.functions";

export const Route = createFileRoute("/navegacion")({
  component: Nav,
});

interface PasoPlano {
  tramoIdx: number;
  pasoIdx: number;
  paso: Paso;
  tramo: Tramo;
}

function aplanar(tramos: Tramo[]): PasoPlano[] {
  const out: PasoPlano[] = [];
  tramos.forEach((t, ti) => t.pasos.forEach((p, pi) => out.push({ tramoIdx: ti, pasoIdx: pi, paso: p, tramo: t })));
  return out;
}

function Nav() {
  const navigate = useNavigate();
  const [trip, setT] = useState<TripState | null>(null);
  const [idx, setIdx] = useState(0);
  const [llegado, setLlegado] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const [voz, setVoz] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ct-voz") === "1";
  });

  useEffect(() => {
    const t = getTrip();
    if (!t?.seleccionada) navigate({ to: "/" });
    else setT(t);
  }, [navigate]);

  const pasos: PasoPlano[] = useMemo(
    () => (trip?.seleccionada ? aplanar(trip.seleccionada.tramos) : []),
    [trip]
  );

  const actual = pasos[idx];

  // Asistente de voz con ElevenLabs (voz personalizada de Rosalía). Reproducimos
  // audio MP3 servido por una server function para no exponer la API key.
  const ttsFn = useServerFn(speakRosalia);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reqIdRef = useRef(0);

  const decir = async (texto: string) => {
    if (!voz || typeof window === "undefined") return;
    const myId = ++reqIdRef.current;
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const res = await ttsFn({ data: { text: texto } });
      if (myId !== reqIdRef.current) return; // llegó tarde, ignora
      const audio = new Audio(`data:${res.mime};base64,${res.audioBase64}`);
      audioRef.current = audio;
      audio.play().catch(() => { /* autoplay bloqueado */ });
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!actual || llegado) return;
    // Narra el paso actual al cambiar. El avance es MANUAL ("Siguiente paso"),
    // para seguir el viaje en vivo, sin completarlo en segundos.
    decir(actual.paso.instruccion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, llegado, voz]);

  const next = () => {
    if (llegado) return; // evita que el temporizador y el botón disparen la llegada dos veces
    if (idx >= pasos.length - 1) {
      setLlegado(true);
      decir("Has llegado a tu destino");
    } else {
      setIdx((i) => i + 1);
    }
  };

  // Escaneo de QR de la BiciMAD: cámara falsa que "lee" el código y desbloquea.
  const escanearQr = () => {
    if (escaneando) return;
    setEscaneando(true);
    decir("Escaneando el código QR");
    setTimeout(() => {
      setEscaneando(false);
      decir("Bici desbloqueada. ¡A pedalear!");
      next();
    }, 1900);
  };

  const op = trip?.seleccionada;
  const geo = useMemo(() => (op ? buildRouteGeo(op, trip?.destino || op.id) : null), [op, trip?.destino]);

  const rutaSegmentos: MapaRutaSegmento[] = useMemo(
    () =>
      geo
        ? geo.segments.map((s) => ({
            coords: s.coords,
            color: s.color,
            dashed: s.tipo === "andando",
          }))
        : [],
    [geo]
  );

  const marcadores: MapaMarcador[] = useMemo(() => {
    if (!geo) return [];
    return geo.stops.map((pos, i) => ({
      pos,
      tamano: i === 0 || i === geo.stops.length - 1 ? 16 : 12,
    }));
  }, [geo]);

  // Posiciones actual y siguiente, y rotación del coche. Calculados ANTES de
  // cualquier early-return para no violar las Rules of Hooks (de lo contrario,
  // el número de hooks cambia entre renders cuando el viaje aún no está cargado
  // o cuando se llega al destino, provocando un error de React).
  const currentPos: LngLat = geo?.stepPositions[idx] ?? geo?.destino ?? [0, 0];
  const siguientePos: LngLat = geo?.stepPositions[idx + 1] ?? geo?.destino ?? [0, 0];
  const rotCoche = useMemo(() => {
    const dLng = siguientePos[0] - currentPos[0];
    const dLat = siguientePos[1] - currentPos[1];
    if (dLng === 0 && dLat === 0) return 0;
    return (Math.atan2(dLng, dLat) * 180) / Math.PI - 90;
  }, [currentPos, siguientePos]);

  if (!trip?.seleccionada || !actual || !op || !geo) return <PhoneFrame><div /></PhoneFrame>;

  const enCabify = actual.tramo.tipo === "cabify";

  // CO2 ahorrado vs cabify total
  const cabifyTotalCo2 = 0.15 * (op.tramos.reduce((s, t) => s + t.distanciaKm, 0));
  const ahorroCo2 = Math.max(0, cabifyTotalCo2 - op.co2Kg);

  // ETA restante (suma duraciones de pasos pendientes)
  const restante = pasos.slice(idx).reduce((s, p) => s + p.paso.duracionMin, 0);
  const progreso = Math.round((idx / Math.max(1, pasos.length - 1)) * 100);

  if (llegado) {
    return (
      <PhoneFrame>
        <div className="absolute inset-0 flex flex-col bg-bg p-5 gap-4 overflow-y-auto">
          <div className="flex items-center justify-center pt-6">
            <img src="/illustrations/arrival-thumbsup.svg" alt="" className="w-44 h-auto" />
          </div>
          <h1 className="text-[24px] font-bold text-center">Has llegado a tu destino</h1>
          <p className="text-center text-text-secondary text-[15px]">{trip.destino}</p>

          {op.puntos > 0 && (
            <div className="bg-cashback-bg text-cashback-text rounded-[24px] p-5 flex flex-col items-center gap-1 mt-2">
              <div className="text-[13px] font-bold uppercase tracking-wide flex items-center gap-1.5">
                <img src="/illustrations/club-hexagon.svg" alt="" className="w-4 h-4" /> Cabify Club
              </div>
              <div className="text-[40px] font-bold leading-none">+{op.puntos}</div>
              <div className="text-[13px]">puntos para canjear en la app</div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 mt-2">
            <Stat label="Tiempo" value={fmtMin(op.etaMin)} />
            <Stat label="Pagado" value={fmtEur(op.precioEur)} />
            <Stat label="CO₂ ahorrado" value={fmtCo2(ahorroCo2)} highlight />
          </div>

          <button
            onClick={() => { clearTrip(); navigate({ to: "/" }); }}
            className="mt-auto w-full h-12 rounded-[8px] bg-brand text-white font-bold text-[16px]"
          >
            Volver al inicio
          </button>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <div className="absolute inset-0 flex flex-col bg-bg">
        {/* mapa */}
        <div className="relative h-[40%] bg-bg-subdued overflow-hidden">
          <MapaMapbox
            centro={geo.origen}
            zoom={13}
            ruta={rutaSegmentos}
            marcadores={marcadores}
            marcadorActivo={enCabify ? undefined : currentPos}
            vehiculo={
              enCabify
                ? { pos: currentPos, svgUrl: "/icons/ic_vehicle_cenital.svg", rotacionDeg: rotCoche, tamano: 48 }
                : undefined
            }
            fitRuta
          />

          <button
            onClick={() => navigate({ to: "/viaje" })}
            className="absolute top-3 left-3 w-10 h-10 rounded-full bg-surface grid place-items-center z-10"
            style={{ boxShadow: "var(--shadow-rised)" }}
          >
            <ArrowLeft size={20} />
          </button>
          <button
            onClick={() => {
              const nv = !voz;
              setVoz(nv);
              localStorage.setItem("ct-voz", nv ? "1" : "0");
              if (!nv) {
                reqIdRef.current++;
                audioRef.current?.pause();
                audioRef.current = null;
              }
            }}
            className="absolute top-3 right-3 w-10 h-10 rounded-full bg-surface grid place-items-center z-10"
            style={{ boxShadow: "var(--shadow-rised)" }}
            aria-label={voz ? "Silenciar guía por voz" : "Activar guía por voz"}
          >
            {voz
              ? <Volume2 size={20} style={{ color: "var(--brand)" }} />
              : <VolumeX size={20} style={{ color: "var(--danger, #e2342d)" }} />}
          </button>
        </div>

        {/* instrucción actual + lista */}
        <div className="flex-1 flex flex-col bg-surface rounded-t-[24px] -mt-6 relative z-10 overflow-hidden" style={{ boxShadow: "var(--shadow-rised)" }}>
          <div className="p-4 flex gap-3 items-start border-b border-border">
            {actual.tramo.tipo === "metro" && extractMetroLinea(actual.tramo.titulo) ? (
              <MetroLineBadge linea={extractMetroLinea(actual.tramo.titulo)!} size={48} />
            ) : actual.tramo.tipo === "cercanias" && extractCercaniasLinea(actual.tramo.titulo) ? (
              <CercaniasLineBadge linea={extractCercaniasLinea(actual.tramo.titulo)!} size={48} />
            ) : (
              <div className="w-12 h-12 rounded-full grid place-items-center flex-shrink-0 bg-field">
                <ModoIcon tipo={actual.tramo.tipo} size={26} />
              </div>
            )}
            <div className="flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">Paso {idx + 1} de {pasos.length}</div>
              <div className="text-[19px] font-bold leading-tight">{actual.paso.instruccion}</div>
            </div>
          </div>

          <div className="px-4 py-3 flex items-center gap-3 border-b border-border">
            <div className="flex-1 h-1.5 rounded-full bg-field overflow-hidden">
              <div className="h-full bg-brand transition-all" style={{ width: `${progreso}%` }} />
            </div>
            <div className="text-[13px] font-bold">{fmtMin(restante)} restantes</div>
          </div>

          <ul className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {pasos.slice(idx + 1, idx + 5).map((p, i) => {
              const metroLinea = p.tramo.tipo === "metro" ? extractMetroLinea(p.tramo.titulo) : null;
              const cercaniasLinea = p.tramo.tipo === "cercanias" ? extractCercaniasLinea(p.tramo.titulo) : null;
              return (
                <li key={i} className="flex items-center gap-3 p-2 rounded-[8px]">
                  {metroLinea ? (
                    <MetroLineBadge linea={metroLinea} size={32} />
                  ) : cercaniasLinea ? (
                    <CercaniasLineBadge linea={cercaniasLinea} size={32} />
                  ) : (
                    <div className="w-8 h-8 rounded-full grid place-items-center bg-field">
                      <ModoIcon tipo={p.tramo.tipo} size={16} />
                    </div>
                  )}
                  <div className="flex-1 text-[14px] text-text-secondary truncate">{p.paso.instruccion}</div>
                  <span className="text-[15px] font-bold text-text">{fmtMin(p.paso.duracionMin)}</span>
                </li>
              );
            })}
          </ul>


          <div className="p-4 border-t border-border space-y-3">
            {op.puntos > 0 && (
              <div className="rounded-[16px] bg-cashback-bg text-cashback-text px-3.5 py-2.5 flex items-center gap-2.5">
                <img src="/illustrations/club-hexagon.svg" alt="" className="w-5 h-5 flex-shrink-0" />
                <div className="text-[13px] leading-tight">
                  Ganarás <span className="font-bold">+{op.puntos} puntos</span> Cabify Club al completar este viaje
                </div>
              </div>
            )}
            {actual.paso.qr ? (
              <QrScanner escaneando={escaneando} onScan={escanearQr} />
            ) : (
              <button
                onClick={next}
                className="w-full h-12 rounded-[8px] bg-brand text-white font-bold text-[16px] flex items-center justify-center gap-2"
              >
                Siguiente paso <ChevronRight size={18} />
              </button>
            )}
          </div>

        </div>
      </div>
    </PhoneFrame>
  );
}

// Cámara falsa de escaneo de QR para desbloquear la BiciMAD. Muestra un visor
// con un QR simulado y una línea de escaneo animada; al pulsar "Escanear",
// reproduce la lectura y continúa el viaje.
function QrScanner({ escaneando, onScan }: { escaneando: boolean; onScan: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <style>{`@keyframes ct-scan{0%{top:6%}50%{top:90%}100%{top:6%}}`}</style>
      <div
        className="relative mx-auto w-full max-w-[260px] aspect-square rounded-[20px] overflow-hidden"
        style={{ background: "linear-gradient(135deg,#1c1c2e,#2c2150)" }}
      >
        {/* QR simulado */}
        <div className="absolute inset-0 grid place-items-center">
          <div className="w-[55%] aspect-square rounded-[10px] bg-white p-2.5" style={{ opacity: escaneando ? 1 : 0.92 }}>
            <svg viewBox="0 0 100 100" className="w-full h-full" shapeRendering="crispEdges" aria-label="Código QR BiciMAD">
              <rect width="100" height="100" fill="#fff" />
              <path fill="#111" d="M10 10h25v25H10zM15 15v15h15V15zM65 10h25v25H65zM70 15v15h15V15zM10 65h25v25H10zM15 70v15h15V70z" />
              <path fill="#111" d="M45 10h6v6h-6zM55 16h6v6h-6zM45 22h6v6h-6zM62 40h6v6h-6zM40 45h6v6h-6zM50 50h6v6h-6zM70 55h6v6h-6zM45 62h6v6h-6zM58 66h6v6h-6zM66 72h6v6h-6zM50 78h6v6h-6zM78 45h6v6h-6zM84 60h6v6h-6zM40 84h6v6h-6z" />
            </svg>
          </div>
        </div>
        {/* marco visor */}
        <div className="absolute inset-5 rounded-[14px] border-2 border-white/70" />
        {/* línea de escaneo */}
        <div
          className="absolute left-5 right-5 h-0.5 rounded-full"
          style={{ background: "var(--brand)", boxShadow: "0 0 12px 2px var(--brand)", animation: escaneando ? "ct-scan 1s linear infinite" : "none", top: "6%", opacity: escaneando ? 1 : 0.4 }}
        />
        {escaneando && (
          <div className="absolute bottom-3 left-0 right-0 text-center text-white text-[13px] font-bold">Leyendo QR…</div>
        )}
      </div>
      <button
        onClick={onScan}
        disabled={escaneando}
        className="w-full h-12 rounded-[8px] bg-brand text-white font-bold text-[16px] flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {escaneando ? "Desbloqueando…" : "Escanear QR"}
      </button>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-[12px] p-3 ${highlight ? "bg-eco-bg" : "bg-field"}`}>
      <div className="text-[11px] text-text-secondary">{label}</div>
      <div className={`text-[14px] font-bold ${highlight ? "text-eco-text" : "text-text"}`}>{value}</div>
    </div>
  );
}

