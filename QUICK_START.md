# Solar PV Interventions — Quick Start Guide

## Access the Module

Click the **"Interventions"** button in the header (top right of the map) to open the dashboard.

## Intervention 1: Municipal Solar Portfolio

### What It Does
Helps you prioritize 560 municipal buildings (schools + facilities) for rooftop solar installation.

### How to Use

1. **Open the intervention** from the dashboard
2. **Select a priority tier:**
   - **High Priority** — Top 20% of buildings (best score)
   - **Medium** — Next 40% (moderate potential)
   - **Low** — Remaining 40% (include for full coverage)
3. **View summary metrics** (top of panel):
   - Total Capacity (MWp)
   - Total Investment (R$ millions)
   - Annual Savings (R$/year)
   - CO2 Avoided (tCO2e/year)
4. **Explore buildings:**
   - Scroll the building list
   - Click a building name to see details
   - Building appears on map (map zooms to it)
5. **Review building details:**
   - Score (0–100, color-coded)
   - Roof area (m²)
   - Capacity (kWp) and generation (MWh/year)
   - Annual savings (R$) and payback period (years)
   - CO2 avoided (tCO2e/year)
   - Solar GHI (kWh/m²/year)
   - Flood risk (Low/Moderate/High)
6. **Confirm selection:**
   - Click "Select this scope" button
   - Toast shows: "High Priority scope selected — 112 buildings, 7.4 MWp"

### Building Score Interpretation
- **Green badge (>70):** Excellent (largest buildings, best solar, low flood risk)
- **Yellow badge (50–70):** Good (moderate potential)
- **Red badge (<50):** Lower potential (include for coverage)

### Map Markers
- **Blue circles** = High priority buildings
- **Amber circles** = Medium priority buildings
- **Gray circles** = Low priority buildings

---

## Intervention 2: Building Solar Regulation

### What It Does
Helps you design an IPTU Sustentável (property tax discount) program for commercial buildings. Analyzes neighborhoods to find the best trade-off between solar energy potential and IPTU revenue forfeiture.

### How to Use

1. **Open the intervention** from the dashboard
2. **Click "IPTU Sustentável"** (other policy instruments are "Coming soon")
3. **Three tabs appear:**

### Tab 1: Geospatial Assessment

**Select a neighborhood:**
1. Scroll the neighborhood list
2. Look for tier badges: 🟢 **High** (green), 🟡 **Medium** (amber), ⚪ **Low** (gray)
3. Click a neighborhood
4. Map zooms to show neighborhood boundaries

**Review neighborhood metrics:**
- Name and tier badge
- Commercial building count
- Total solar potential (kWp)
- Current annual IPTU revenue (R$/year)

**Compare scenarios:**
- **Scenario A — 5% IPTU Discount:**
  - Revenue lost per year
  - Estimated PV installed (kWp)
  - Annual energy generation (MWh/year)
  - CO2 avoided (tCO2e/year)
  
- **Scenario B — 10% IPTU Discount:**
  - Revenue lost per year
  - Estimated PV installed (kWp) — higher than 5%
  - Annual energy generation (MWh/year)
  - CO2 avoided (tCO2e/year)

**Map visualization:**
- Neighborhoods shown as colored polygons (tier-based)
- Green markers = Commercial buildings (clickable)
- Gray faded markers = Residential buildings (for context only)

### Tab 2: Similar Projects

Browse reference projects from other Brazilian cities:

- **Salvador (IPTU Verde)** — 500+ commercial properties, adoption boosted by simplified permitting
- **Guarulhos (IPTU Verde)** — Larger buildings adopt 3× faster
- **Recife (IPTU Sustentável)** — Doubled adoption when paired with BNDES financing
- **Belo Horizonte (IPTU Verde)** — 60% reduction in application processing time

Click **"Learn more →"** to visit each city's website.

### Tab 3: Next Steps

**Critical action — Grid Capacity Assessment:**
1. Read the explanation of why grid validation is important
2. Suggested approach: contact CEEE Equatorial (local electricity distributor)
3. Key questions to ask about your priority neighborhood:
   - What's the current feeder capacity and loading?
   - How much headroom exists for reverse power flow from solar?
   - What are the interconnection requirements and timelines?
