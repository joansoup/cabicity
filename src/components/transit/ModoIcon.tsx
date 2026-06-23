import { Bus, TramFront, TrainFront, TrainFrontTunnel } from "lucide-react";
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

export function ModoIcon({ tipo, size = 20, className }: Props) {
  const color = COLOR[tipo];
  const common = { size, color, className } as const;
  if (tipo === "metro") return <TramFront {...common} />;
  if (tipo === "cercanias") return <TrainFrontTunnel {...common} />;
  if (tipo === "ave") return <TrainFront {...common} />;
  if (tipo === "bus") return <Bus {...common} />;
  const src =
    tipo === "cabify" ? "/icons/ic_cabify.svg"
    : tipo === "andando" ? "/icons/ic_walking.svg"
    : "/icons/ic_bicycle.svg";
  return <img src={src} alt={tipo} width={size} height={size} className={className} style={{ color }} />;
}

export function modoColor(tipo: ModoTipo): string {
  return COLOR[tipo];
}
