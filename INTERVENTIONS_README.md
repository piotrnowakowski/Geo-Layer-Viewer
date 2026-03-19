# Solar PV Interventions Module

This module implements the Site & Technology Selection UI for Porto Alegre solar PV interventions, as specified in the PRD: [site-technology-selection-prd.md](https://github.com/Open-Earth-Foundation/Project-preparation-Energy-POC/blob/main/docs/ui/site-technology-selection-prd.md).

## Overview

The Interventions module enables city planners to assess and prioritize two solar PV interventions:

1. **Municipal Solar Portfolio** — Prioritize rooftop solar installations on city-owned buildings (schools and municipal facilities)
2. **Building Solar Regulation** — Design IPTU Sustentável (property tax incentive) for commercial buildings with geospatial assessment and scenario modeling

## Features

### Intervention 1: Municipal Solar Portfolio

- **3-tier prioritization:** High (top 20%), Medium (next 40%), Low (remaining 40%)
- **Building scoring:** Solar resource (25%) + Land availability (20%) + Flood risk (15%) + Grid proximity (15%) + Population density (15%) + Social vulnerability (10%)
- **Summary metrics:** Total capacity (MWp), investment (R$M), annual savings (R$/yr), CO2 avoided (tCO2e/yr)
- **Building details:** Score, roof area, capacity, generation, savings, payback, flood risk
- **Map integration:** Color-coded markers by priority tier, zoom-to-building navigation

### Intervention 2: Building Solar Regulation (IPTU Sustentável)

#### Tab 1: Geospatial Assessment
- **Neighborhood tiers:** High potential (green), Medium (amber), Low (gray)
- **Tier ranking:** Combines solar energy potential with IPTU revenue forfeited
- **Commercial buildings:** Interactive markers showing solar potential
- **Residential buildings:** Grayed out, non-clickable context markers
- **Neighborhood detail card:** Two scenario analysis:
  - Scenario A: 5% IPTU discount (~15% adoption)
  - Scenario B: 10% IPTU discount (~30% adoption)
- **Metrics per scenario:** Revenue lost, PV installed (kWp), annual generation (MWh), CO2 avoided (tCO2e)

#### Tab 2: Similar Projects
- Reference projects from Brazilian cities (Salvador, Guarulhos, Recife, Belo Horizonte)
- Program summaries, key learnings, and external links

#### Tab 3: Next Steps
- **Primary action:** Grid capacity assessment with CEEE Equatorial
- **Download functionality:** Export selected neighborhood list for distributor contact
- **Pending data checklist:** Building registry, IPTU records, permits, heritage zones, flood risk

## Architecture

### Components

```
client/src/components/interventions/
├── InterventionsContainer.tsx      # State management & map integration
├── InterventionDashboard.tsx       # Landing page with 2 intervention cards
├── MunicipalSolarPanel.tsx         # Tab-based building priority interface
└── SolarRegulationPanel.tsx        # Policy instrument selection & IPTU details
```

### Data

```
client/src/data/intervention-data.ts
├── MunicipalBuilding interface     # 560 buildings (56 mock)
├── Neighborhood interface          # 10 neighborhoods with scenarios
├── CommercialBuilding interface    # Commercial buildings per neighborhood
├── ResidentialBuilding interface   # Residential buildings (context only)
├── REFERENCE_PROJECTS[]            # 4 Brazilian case studies
├── generateMunicipalBuildings()    # Mock data generator
├── generateNeighborhoods()         # Mock data generator
├── generateCommercialBuildings()   # Mock data generator
└── generateResidentialBuildings()  # Mock data generator
```

### Integration Points

- **MapViewer.tsx:** Hosts `InterventionsContainer` component, passes map reference
- **Header.tsx:** "Interventions" button to navigate to dashboard
- **Map interactions:** Building/neighborhood selection triggers map zoom and highlighting

## Mock Data

### Municipal Buildings
- **560 buildings** across 10 Porto Alegre neighborhoods
- **Types:** Schools (EMEF) and facilities
- **Metrics:** Score (0–100), capacity (30–300 kWp), annual generation, costs, payback, CO2 avoided
- **Solar GHI:** 1,500–1,700 kWh/m²/yr (realistic for Porto Alegre)
- **CAPEX:** R$4,500/kWp benchmark
- **Flood risk:** Low, moderate, high distribution

### Neighborhoods (10 total)
- **Distribution:** 3 high potential, 4 medium, 3 low
- **Metrics per neighborhood:** Commercial/residential building counts, solar potential, IPTU revenue
- **Scenarios:** 5% and 10% discount adoption rates with impacts
- **Map bounds:** Polygon boundaries for spatial visualization

### Reference Projects
- **Salvador, BA:** IPTU Verde since 2015, 500+ commercial properties
- **Guarulhos, SP:** 5–20% IPTU discount, faster payback for larger buildings
- **Recife, PE:** IPTU Sustentável (2020), paired with BNDES financing
- **Belo Horizonte, MG:** IPTU Verde linked to sustainability certification

## Usage

### Access Interventions
1. Click "Interventions" button in header → opens dashboard
2. Select one of two intervention cards
3. Dashboard closes, intervention panel opens

### Municipal Portfolio Workflow
1. Select priority tier (High/Medium/Low)
2. View summary metrics for selected tier
3. Browse building list, click to select
4. View building detail card
5. Click "Select this scope" to confirm

### Building Regulation Workflow
1. Click "IPTU Sustentável" to begin
2. Select a neighborhood from the list
3. View tier badge and metrics
4. Compare 5% vs 10% discount scenarios
5. Explore similar projects or next steps
6. Download neighborhood list for distributor outreach

### Map Interactions
- **Municipal mode:** Buildings highlighted by tier color on map
- **Regulation mode:** Neighborhoods shown as polygons (tier-colored), buildings as markers (commercial=green, residential=gray)
- **Zoom-on-select:** Clicking a feature zooms map to that location
- **Building/neighborhood info:** Hover or click markers/polygons for details

## Styling

- **Color scheme:** Dark theme (#001fa8 brand blue, gray backgrounds)
- **Components:** shadcn/ui (Tabs, Card, Badge, Button, Sheet, ScrollArea)
- **Responsive:** Full-width panels on mobile, side sheets on desktop
- **Accessibility:** ARIA labels, keyboard navigation, semantic HTML

## Future Enhancements

1. **Backend integration:** Replace mock data with API calls
2. **Real geospatial data:** Use actual building footprints, solar irradiance, IPTU records
3. **Scenario export:** Generate concept briefs or PDF reports
4. **Grid data:** Integrate feeder capacity estimates
5. **Dynamic scoring:** Recalculate scores based on user-selected criteria
6. **Multi-city support:** Extend to other municipalities
7. **Mobile app:** React Native version for field assessments

## Files Modified/Created

### Created
- `client/src/components/interventions/InterventionDashboard.tsx`
- `client/src/components/interventions/MunicipalSolarPanel.tsx`
- `client/src/components/interventions/SolarRegulationPanel.tsx`
- `client/src/components/interventions/InterventionsContainer.tsx`
- `client/src/data/intervention-data.ts`
- `INTERVENTIONS_README.md` (this file)

### Modified
- `client/src/components/map/MapViewer.tsx` — Integrated `InterventionsContainer`
- `client/src/components/layout/Header.tsx` — Added "Interventions" navigation button

## Dependencies

- React 18.3+
- Leaflet 1.9+ (for map rendering)
- shadcn/ui (Tabs, Card, Badge, Button, Sheet, ScrollArea, Separator)
- Lucide React (icons)

## Testing

All TypeScript code passes type checking:
```bash
npm run check
```

To start the dev server (requires network access):
```bash
npm run dev
```

The app will be available at `http://localhost:5173` (or configured Vite port).

## References

- PRD: [site-technology-selection-prd.md](https://github.com/Open-Earth-Foundation/Project-preparation-Energy-POC/blob/main/docs/ui/site-technology-selection-prd.md)
- Porto Alegre PLAC: `POA-E-07` (Municipal Solar), `POA-E-06` (Building Regulation)
- Solar benchmark: 1,405 kWh/kWp/year, R$4,500/kWp CAPEX
- Grid emission factor: 0.183 tCO2/MWh
