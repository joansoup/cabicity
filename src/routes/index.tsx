import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, Clock, Home, Star, Calendar, Send, Car } from "lucide-react";
import { PhoneFrame } from "@/components/transit/PhoneFrame";
import { setTrip } from "@/lib/transit/store";
import { MapaMapbox } from "@/components/transit/MapaMapbox";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cabify Transit · Viajar" },
      { name: "description", content: "Comparador intermodal de Cabify en Madrid." },
    ],
  }),
  component: HomePage,
});

const PREDICCIONES = [
  { tipo: "casa", titulo: "Casa", sub: "Calle de las Flores, 8, Madrid" },
  { tipo: "reciente", titulo: "El Corte Inglés", sub: "Calle Princesa, 64" },
  { tipo: "reciente", titulo: "Aeropuerto Barajas - T2", sub: "Barajas, Madrid" },
];



function HomePage() {
  const navigate = useNavigate();

  const goSearch = (destino?: string) => {
    setTrip({ origen: "Tu ubicación actual", destino: destino ?? "", criterio: "equilibrado" });
    navigate({ to: "/buscar" });
  };

  return (
    <PhoneFrame>
      <div className="absolute inset-0">
        <MapaMapbox centro={[-3.7038, 40.4168]} zoom={12.5} fitRuta={false} />
      </div>

      {/* avatar */}
      <div className="absolute top-3 right-4 w-12 h-12 rounded-full bg-brand text-white grid place-items-center font-bold shadow-rised" style={{ boxShadow: "var(--shadow-rised)" }}>
        IB
      </div>

      {/* bottom sheet */}
      <div className="absolute left-0 right-0 bottom-[68px] bg-surface rounded-t-[24px] p-4 pb-5 flex flex-col gap-4" style={{ boxShadow: "var(--shadow-rised)" }}>
        <div className="mx-auto h-1 w-9 rounded-full" style={{ background: "var(--sheet-handle)" }} />
        <h1 className="text-[18px] font-bold leading-6">¿A dónde vamos?</h1>

        <div className="flex gap-2">
          {[
            { label: "Ahora", icon: <Clock size={22} /> },
            { label: "Programar", icon: <Calendar size={22} /> },
            { label: "Favoritos", icon: <Star size={22} /> },
          ].map((b) => (
            <button key={b.label} className="flex-1 h-[88px] bg-field rounded-[16px] flex flex-col items-center justify-center gap-1.5 text-[14px] font-medium text-text">
              <span className="text-brand">{b.icon}</span>
              {b.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => goSearch()}
          className="w-full bg-field rounded-[8px] px-4 py-4 flex items-center gap-4 text-left"
        >
          <Search size={20} className="text-text-secondary" />
          <span className="text-text-secondary text-[16px]">Introduce tu ruta</span>
        </button>

        <ul className="flex flex-col gap-1">
          {PREDICCIONES.map((p, i) => (
            <li key={i}>
              <button
                onClick={() => goSearch(p.sub)}
                className="w-full p-2 rounded-[8px] flex items-center gap-4 text-left hover:bg-field active:bg-field"
              >
                <span className="w-8 h-8 rounded-[8px] grid place-items-center flex-shrink-0" style={{
                  background: p.tipo === "casa" ? "#ecf4fd" : "var(--field-bg)",
                  color: p.tipo === "casa" ? "#2760c2" : "var(--text-secondary)",
                }}>
                  {p.tipo === "casa" ? <Home size={18} /> : <Clock size={18} />}
                </span>
                <span className="flex-1 min-w-0">
                  <div className="text-[16px] text-text font-medium truncate">{p.titulo}</div>
                  <div className="text-[14px] text-text-secondary truncate">{p.sub}</div>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* bottom nav */}
      <div className="absolute left-0 right-0 bottom-0 h-[68px] bg-surface flex items-end justify-around pt-1 pb-2" style={{ boxShadow: "0 -2px 12px #00000010" }}>
        <NavTab label="Viajar" active icon={<Car size={22} />} />
        <div className="w-12 relative">
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full grid place-items-center" style={{
            background: "linear-gradient(135deg, #7145d6, #feb54e)",
            boxShadow: "var(--shadow-rised)",
          }}>
            <img src="/icons/ic_medal_three_sides_circular_multi.svg" alt="" className="w-6 h-6 invert brightness-0" style={{ filter: "brightness(0) invert(1)" }} />
          </div>
          <div className="text-[11px] text-text-secondary text-center mt-7 font-medium">Club</div>
        </div>
        <NavTab label="Enviar" icon={<Send size={22} />} />
      </div>

      {/* home indicator */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-32 rounded-full bg-black/80" />
    </PhoneFrame>
  );
}

function NavTab({ label, icon, active }: { label: string; icon: React.ReactNode; active?: boolean }) {
  return (
    <button className={`flex-1 flex flex-col items-center gap-1 ${active ? "text-brand" : "text-text-secondary"}`}>
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
