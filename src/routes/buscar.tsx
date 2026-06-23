import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, MapPin, Circle, Square, Clock, Home } from "lucide-react";
import { PhoneFrame } from "@/components/transit/PhoneFrame";
import { getTrip, setTrip } from "@/lib/transit/store";

export const Route = createFileRoute("/buscar")({
  component: BuscarPage,
});

const ORIGEN_DEFAULT = "Calle de Pradillo, 42, Chamartín, 28002 Madrid";

const RECIENTES = [
  { tipo: "casa", titulo: "Casa", sub: "Calle de las Flores, 8, Madrid" },
  { tipo: "reciente", titulo: "El Corte Inglés", sub: "Calle Princesa, 64" },
  { tipo: "reciente", titulo: "Aeropuerto Barajas - T2", sub: "Barajas, Madrid" },
  { tipo: "reciente", titulo: "AVE Madrid - Sevilla", sub: "Estación Madrid Atocha" },
];

// Lugares para el autocompletado del destino (se filtran según escribes).
const PLACES = [
  ...RECIENTES,
  { tipo: "reciente", titulo: "Puerta del Sol", sub: "Puerta del Sol, Madrid" },
  { tipo: "reciente", titulo: "Estadio Santiago Bernabéu", sub: "Av. de Concha Espina, 1" },
  { tipo: "reciente", titulo: "Estación de Atocha", sub: "Atocha, Madrid" },
  { tipo: "reciente", titulo: "Estación de Chamartín", sub: "Chamartín, Madrid" },
  { tipo: "reciente", titulo: "Gran Vía", sub: "Gran Vía, Madrid" },
  { tipo: "reciente", titulo: "Parque del Retiro", sub: "Plaza de la Independencia, Madrid" },
  { tipo: "reciente", titulo: "IFEMA", sub: "Av. del Partenón, 5, Madrid" },
  { tipo: "reciente", titulo: "Nuevos Ministerios", sub: "Paseo de la Castellana, Madrid" },
  { tipo: "reciente", titulo: "AVE Madrid - Barcelona", sub: "Barcelona Sants" },
  { tipo: "reciente", titulo: "Toledo", sub: "Toledo centro" },
];

function BuscarPage() {
  const navigate = useNavigate();
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");

  const q = destino.trim().toLowerCase();
  const sugerencias = q
    ? PLACES.filter((p) => `${p.titulo} ${p.sub}`.toLowerCase().includes(q)).slice(0, 6)
    : RECIENTES;

  useEffect(() => {
    const t = getTrip();
    if (t) {
      setOrigen(t.origen || ORIGEN_DEFAULT);
      setDestino(t.destino || "");
    } else {
      setOrigen(ORIGEN_DEFAULT);
    }
  }, []);

  const submit = () => {
    if (!origen.trim() || !destino.trim()) return;
    setTrip({ origen, destino, criterio: "equilibrado", seleccionada: undefined });
    navigate({ to: "/resultados" });
  };

  return (
    <PhoneFrame>
      <div className="absolute inset-0 flex flex-col bg-bg">
        <div className="px-4 pt-3 pb-4 flex items-center gap-3 border-b border-border">
          <button onClick={() => navigate({ to: "/" })} className="w-10 h-10 -ml-2 grid place-items-center">
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Circle size={14} className="text-brand fill-brand" />
              <input
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
                placeholder="¿Desde dónde sales?"
                className="flex-1 bg-field rounded-[8px] px-3 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div className="flex items-center gap-3">
              <Square size={14} className="text-text fill-text" />
              <input
                autoFocus
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                placeholder="¿A dónde vas?"
                className="flex-1 bg-field rounded-[8px] px-3 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-brand"
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto p-2">
          {sugerencias.map((p, i) => (
            <li key={i}>
              <button
                onClick={() => { setDestino(p.titulo); }}
                className="w-full p-3 rounded-[8px] flex items-center gap-4 text-left hover:bg-field"
              >
                <span className="w-9 h-9 rounded-[8px] grid place-items-center" style={{
                  background: p.tipo === "casa" ? "#ecf4fd" : "var(--field-bg)",
                  color: p.tipo === "casa" ? "#2760c2" : "var(--text-secondary)",
                }}>
                  {p.tipo === "casa" ? <Home size={18} /> : <Clock size={18} />}
                </span>
                <span className="flex-1 min-w-0">
                  <div className="text-[16px] text-text font-medium truncate">{p.titulo}</div>
                  <div className="text-[14px] text-text-secondary truncate">{p.sub}</div>
                </span>
                <MapPin size={16} className="text-text-secondary" />
              </button>
            </li>
          ))}
        </ul>

        <div className="p-4 bg-bg border-t border-border">
          <button
            disabled={!origen.trim() || !destino.trim()}
            onClick={submit}
            className="w-full h-12 rounded-[16px] bg-brand text-white font-bold text-[16px] disabled:opacity-40"
          >
            Ver opciones
          </button>
        </div>
      </div>
    </PhoneFrame>
  );
}
