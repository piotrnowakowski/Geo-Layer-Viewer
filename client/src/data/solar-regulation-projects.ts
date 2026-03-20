export type SolarRegulationProjectLink = {
  label: string;
  href: string;
};

export type SolarRegulationProjectReference = {
  id: string;
  title: string;
  category: string;
  status: string;
  timing: string;
  summary: string;
  relevance: string;
  highlights: string[];
  outputs?: string[];
  links: SolarRegulationProjectLink[];
};

export const SOLAR_REGULATION_PROJECT_REFERENCES: SolarRegulationProjectReference[] = [
  {
    id: "new-york-city-solar-abatement",
    title: "New York City, USA: Solar tax abatement plus roof compliance rule",
    category: "Fiscal incentive + building rule",
    status: "Active",
    timing: "Tax abatement available for systems placed in service from January 1, 2024 to January 1, 2035",
    summary:
      "New York City combines a property-tax abatement for rooftop solar with Local Laws 92 and 94, which require sustainable roofing zones on covered projects and allow solar as a compliance path.",
    relevance:
      "Useful precedent for pairing a fiscal incentive with a building-code signal instead of relying on a single instrument.",
    highlights: [
      "7.5% of installed cost per year for 4 years",
      "Applies across multiple property classes",
      "Solar can satisfy part of sustainable-roof compliance",
    ],
    outputs: [
      "30% total abatement over 4 years for eligible systems",
      "Abatement window now runs through January 1, 2035",
    ],
    links: [
      {
        label: "NYC solar tax abatement",
        href: "https://www.nyc.gov/site/finance/property/landlords-solar-roof.page",
      },
      {
        label: "NYC Local Laws 92 and 94",
        href: "https://www.nyc.gov/site/sustainablebuildings/codes/local-laws.page",
      },
    ],
  },
  {
    id: "tokyo-home-solar-mandate",
    title: "Tokyo, Japan: New-home rooftop solar mandate",
    category: "Building mandate",
    status: "Effective",
    timing: "Effective from April 2025 with 2030 delivery targets",
    summary:
      "Tokyo introduced a rooftop solar requirement for new homes supplied by major housing manufacturers as part of its metropolitan decarbonization program.",
    relevance:
      "Shows how a large city can push market adoption through mandatory rooftop deployment on new residential supply.",
    highlights: [
      "Applies to new homes from major housing manufacturers",
      "Mandatory policy started in April 2025",
      "Targets steady pipeline growth rather than one-off pilots",
    ],
    outputs: [
      "About 46,000 new construction projects covered each year",
      "About 1 million kW of solar expected by 2030",
      "About 430,000 tons of CO2 reduced per year",
    ],
    links: [
      {
        label: "Tokyo policy overview",
        href: "https://www.english.metro.tokyo.lg.jp/documents/d/english/rooftops-pdf-pdf",
      },
    ],
  },
  {
    id: "barcelona-municipal-solar",
    title: "Barcelona, Spain: Municipal solar rollout plus shared self-consumption",
    category: "Municipal rollout + capex support",
    status: "Scaling",
    timing: "2024 to 2027 expansion program",
    summary:
      "Barcelona is scaling solar across municipal roofs, expanding shared self-consumption, and backing private-building installations with direct support.",
    relevance:
      "Strong example of combining public-roof deployment, community benefit sharing, and private-building support in one city program.",
    highlights: [
      "Municipal rooftop pipeline is being expanded citywide",
      "Shared self-consumption tied to vulnerable households",
      "City reports support of up to 30% for private-building solar",
    ],
    outputs: [
      "Municipal installations planned to grow from 117 in 2023 to 384 in 2027",
      "Planned municipal capacity of 19,244 kWp",
      "Equivalent to the annual consumption of about 10,450 households",
      "Estimated annual savings of 8,660 tons of CO2",
    ],
    links: [
      {
        label: "Barcelona municipal solar expansion",
        href: "https://www.barcelona.cat/infobarcelona/en/tema/climate-emergency/barcelona-will-triple-its-municipal-solar-energy-generation-in-just-four-years_1422573.html",
      },
      {
        label: "Barcelona shared solar program",
        href: "https://www.barcelona.cat/infobarcelona/en/tema/climate-emergency/compartimenergiasolar_1458127.html",
      },
    ],
  },
  {
    id: "cape-town-cash-for-power",
    title: "Cape Town, South Africa: Cash for Power rooftop export program",
    category: "Grid export incentive",
    status: "Active",
    timing: "Feed-in since 2014; cash payouts expanded in 2022/23; official results published in 2024",
    summary:
      "Cape Town buys excess rooftop solar from small-scale generators and allows participants to receive cash once credits exceed the municipal account balance, subject to city rules.",
    relevance:
      "Good precedent for moving beyond installation incentives into a utility-facing revenue model for distributed solar.",
    highlights: [
      "Municipal buyback for excess rooftop generation",
      "Residential participation is a large share of the market",
      "Cash settlement improves the economics of small systems",
    ],
    outputs: [
      "More than 1,500 registered sellers by April 2024",
      "More than 60% of sellers were residential",
      "R30.8 million earned by sellers since the 2022/23 cash-for-power launch",
    ],
    links: [
      {
        label: "Cape Town seller application page",
        href: "https://www.capetown.gov.za/City-Connect/Apply/Municipal-services/Have-a-municipal-service-connected-or-disconnected/apply-to-sell-electricity-back-to-the-city",
      },
      {
        label: "Cape Town official city news",
        href: "https://resource.capetown.gov.za/documentcentre/Documents/Forms%2C%20notices%2C%20tariffs%20and%20lists/CityNews_68_South.pdf",
      },
    ],
  },
  {
    id: "singapore-solarnova",
    title: "Singapore: SolarNova public-rooftop deployment",
    category: "Public-sector rooftop rollout",
    status: "Active",
    timing: "Launched in 2014 with a national 2030 solar target",
    summary:
      "Singapore's SolarNova program aggregates public-sector rooftop demand, especially across HDB blocks, to accelerate installation at city scale.",
    relevance:
      "Useful benchmark for a government-led aggregation model that turns many smaller rooftops into a bankable deployment pipeline.",
    highlights: [
      "Centralized procurement across public assets",
      "Strong focus on public-housing rooftops",
      "Program aligned to a national deployment target",
    ],
    outputs: [
      "Around 5,300 HDB blocks fitted with solar by December 2025",
      "Singapore exceeded 2 GWp of installed solar in 2025",
      "At least 3 GWp targeted by 2030",
      "3 GWp is described as enough to power about 500,000 households for a year",
    ],
    links: [
      {
        label: "EMA media release",
        href: "https://www.ema.gov.sg/content/dam/corporate/news/media-releases/2026/03/20260302%20EMA%20Media%20Release%20-%20Singapore%20to%20Accelerate%20Solar%20Deployment%20to%20Meet%203%20GWp%20Solar%20Target%20by%202030.pdf",
      },
      {
        label: "EMA media factsheet",
        href: "https://www.ema.gov.sg/content/dam/corporate/news/media-releases/2026/20260302EMA-Media-Factsheet-Singapore-to-Accelerate-Solar-Deployment-to-Meet-3-GWp-Solar-Target-by-2030.pdf.coredownload.pdf",
      },
    ],
  },
];
