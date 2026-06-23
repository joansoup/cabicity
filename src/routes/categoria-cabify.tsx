import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Calendar, Info } from "lucide-react";
import { PhoneFrame } from "@/components/transit/PhoneFrame";
import { getTrip, setTrip, type TripState } from "@/lib/transit/store";
import { categoriasParaOpcion, CABIFY_CATEGORIAS, type CabifyCategoriaId } from "@/lib/transit/engine";
import { fmtEur } from "@/lib/transit/format";

export const Route = createFileRoute("/categoria-cabify")({
  component: CategoriaCabify,
});

function CategoriaCabify() {
  const navigate = useNavigate();
  const [trip, setT] = useState<TripState | null>(null);
  const [seleccion, setSeleccion] = useState<CabifyCategoriaId>("eco");

  useEffect(() => {
    const t = getTrip();
    if (!t?.seleccionada || !t.seleccionada.modos.includes("cabify")) {
      navigate({ to: t?.seleccionada ? "/navegacion" : "/resultados" });
      return;
    }
    setT(t);
    if (t.categoriaCabify) setSeleccion(t.categoriaCabify);
  }, [navigate]);

  const categorias = useMemo(() => {
    if (!trip?.seleccionada) return [];
    return categoriasParaOpcion(trip.seleccionada);
  }, [trip?.seleccionada]);

  const elegida = categorias.find((c) => c.id === seleccion) ?? categorias[0];
  const eco = categorias.find((c) => c.id === "eco");

  const continuar = () => {
    setTrip({ categoriaCabify: seleccion });
    navigate({ to: "/navegacion" });
  };

  if (!trip?.seleccionada || !elegida) return <PhoneFrame><div /></PhoneFrame>;

  return (
    <PhoneFrame>
      <div className="absolute inset-0 flex flex-col bg-bg">
        {/* Header */}
        <div className="px-3 pt-3 pb-3 flex items-center gap-2">
          <button onClick={() => navigate({ to: "/viaje" })} className="w-10 h-10 -ml-2 grid place-items-center">
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1 text-center text-[16px] font-bold text-text -ml-10">Pide tu viaje</div>
        </div>

        {/* Método de pago */}
        <div className="px-4 pb-3">
          <button className="w-full flex items-center gap-3 border border-border rounded-[14px] px-3 py-3">
            <div className="w-9 h-6 rounded grid place-items-center bg-white">
              <span className="block w-4 h-4 rounded-full bg-[#eb001b] -mr-1.5" />
              <span className="block w-4 h-4 rounded-full bg-[#f79e1b] opacity-90" />
            </div>
            <div className="flex-1 text-left text-[15px] text-text">···· 7892</div>
            <ChevronRight size={20} className="text-brand" />
          </button>
        </div>

        <div className="h-2 bg-bg-subdued" />

        {/* Listado de categorías */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-3 flex flex-col gap-3">
          <h2 className="text-[18px] font-bold text-text">Elige cómo moverte</h2>

          {categorias.map((c) => {
            const activa = c.id === seleccion;
            const esEco = c.id === "eco";
            const tachado = esEco ? categorias.find((x) => x.id === "estandar")?.totalEur ?? null : null;
            const precioTachado = tachado && tachado > c.totalEur ? tachado : null;

            return (
              <button
                key={c.id}
                onClick={() => setSeleccion(c.id)}
                className={`w-full text-left rounded-[16px] p-4 border transition-all ${
                  activa
                    ? "border-brand bg-surface"
                    : "border-border bg-surface"
                }`}
                style={{ boxShadow: activa ? "0 0 0 1px var(--brand)" : undefined }}
              >
                {activa ? (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[17px] font-bold text-text">
                        {c.nombre}
                        <span className="w-4 h-4 rounded-full bg-text-secondary/70 grid place-items-center">
                          <Info size={10} className="text-white" />
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <div className="text-[22px] font-bold text-text">{fmtEur(c.totalEur)}</div>
                        {precioTachado && precioTachado > c.totalEur && (
                          <div className="text-[15px] text-text-secondary line-through">{fmtEur(precioTachado)}</div>
                        )}
                      </div>
                      <div className="mt-1 text-[14px] text-text-secondary">
                        Te recogerá en {2 + c.etaExtraMin} min
                      </div>
                    </div>
                    <CarIlustracion />
                  </div>
                ) : (
                  <div>
                    <div className="text-[16px] font-bold text-text">
                      {c.nombre} · {fmtEur(c.totalEur)}
                    </div>
                    <div className="text-[14px] text-text-secondary mt-0.5">
                      en {2 + c.etaExtraMin} min
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer total + CTA */}
        <div className="border-t border-border bg-bg px-4 pt-3 pb-4 flex flex-col gap-3">
          <div className="flex items-center">
            <div className="flex items-center gap-1.5 text-[16px] font-bold text-text">
              Total
              <span className="w-4 h-4 rounded-full bg-text-secondary/70 grid place-items-center">
                <Info size={10} className="text-white" />
              </span>
            </div>
            <div className="flex-1" />
            <div className="text-[20px] font-bold text-text">{fmtEur(elegida.totalEur)}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={continuar}
              className="flex-1 h-12 rounded-[16px] bg-brand text-white font-bold text-[16px]"
            >
              Pedir ahora
            </button>
            <button
              aria-label="Programar"
              className="w-12 h-12 rounded-[14px] bg-brand/10 grid place-items-center text-brand"
            >
              <Calendar size={20} />
            </button>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function CarIlustracion() {
  return (
    <div className="w-[88px] h-[60px] shrink-0 grid place-items-center">
      <svg viewBox="0 0 88 60" width="88" height="60" aria-hidden="true">
        <ellipse cx="44" cy="52" rx="34" ry="3" fill="#000" opacity="0.08" />
        <path d="M14 42 L22 24 Q26 18 34 17 L58 17 Q66 18 70 24 L78 42 Z" fill="#7145d6" />
        <path d="M28 26 Q31 21 36 21 L56 21 Q61 21 64 26 L67 33 L25 33 Z" fill="#8fd5ff" />
        <circle cx="28" cy="44" r="7" fill="#1b1238" />
        <circle cx="28" cy="44" r="3" fill="#7145d6" />
        <circle cx="64" cy="44" r="7" fill="#1b1238" />
        <circle cx="64" cy="44" r="3" fill="#7145d6" />
      </svg>
    </div>
  );
}
