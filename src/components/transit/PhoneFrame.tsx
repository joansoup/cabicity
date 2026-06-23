import type { ReactNode } from "react";
import { Signal, Wifi, BatteryFull } from "lucide-react";

interface Props {
  children: ReactNode;
  statusBarDark?: boolean;
  // Cuando true, la status bar flota transparente sobre el contenido (p. ej.
  // home, donde el mapa debe verse pegado al borde superior). Por defecto la
  // status bar ocupa su propio hueco para no pisar los controles de la página.
  transparentStatusBar?: boolean;
}

export function PhoneFrame({ children, statusBarDark = true, transparentStatusBar = false }: Props) {
  const statusBar = (
    <div
      className={`flex items-center justify-between px-6 pt-3 pb-1 text-[14px] font-bold pointer-events-none ${
        transparentStatusBar ? "absolute top-0 left-0 right-0 z-20" : "relative shrink-0"
      } ${statusBarDark ? "text-text" : "text-white"}`}
      style={{ height: 32 }}
    >
      <span>9:41</span>
      <div className="flex items-center gap-1.5">
        <Signal size={14} />
        <Wifi size={14} />
        <BatteryFull size={18} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full flex items-stretch sm:items-center justify-center bg-bg-subdued">
      <div
        className="relative w-full sm:w-[390px] sm:h-[844px] bg-bg overflow-hidden sm:rounded-[40px] sm:shadow-over flex flex-col"
        style={{ maxWidth: 390 }}
      >
        {!transparentStatusBar && statusBar}
        <div className="flex-1 relative overflow-hidden">{children}</div>
        {transparentStatusBar && statusBar}
      </div>
    </div>
  );
}
