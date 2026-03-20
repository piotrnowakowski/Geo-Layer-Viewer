import { Card } from "@/components/ui/card";
import { Zap } from "lucide-react";

interface InterventionDashboardProps {
  onSelectMunicipal: () => void;
  onSelectRegulation: () => void;
}

export default function InterventionDashboard({
  onSelectMunicipal,
  onSelectRegulation,
}: InterventionDashboardProps) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-background to-background/80">
      <div className="max-w-4xl w-full">
        <h1 className="text-4xl font-bold text-white mb-2">
          Porto Alegre — Solar PV Interventions
        </h1>
        <p className="text-gray-400 mb-12">
          Select an intervention to begin assessment and planning
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Municipal Solar Portfolio */}
          <Card
            className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-105 border border-gray-700 bg-gradient-to-br from-gray-900 to-gray-800"
            onClick={onSelectMunicipal}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-blue-900/50 flex items-center justify-center">
                <Zap className="w-6 h-6 text-blue-400" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-900/30 text-blue-300">
                READY
              </span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">
              Municipal Solar Portfolio
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Select priority buildings for rooftop solar installation across municipal facilities
            </p>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Capacity</span>
                <span className="text-white font-semibold">37 MWp</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Buildings</span>
                <span className="text-white font-semibold">560 buildings</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Annual Savings</span>
                <span className="text-white font-semibold">R$41.6M/yr</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">CO2 Avoided</span>
                <span className="text-white font-semibold">6,759 tCO2e/yr</span>
              </div>
            </div>

            <button className="w-full mt-6 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors">
              Open Intervention →
            </button>
          </Card>

          {/* Building Solar Regulation */}
          <Card
            className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-105 border border-gray-700 bg-gradient-to-br from-gray-900 to-gray-800"
            onClick={onSelectRegulation}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-green-900/50 flex items-center justify-center">
                <Zap className="w-6 h-6 text-green-400" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-900/30 text-green-300">
                READY
              </span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">
              Building Solar Regulation
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Design IPTU Sustentável incentive for commercial buildings with geospatial assessment
            </p>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">2030 Target</span>
                <span className="text-white font-semibold">146.2 MWp</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Leverage Ratio</span>
                <span className="text-white font-semibold">1:110</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">CO2 Avoided</span>
                <span className="text-white font-semibold">26,702 tCO2e/yr</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Scope</span>
                <span className="text-white font-semibold">Commercial</span>
              </div>
            </div>

            <button className="w-full mt-6 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors">
              Open Intervention →
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}
