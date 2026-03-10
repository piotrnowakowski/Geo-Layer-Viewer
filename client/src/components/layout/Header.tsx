export default function Header() {
  return (
    <header
      data-testid="header"
      className="h-14 flex items-center px-4 z-[1002] relative"
      style={{ backgroundColor: "#001fa8" }}
    >
      <div className="flex items-center gap-3">
        <a
          href="https://citycatalyst.openearth.dev"
          data-testid="link-citycatalyst-header"
          className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
        >
          <img src="/oef-logo.svg" alt="OpenEarth" className="w-6 h-6" />
        </a>

        <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>

        <span className="text-white text-sm font-medium tracking-wide" style={{ fontFamily: "Poppins, sans-serif" }}>
          Project Preparation Data Layers
        </span>
      </div>
    </header>
  );
}
