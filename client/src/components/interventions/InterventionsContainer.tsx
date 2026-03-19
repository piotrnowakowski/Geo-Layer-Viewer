import { useState, useEffect, useMemo } from "react";
import L from "leaflet";
import InterventionDashboard from "./InterventionDashboard";
import MunicipalSolarPanel from "./MunicipalSolarPanel";
import SolarRegulationPanel from "./SolarRegulationPanel";
import {
  generateMunicipalBuildings,
  generateNeighborhoods,
  generateCommercialBuildings,
  generateResidentialBuildings,
  MunicipalBuilding,
  Neighborhood,
  CommercialBuilding,
  ResidentialBuilding,
} from "@/data/intervention-data";

type InterventionView = "dashboard" | "municipal" | "regulation";

interface InterventionsContainerProps {
  map: L.Map | null;
}

export default function InterventionsContainer({ map }: InterventionsContainerProps) {
  const [currentView, setCurrentView] = useState<InterventionView>("dashboard");
  const [selectedMunicipalBuilding, setSelectedMunicipalBuilding] = useState<MunicipalBuilding | null>(null);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<Neighborhood | null>(null);

  // Generate mock data on mount
  const { municipalBuildings, neighborhoods, commercialBuildings, residentialBuildings } = useMemo(() => {
    const nbhs = generateNeighborhoods();
    const comBuildings = generateCommercialBuildings(nbhs);
    const resBuildings = generateResidentialBuildings(nbhs);
    const munBuildings = generateMunicipalBuildings();

    return {
      municipalities: munBuildings,
      neighborhoods: nbhs,
      commercialBuildings: comBuildings,
      residentialBuildings: resBuildings,
      municipalBuildings: munBuildings,
    };
  }, []);

  // Handle municipal building selection and map visualization
  useEffect(() => {
    if (!map) return;

    // Clear previous markers
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker && (layer as any).isInterventionMarker) {
        map.removeLayer(layer);
      }
    });

    // Add municipal building markers if we're on municipal view
    if (currentView === "municipal") {
      municipalBuildings.forEach((building) => {
        const tierColors: Record<string, string> = {
          high: "#0369a1",
          medium: "#ca8a04",
          low: "#6b7280",
        };

        const marker = L.circleMarker([building.lat, building.lng], {
          radius: 5,
          fillColor: tierColors[building.priorityTier],
          color: tierColors[building.priorityTier],
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
        } as any);

        (marker as any).isInterventionMarker = true;
        marker.bindPopup(`<div class="text-xs"><strong>${building.name}</strong><br/>${building.neighborhood}</div>`);
        marker.addTo(map);

        marker.on("click", () => {
          setSelectedMunicipalBuilding(building);
        });
      });
    }

    // Add neighborhood and building markers if we're on regulation view
    if (currentView === "regulation") {
      // Add commercial building markers
      commercialBuildings.forEach((building) => {
        const marker = L.circleMarker([building.lat, building.lng], {
          radius: 4,
          fillColor: "#059669",
          color: "#059669",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.7,
        } as any);

        (marker as any).isInterventionMarker = true;
        marker.bindPopup("<div class='text-xs'>Commercial Building</div>");
        marker.addTo(map);
      });

      // Add residential building markers (grayed out)
      residentialBuildings.forEach((building) => {
        const marker = L.circleMarker([building.lat, building.lng], {
          radius: 3,
          fillColor: "#9ca3af",
          color: "#9ca3af",
          weight: 1,
          opacity: 0.4,
          fillOpacity: 0.4,
        } as any);

        (marker as any).isInterventionMarker = true;
        marker.bindPopup("<div class='text-xs'>Residential (Not in scope)</div>");
        marker.addTo(map);
      });

      // Add neighborhood polygons
      neighborhoods.forEach((neighborhood) => {
        const tierColors: Record<string, string> = {
          high: "#dcfce7",
          medium: "#fef3c7",
          low: "#e5e7eb",
        };

        const polygon = L.polygon(neighborhood.bounds, {
          color: tierColors[neighborhood.tier],
          weight: 2,
          opacity: 0.3,
          fillColor: tierColors[neighborhood.tier],
          fillOpacity: 0.15,
        } as any);

        (polygon as any).isInterventionMarker = true;
        polygon.bindPopup(`<div class="text-xs"><strong>${neighborhood.name}</strong><br/>Tier: ${neighborhood.tier}</div>`);
        polygon.addTo(map);

        polygon.on("click", () => {
          setSelectedNeighborhood(neighborhood);
        });
      });
    }

    return () => {
      // Cleanup is handled by layer removal above
    };
  }, [currentView, municipalBuildings, neighborhoods, commercialBuildings, residentialBuildings, map]);

  return (
    <>
      {currentView === "dashboard" && (
        <div className="absolute inset-0 z-[1000]">
          <InterventionDashboard
            onSelectMunicipal={() => setCurrentView("municipal")}
            onSelectRegulation={() => setCurrentView("regulation")}
          />
        </div>
      )}

      <MunicipalSolarPanel
        open={currentView === "municipal"}
        onOpenChange={(open) => {
          if (!open) setCurrentView("dashboard");
        }}
        buildings={municipalBuildings}
        map={map}
        onBuildingSelect={setSelectedMunicipalBuilding}
      />

      <SolarRegulationPanel
        open={currentView === "regulation"}
        onOpenChange={(open) => {
          if (!open) setCurrentView("dashboard");
        }}
        neighborhoods={neighborhoods}
        commercialBuildings={commercialBuildings}
        residentialBuildings={residentialBuildings}
        map={map}
        onNeighborhoodSelect={setSelectedNeighborhood}
      />
    </>
  );
}
