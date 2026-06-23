import { TrainFront } from "lucide-react";
import type { ModoTipo } from "@/lib/transit/engine";

interface Props {
  tipo: ModoTipo;
  size?: number;
  className?: string;
}

const COLOR: Record<ModoTipo, string> = {
  cabify: "#7145d6",
  metro: "#2760c2",
  cercanias: "#017251",
  ave: "#5b34ac",
  andando: "#5e6088",
  bicimad: "#ea8c2e",
  bus: "#bf2721",
};

// Logos/iconos reales por modo (SVG en /public). AVE no tiene logo propio aquí,
// usa un icono lucide. Metro/Cercanías/EMT usan los logotipos oficiales.
const SRC: Partial<Record<ModoTipo, string>> = {
  cabify: "/icons/ic_cabify.svg",
  metro: "/logos/metro.svg",
  cercanias: "/logos/cercanias.svg",
  bus: "/logos/emt.svg",
  andando: "/icons/ic_walking.svg",
  bicimad: "/icons/ic_bicycle.svg",
};

export function ModoIcon({ tipo, size = 20, className }: Props) {
  if (tipo === "ave") {
    return <TrainFront size={size} color={COLOR.ave} className={className} />;
  }
  const src = SRC[tipo];
  // Algunos logos son apaisados (Metro); mantenemos su proporción con height fijo.
  return (
    <img
      src={src}
      alt={tipo}
      className={className}
      style={{ height: size, width: "auto", maxWidth: size * 1.9, objectFit: "contain" }}
    />
  );
}

export function modoColor(tipo: ModoTipo): string {
  return COLOR[tipo];
}
