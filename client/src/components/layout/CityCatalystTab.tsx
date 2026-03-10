import { ExternalLink } from "lucide-react";

export default function CityCatalystTab() {
  return (
    <div data-testid="citycatalyst-tab" className="fixed bottom-0 left-0 z-50">
      <div
        className="rounded-tr-2xl px-6 py-4 shadow-lg"
        style={{ backgroundColor: '#3B63C4', fontFamily: 'Poppins, sans-serif' }}
      >
        <div className="flex items-center gap-3">
          <a
            href="https://citycatalyst.openearth.dev"
            data-testid="link-citycatalyst-icon"
            className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center p-1 hover:bg-white/30 transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-white" />
          </a>
          <div className="text-white">
            <div className="text-sm font-medium">
              <a
                href="https://citycatalyst.openearth.dev"
                data-testid="link-citycatalyst"
                className="hover:underline font-semibold"
              >
                Go back to CityCatalyst
              </a>
            </div>
            <div className="text-xs opacity-90">
              Exit module and return to the main platform
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
