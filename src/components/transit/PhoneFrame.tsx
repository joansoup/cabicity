import type { ReactNode } from "react";
import { Signal, Wifi, BatteryFull } from "lucide-react";

interface Props {
  children: ReactNode;
  statusBarDark?: boolean;
}

export function PhoneFrame({ children, statusBarDark = true }: Props) {
  return (
    <div className="min-h-screen w-full flex items-stretch sm:items-center justify-center bg-bg-subdued">
      <div
        className="relative w-full sm:w-[390px] sm:h-[844px] bg-bg overflow-hidden sm:rounded-[40px] sm:shadow-over flex flex-col"
        style={{ maxWidth: 390 }}
      >
        <div
          className={`flex items-center justify-between px-6 pt-3 pb-1 text-[14px] font-bold ${statusBarDark ? "text-text" : "text-white"}`}
          style={{ height: 32 }}
        >
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <Signal size={14} />
            <Wifi size={14} />
            <BatteryFull size={18} />
          </div>
        </div>
        <div className="flex-1 relative overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