4. Click **"Download neighborhood list for distributor"** to generate a CSV file with:
   - Neighborhood name
   - Tier (High/Medium/Low)
   - Number of commercial buildings
   - Solar potential (kWp)
5. Email the CSV to CEEE Equatorial for technical assessment

**Pending data to collect:**
- Updated commercial building registry with roof measurements
- Current IPTU billing records by neighborhood
- Historical solar permit data
- Heritage/preservation zone boundaries
- Flood risk overlay

---

## Map Controls

### When Exploring Municipal Portfolio
- **Clicking a building marker** → Selects building, zooms map, shows details
- **Changing tabs** → Map updates to show buildings in selected tier (blue/amber/gray)
- **Closing the panel** → Returns to dashboard, map clears intervention markers

### When Exploring Building Regulation
- **Clicking a neighborhood** → Selects neighborhood, zooms to bounds, shows detail card
- **Clicking a commercial building marker** → Highlights the building (green)
- **Clicking a residential building marker** → Shows "Not in scope" message (gray)
- **Closing the panel** → Returns to dashboard, map clears intervention markers

---

## Tips & Tricks

### Municipal Portfolio
- **Sort by tier:** Each tab shows buildings in that tier (already sorted by score)
- **Quick assessment:** Read the summary cards at the top for aggregate metrics
- **Drill down:** Click individual buildings to validate details before committing
- **Payback period:** Most buildings show 3–6 year payback (favorable for municipal budget)

### Building Regulation
- **Compare scenarios:** 5% vs 10% discount side-by-side to see adoption elasticity
- **Best neighborhoods:** Start with "High Potential" tier (green) → highest solar, lowest revenue forfeiture
- **Reference learning:** Study similar projects to anticipate common challenges
- **Distributor engagement:** Download the CSV early and schedule assessment meeting

### General
- **Dark theme:** Eyes adjusted for night viewing; contrast is high
- **Colors matter:** Green/amber/gray consistently indicate tier across both interventions
- **Responsive design:** Works on mobile (full-width panels) and desktop (side sheets)

---

## Keyboard Shortcuts

- **Escape** — Close current panel, return to dashboard
- **Tab** — Navigate between interactive elements (buildings, neighborhoods, buttons)
- **Enter** — Select highlighted element

---

## Glossary

| Term | Definition |
|------|-----------|
| **MWp** | Megawatt peak capacity (1 MWp = 1,000 kWp) |
| **kWp** | Kilowatt peak (rated solar capacity) |
| **MWh** | Megawatt-hour (annual energy production) |
| **GHI** | Global Horizontal Irradiance (kWh/m²/year) |
| **CAPEX** | Capital expenditure (upfront installation cost) |
| **Payback** | Years to recover investment from energy savings |
| **CO2 avoided** | Metric tons of CO2 equivalent not emitted vs grid electricity |
| **IPTU** | Imposto Predial Territorial Urbano (property tax) |
| **Sustentável** | Sustainable (discount for green building features) |
| **Feeder** | Power line segment from substation to distribution area |
| **Reverse flow** | Electricity flowing from distributed solar back to grid |

---

## Troubleshooting

**Dashboard not opening?**
- Click "Interventions" button in header again
- Try refreshing the page if it doesn't respond

**Map not showing markers?**
- Ensure panel is fully open on the right
- Try clicking a building/neighborhood name to refresh
- Map updates when you select items

**Building/neighborhood details not showing?**
- Click the feature again (single click should select, highlight the card)
- Scroll down in the panel to see detail card below the list

**Download not working?**
- Select a neighborhood first (in Building Regulation Tab 1)
- The "Download" button will be enabled once a neighborhood is selected
- Check your Downloads folder for CSV file

---

## Next Steps After Assessment

### Municipal Portfolio
1. Share "High Priority scope" list with city procurement
2. Get quotes from solar installers for selected buildings
3. Develop financing plan (BNDES, municipal bonds, PPP)
4. Start with pilot program (5–10 buildings)

### Building Regulation
1. Schedule meeting with CEEE Equatorial (include CSV from Tab 3)
2. Request grid capacity assessment report
3. Stakeholder engagement: chamber of commerce, developers
4. Draft IPTU Sustentável ordinance based on learnings from similar cities
5. Pilot program: offer discount to early-adopter commercial buildings

---

**Questions?** See `INTERVENTIONS_README.md` for detailed feature documentation.
