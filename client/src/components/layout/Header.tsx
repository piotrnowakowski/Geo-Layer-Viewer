import { Leaf, Globe, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  isLoading: boolean;
  dataStatus: string;
  onFetchData: () => void;
}

export default function Header({ isLoading, dataStatus, onFetchData }: HeaderProps) {
  return (
    <header
      data-testid="header"
      className={cn(
        "h-12 flex items-center justify-between px-4",
        "bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800",
        "z-[1002] relative"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white leading-tight">NbS Map Visualizer</h1>
            <p className="text-[10px] text-zinc-400 leading-tight">Porto Alegre, Brazil</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {dataStatus && (
          <span data-testid="text-data-status" className="text-[10px] text-zinc-400">
            {dataStatus}
          </span>
        )}
        <button
          data-testid="button-fetch-data"
          onClick={onFetchData}
          disabled={isLoading}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
            "bg-primary hover:bg-primary/90 text-primary-foreground",
            "transition-colors duration-150",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Globe className="w-3.5 h-3.5" />
          )}
          {isLoading ? "Fetching..." : "Fetch Real Data"}
        </button>
      </div>
    </header>
  );
}
