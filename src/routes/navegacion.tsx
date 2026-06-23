import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Volume2, VolumeX, ChevronRight, Sparkles } from "lucide-react";
import { PhoneFrame } from "@/components/transit/PhoneFrame";
import { clearTrip, getTrip, type TripState } from "@/lib/transit/store";
import { fmtEur, fmtMin, fmtCo2, fmtEurCashback } from "@/lib/transit/format";
import { ModoIcon, modoColor } from "@/components/transit/ModoIcon";
import type { Paso, Tramo } from "@/lib/transit/engine";
import { buildRouteGeo, getMapboxToken } from "@/lib/transit/routeGeo";
import { MapboxRoute } from "@/components/transit/MapboxRoute";

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

  // voice
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
    if (idx >= pasos.length - 1) {
      setLlegado(true);
      decir("Has llegado a tu destino");
    } else {
      setIdx((i) => i + 1);
    }
  };

  if (!trip?.seleccionada || !actual) return <PhoneFrame><div /></PhoneFrame>;
  const op = trip.seleccionada;

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

          {op.cashbackEur > 0 && (
            <div className="bg-cashback-bg text-cashback-text rounded-[24px] p-5 flex flex-col items-center gap-1 mt-2">
              <div className="text-[13px] font-bold uppercase tracking-wide">Cashback Cabify</div>
              <div className="text-[40px] font-bold leading-none">+{fmtEurCashback(op.cashbackEur)}</div>
              <div className="text-[13px]">en saldo para tu próximo viaje</div>
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

  return (
    <PhoneFrame>
      <div className="absolute inset-0 flex flex-col bg-bg">
        {/* mapa esquemático */}
        <div className="relative h-[40%] bg-bg-subdued overflow-hidden">
          <SchematicMap tramos={op.tramos} progreso={progreso} />
          <button
            onClick={() => navigate({ to: "/viaje" })}
            className="absolute top-3 left-3 w-10 h-10 rounded-full bg-surface grid place-items-center"
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
            className="absolute top-3 right-3 w-10 h-10 rounded-full bg-surface grid place-items-center"
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

          <ul className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {pasos.slice(idx + 1, idx + 5).map((p, i) => (
              <li key={i} className="flex items-center gap-3 p-2 rounded-[8px]">
                <div className="w-8 h-8 rounded-full grid place-items-center" style={{ background: `${p.tramo.color}1a` }}>
                  <ModoIcon tipo={p.tramo.tipo} size={16} />
                </div>
                <div className="flex-1 text-[14px] text-text-secondary truncate">{p.paso.instruccion}</div>
                <div className="text-[12px] text-text-secondary">{fmtMin(p.paso.duracionMin)}</div>
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

function SchematicMap({ tramos, progreso }: { tramos: Tramo[]; progreso: number }) {
  const total = tramos.reduce((s, t) => s + t.distanciaKm, 0) || 1;
  let acc = 0;
  return (
    <svg viewBox="0 0 390 340" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="grid2" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e6e6ed" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="390" height="340" fill="#f1f0f6" />
      <rect width="390" height="340" fill="url(#grid2)" />

      {tramos.map((t, i) => {
        const y0 = 40 + (acc / total) * 260;
        acc += t.distanciaKm;
        const y1 = 40 + (acc / total) * 260;
        const dash = t.tipo === "andando" ? "6 6" : undefined;
        return (
          <g key={i}>
            <line x1="195" y1={y0} x2="195" y2={y1} stroke={modoColor(t.tipo)} strokeWidth="8" strokeLinecap="round" strokeDasharray={dash} />
            <circle cx="195" cy={y0} r="8" fill="white" stroke={modoColor(t.tipo)} strokeWidth="3" />
          </g>
        );
      })}
      <circle cx="195" cy="300" r="8" fill="white" stroke="#1a1a1c" strokeWidth="3" />
      <circle cx="195" cy={40 + (progreso / 100) * 260} r="10" fill="#7145d6" stroke="white" strokeWidth="4" />
    </svg>
  );
}
