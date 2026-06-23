import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Volume2, VolumeX, ChevronRight, Sparkles, Radar } from "lucide-react";
import { PhoneFrame } from "@/components/transit/PhoneFrame";
import { clearTrip, getTrip, type TripState } from "@/lib/transit/store";
import { fmtEur, fmtMin, fmtCo2 } from "@/lib/transit/format";
import { ModoIcon } from "@/components/transit/ModoIcon";
import type { Paso, Tramo } from "@/lib/transit/engine";
import { buildRouteGeo } from "@/lib/transit/routeGeo";
import { MapaMapbox, type MapaRutaSegmento, type MapaMarcador } from "@/components/transit/MapaMapbox";

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
  const [voz, setVoz] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ct-voz") === "1";
  });
  const timerRef = useRef<number | null>(null);

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

  // Asistente de voz (Web Speech API del navegador, es-ES). Pensado para escuchar
  // las indicaciones con auriculares sin sacar el móvil del bolsillo.
  const decir = (texto: string) => {
    if (!voz || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = "es-ES";
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!actual || llegado) return;
    decir(actual.paso.instruccion);
    // avanza automáticamente proporcional a la duración (escalado para demo)
    const ms = Math.max(2500, Math.min(8000, actual.paso.duracionMin * 600));
    timerRef.current = window.setTimeout(() => next(), ms);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
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

  const op = trip?.seleccionada;
  const geo = useMemo(
    () => (op ? buildRouteGeo(op, trip?.destino || op.id) : null),
    [op, trip?.destino]
  );

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

  if (!trip?.seleccionada || !actual || !op || !geo) return <PhoneFrame><div /></PhoneFrame>;

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
            <div className="w-20 h-20 rounded-full bg-eco-bg grid place-items-center">
              <Sparkles size={40} className="text-eco-text" />
            </div>
          </div>
          <h1 className="text-[24px] font-bold text-center">Has llegado a tu destino</h1>
          <p className="text-center text-text-secondary text-[15px]">{trip.destino}</p>

          {op.puntos > 0 && (
            <div className="bg-cashback-bg text-cashback-text rounded-[24px] p-5 flex flex-col items-center gap-1 mt-2">
              <div className="text-[13px] font-bold uppercase tracking-wide flex items-center gap-1.5">
                <img src="/icons/ic_cabify_club_spark_color.svg" alt="" className="w-4 h-4" /> Cabify Club
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
            className="mt-auto w-full h-12 rounded-[16px] bg-brand text-white font-bold text-[16px]"
          >
            Volver al inicio
          </button>
        </div>
      </PhoneFrame>
    );
  }

  const currentPos = geo.stepPositions[idx] ?? geo.destino;

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
            marcadorActivo={currentPos}
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
              if (!nv && typeof window !== "undefined") window.speechSynthesis?.cancel();
            }}
            className="absolute top-3 right-3 w-10 h-10 rounded-full bg-surface grid place-items-center z-10"
            style={{ boxShadow: "var(--shadow-rised)" }}
          >
            {voz ? <Volume2 size={20} /> : <VolumeX size={20} className="text-text-secondary" />}
          </button>
        </div>

        {/* instrucción actual + lista */}
        <div className="flex-1 flex flex-col bg-surface rounded-t-[24px] -mt-6 relative z-10 overflow-hidden" style={{ boxShadow: "var(--shadow-rised)" }}>
          <div className="p-4 flex gap-3 items-start border-b border-border">
            <div className="w-12 h-12 rounded-full grid place-items-center flex-shrink-0" style={{ background: `${actual.tramo.color}1a` }}>
              <ModoIcon tipo={actual.tramo.tipo} size={26} />
            </div>
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

          {op.puntos > 0 && (
            <div className="mx-4 mt-3 mb-1 rounded-[16px] bg-cashback-bg text-cashback-text px-3.5 py-2.5 flex items-center gap-2.5">
              <img src="/icons/ic_cabify_club_spark_color.svg" alt="" className="w-5 h-5 flex-shrink-0" />
              <div className="text-[13px] leading-tight">
                Ganarás <span className="font-bold">+{op.puntos} puntos</span> Cabify Club al completar este viaje
              </div>
            </div>
          )}


          <ul className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {pasos.slice(idx + 1, idx + 5).map((p, i) => (
              <li key={i} className="flex items-center gap-3 p-2 rounded-[8px]">
                <div className="w-8 h-8 rounded-full grid place-items-center" style={{ background: `${p.tramo.color}1a` }}>
                  <ModoIcon tipo={p.tramo.tipo} size={16} />
                </div>
                <div className="flex-1 text-[14px] text-text-secondary truncate">{p.paso.instruccion}</div>
                <div className="flex items-center gap-1 text-text">
                  <img src="/icons/ic_location_live.svg" alt="" className="w-4 h-4 text-brand" aria-hidden />
                  <span className="text-[15px] font-bold">{fmtMin(p.paso.duracionMin)}</span>
                </div>
              </li>
            ))}
          </ul>

          <div className="p-4 border-t border-border">
            <button
              onClick={next}
              className="w-full h-12 rounded-[16px] bg-brand text-white font-bold text-[16px] flex items-center justify-center gap-2"
            >
              Siguiente paso <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </PhoneFrame>
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

