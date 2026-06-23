import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock, Leaf, Plus } from "lucide-react";
import { PhoneFrame } from "@/components/transit/PhoneFrame";
import { getTrip, setTrip } from "@/lib/transit/store";
import { generarOpciones, ordenarOpciones, type Criterio, type Opcion } from "@/lib/transit/engine";
import { fmtEur, fmtMin, fmtCo2 } from "@/lib/transit/format";
import { ModoIcon } from "@/components/transit/ModoIcon";

export const Route = createFileRoute("/resultados")({
  component: Resultados,
});

const CHIPS: { id: Criterio; label: string }[] = [
  { id: "equilibrado", label: "Equilibrado" },
  { id: "rapido", label: "Rápido" },
  { id: "barato", label: "Barato" },
  { id: "ecologico", label: "Ecológico" },
];

// Copy de venta para opciones Cabify: compara contra la opción de metro simple
// para destacar cuánto más cuesta y cuánto tiempo se ahorra.
function fraseVenta(op: Opcion, metro: Opcion | null): string | null {
  if (!metro || op.id === metro.id) return null;
  if (!op.modos.includes("cabify")) return null;
  const extra = op.precioEur - metro.precioEur;
  const ahorro = Math.round(metro.etaMin - op.etaMin);
  if (extra <= 0.01 || ahorro <= 0) return null;
  const e = `${extra.toFixed(2).replace(".", ",")} €`;
  return `${e} más que el metro, pero ${ahorro} min más rápido`;
}

function Resultados() {
  const navigate = useNavigate();
  const [trip, setTripLocal] = useState(() => getTrip());
  const [criterio, setCriterio] = useState<Criterio>(trip?.criterio ?? "equilibrado");

  useEffect(() => {
    if (!trip || !trip.destino) {
      navigate({ to: "/buscar" });
    }
  }, [trip, navigate]);

  const { opciones, distKm } = useMemo(() => {
    if (!trip?.destino) return { opciones: [], distKm: 0 };
    return generarOpciones(trip.destino);
  }, [trip?.destino]);

  const ordenadas = useMemo(() => ordenarOpciones(opciones, criterio), [opciones, criterio]);
  const metroRef = useMemo(
    () => ordenadas.find((o) => o.id === "simple-metro") ?? null,
    [ordenadas]
  );

  const elegir = (op: Opcion) => {
    setTrip({ seleccionada: op, criterio });
    navigate({ to: "/viaje" });
  };

  if (!trip) return <PhoneFrame><div /></PhoneFrame>;

  return (
    <PhoneFrame>
      <div className="absolute inset-0 flex flex-col bg-bg-subdued">
        <div className="px-3 pt-3 pb-3 bg-bg border-b border-border flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate({ to: "/buscar" })} className="w-10 h-10 -ml-2 grid place-items-center">
              <ArrowLeft size={22} />
            </button>
            <button
              onClick={() => navigate({ to: "/buscar" })}
              className="flex-1 min-w-0 text-left bg-field rounded-[8px] px-3 py-2"
            >
              <div className="text-[12px] text-text-secondary truncate">{trip.origen}</div>
              <div className="text-[15px] font-medium text-text truncate">→ {trip.destino}</div>
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto -mx-3 px-3 pb-1">
            {CHIPS.map((c) => (
              <button
                key={c.id}
                onClick={() => { setCriterio(c.id); setTrip({ criterio: c.id }); setTripLocal(getTrip()); }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[14px] font-medium border ${
                  criterio === c.id
                    ? "bg-text text-white border-text"
                    : "bg-bg text-text border-border"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          <div className="text-[12px] text-text-secondary px-1">
            {ordenadas.length} opciones · {distKm.toFixed(1).replace(".", ",")} km
          </div>
          {ordenadas.map((op) => (
            <button
              key={op.id}
              onClick={() => elegir(op)}
              className="bg-surface rounded-[16px] p-4 text-left flex flex-col gap-3"
              style={{ boxShadow: "var(--shadow-resting)" }}
            >
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {op.modos.map((m, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <Plus size={12} className="text-text-secondary" />}
                      <ModoIcon tipo={m} size={20} />
                    </span>
                  ))}
                </div>
                <div className="flex-1 font-bold text-[15px] text-text">{op.nombre}</div>
                {op.esSostenible && (
                  <Leaf size={16} className="text-eco-text" />
                )}
              </div>

              <div className="flex items-center gap-3 text-[14px]">
                <span className="flex items-center gap-1 font-bold text-text">
                  <Clock size={14} /> {fmtMin(op.etaMin)}
                </span>
                <span className="font-bold text-text">{fmtEur(op.precioEur)}</span>
                <span className="text-text-secondary">{fmtCo2(op.co2Kg)}</span>
              </div>

              {op.puntos > 0 && (
                <div className="self-start bg-cashback-bg text-cashback-text rounded-full pl-1.5 pr-3 py-1 text-[12px] font-bold flex items-center gap-1.5">
                  <img src="/icons/ic_cabify_club_spark_color.svg" alt="" className="w-4 h-4" />
                  +{op.puntos} puntos Cabify Club
                </div>
              )}

              {(() => {
                const v = fraseVenta(op, metroRef);
                return v ? (
                  <div className="self-start bg-eco-bg text-eco-text rounded-full px-3 py-1 text-[12px] font-bold">
                    {v}
                  </div>
                ) : null;
              })()}

              {op.desglose && (
                <div className="text-[12px] text-text-secondary">{op.desglose}</div>
              )}
            </button>
          ))}
          {ordenadas.length === 0 && (
            <div className="text-center text-text-secondary py-12 text-[14px]">
              No hay opciones de movilidad para este trayecto.
            </div>
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}
