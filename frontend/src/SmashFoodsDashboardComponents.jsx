// ============================================================================
// SMASH FOODS DASHBOARD COMPONENTS
// Add these components to App.jsx for displaying Smash Foods analysis
// File: SmashFoodsDashboardComponents.jsx
// ============================================================================

import React from 'react';
import { TrendingDown, TrendingUp, Clock, Package, DollarSign, MapPin } from 'lucide-react';

/**
 * Main Smash Foods Dashboard Component
 * Displays complete analysis when metadata.dataFormat === 'smash_foods_actual'
 */
export const SmashFoodsDashboard = ({ data }) => {
  const metadata = data.metadata || {};
  const isSmashFoods = metadata.dataFormat === 'smash_foods_actual';

  if (!isSmashFoods) {
    return null; // Fall back to standard dashboard
  }

  const currentCosts = metadata.currentCosts || {};
  const proposedCosts = metadata.proposedCosts?.combined || {};
  const savings = metadata.savings || {};
  const isSavings = savings.amount > 0;

  return (
    <div className="smash-foods-dashboard">
      {/* Key Metrics Section */}
      <SmashFoodsKeyMetrics data={data} metadata={metadata} />

      {/* Cost Comparison Section */}
      <SmashFoodsCostComparison
        currentCosts={currentCosts}
        proposedCosts={proposedCosts}
        savings={savings}
      />

      {/* Summary Table Section */}
      <SmashFoodsSummarySection metadata={metadata} />

      {/* Analysis Breakdown Section */}
      <SmashFoodsAnalysisSection
        proposedCosts={proposedCosts}
        totalCuft={metadata.totalCuft}
        totalPallets={metadata.totalPallets}
      />

      {/* Geographic Analysis */}
      <SmashFoodsGeographicAnalysis topStates={data.topStates || []} />

      {/* Recommendations */}
      <SmashFoodsRecommendations recommendations={metadata.recommendations || []} />
    </div>
  );
};

/**
 * Key Metrics Cards (Top of Dashboard)
 */
const SmashFoodsKeyMetrics = ({ data, metadata }) => {
  const savings = metadata.savings || {};
  const isSavings = savings.amount > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Shipments */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-gray-400 text-sm font-medium">Total Shipments</h3>
          <Package className="text-blue-400" size={20} />
        </div>
        <div className="text-3xl font-bold text-white">{data.totalShipments}</div>
        <div className="text-sm text-gray-400 mt-1">
          {metadata.totalUnits?.toLocaleString()} units
        </div>
      </div>

      {/* Total Pallets */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-gray-400 text-sm font-medium">Total Pallets</h3>
          <Package className="text-purple-400" size={20} />
        </div>
        <div className="text-3xl font-bold text-white">{metadata.totalPallets}</div>
        <div className="text-sm text-gray-400 mt-1">
          {metadata.totalCuft?.toFixed(2)} cuft
        </div>
      </div>

      {/* Savings/Additional Cost */}
      <div className={`p-6 rounded-lg ${isSavings ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-gray-400 text-sm font-medium">
            {isSavings ? 'Potential Savings' : 'Additional Cost'}
          </h3>
          {isSavings ? (
            <TrendingDown className="text-green-400" size={20} />
          ) : (
            <TrendingUp className="text-red-400" size={20} />
          )}
        </div>
        <div className={`text-3xl font-bold ${isSavings ? 'text-green-400' : 'text-red-400'}`}>
          ${Math.abs(savings.amount || 0).toLocaleString()}
        </div>
        <div className={`text-sm mt-1 ${isSavings ? 'text-green-300' : 'text-red-300'}`}>
          {Math.abs(savings.percent || 0).toFixed(1)}% {isSavings ? 'savings' : 'increase'}
        </div>
      </div>

      {/* Transit Time */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-gray-400 text-sm font-medium">Transit Time</h3>
          <Clock className="text-orange-400" size={20} />
        </div>
        <div className="text-3xl font-bold text-white">
          {metadata.avgTransitTime} → {metadata.amzPrepTransitTime} days
        </div>
        <div className="text-sm text-green-400 mt-1">
          -{metadata.transitImprovement} days faster
        </div>
      </div>
    </div>
  );
};

/**
 * Cost Comparison Section
 */
const SmashFoodsCostComparison = ({ currentCosts, proposedCosts, savings }) => {
  const isSavings = savings.amount > 0;

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <h2 className="text-xl font-bold text-white mb-4">Cost Comparison Analysis</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Provider */}
        <div className="bg-gray-700/50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-3">Current Provider</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Freight:</span>
              <span className="text-white font-medium">
                ${currentCosts.totalFreight?.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Placement Fees:</span>
              <span className="text-white font-medium">
                ${currentCosts.totalPlacementFees?.toLocaleString()}
              </span>
            </div>
            <div className="border-t border-gray-600 pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-white font-semibold">Total:</span>
                <span className="text-xl font-bold text-white">
                  ${currentCosts.totalCost?.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* AMZ Prep */}
        <div className="bg-blue-900/30 p-4 rounded-lg border border-blue-500/30">
          <h3 className="text-lg font-semibold text-white mb-3">AMZ Prep Solution</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Pattern (DC→FBA):</span>
              <span className="text-white font-medium">
                ${proposedCosts.patternCost?.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Internal (Whse→DC):</span>
              <span className="text-white font-medium">
                ${proposedCosts.internalCost?.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm text-green-400">
              <span>After 9.86% discount:</span>
              <span className="font-medium">
                ${proposedCosts.amzPrepCost?.toLocaleString()}
              </span>
            </div>
            <div className="border-t border-blue-500/30 pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-white font-semibold">Total:</span>
                <span className="text-xl font-bold text-blue-400">
                  ${proposedCosts.totalCost?.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Difference */}
        <div className={`p-4 rounded-lg ${isSavings ? 'bg-green-900/30 border border-green-500/30' : 'bg-red-900/30 border border-red-500/30'}`}>
          <h3 className="text-lg font-semibold text-white mb-3">
            {isSavings ? 'Your Savings' : 'Additional Cost'}
          </h3>
          <div className="flex flex-col items-center justify-center h-32">
            <div className={`text-4xl font-bold ${isSavings ? 'text-green-400' : 'text-red-400'}`}>
              ${Math.abs(savings.amount || 0).toLocaleString()}
            </div>
            <div className={`text-2xl font-semibold mt-2 ${isSavings ? 'text-green-300' : 'text-red-300'}`}>
              {Math.abs(savings.percent || 0).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-400 mt-2">
              {isSavings ? 'Potential savings' : 'vs current provider'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Summary Section (mirrors Summary Pallet tab)
 */
const SmashFoodsSummarySection = ({ metadata }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <h2 className="text-xl font-bold text-white mb-4">Summary Metrics</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-700/50 p-4 rounded">
          <div className="text-sm text-gray-400 mb-1">Cost per Cuft</div>
          <div className="text-2xl font-bold text-white">
            ${metadata.currentCosts?.costPerCuft?.toFixed(2)}
          </div>
          <div className="text-xs text-green-400 mt-1">
            → ${metadata.proposedCosts?.combined?.costPerCuft?.toFixed(2)} AMZ Prep
          </div>
        </div>

        <div className="bg-gray-700/50 p-4 rounded">
          <div className="text-sm text-gray-400 mb-1">Cost per Unit</div>
          <div className="text-2xl font-bold text-white">
            ${metadata.currentCosts?.costPerUnit?.toFixed(2)}
          </div>
          <div className="text-xs text-green-400 mt-1">
            → ${metadata.proposedCosts?.combined?.costPerUnit?.toFixed(2)} AMZ Prep
          </div>
        </div>

        <div className="bg-gray-700/50 p-4 rounded">
          <div className="text-sm text-gray-400 mb-1">Cost per Pallet</div>
          <div className="text-2xl font-bold text-white">
            ${metadata.currentCosts?.costPerPallet?.toFixed(2)}
          </div>
          <div className="text-xs text-green-400 mt-1">
            → ${metadata.proposedCosts?.combined?.costPerPallet?.toFixed(2)} AMZ Prep
          </div>
        </div>

        <div className="bg-gray-700/50 p-4 rounded">
          <div className="text-sm text-gray-400 mb-1">Split Shipment Rate</div>
          <div className="text-2xl font-bold text-orange-400">
            {metadata.splitShipmentRate}%
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {metadata.splitShipments} of {metadata.totalShipments} shipments
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Analysis Breakdown (mirrors Analysis Pallet tab formulas)
 */
const SmashFoodsAnalysisSection = ({ proposedCosts, totalCuft, totalPallets }) => {
  const breakdown = proposedCosts.breakdown || [];

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <h2 className="text-xl font-bold text-white mb-4">
        AMZ Prep Cost Breakdown
      </h2>

      <div className="space-y-3">
        {breakdown.map((item, index) => (
          <div key={index} className="bg-gray-700/50 p-4 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="text-white font-semibold">{item.type}</h4>
                <p className="text-sm text-gray-400">{item.description}</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-blue-400">
                  ${item.cost?.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
        <div className="text-sm text-gray-300 space-y-1">
          <p><strong>Pallet Analysis:</strong></p>
          <p>• Pattern Rate: $2.625/cuft ({totalCuft?.toFixed(2)} cuft)</p>
          <p>• Internal Rate: $1.0138/cuft</p>
          <p>• Discount Applied: 9.86% operational efficiency</p>
        </div>
      </div>
    </div>
  );
};

/**
 * Geographic Analysis
 */
const SmashFoodsGeographicAnalysis = ({ topStates }) => {
  if (!topStates || topStates.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <h2 className="text-xl font-bold text-white mb-4">Geographic Distribution</h2>

      <div className="space-y-3">
        {topStates.slice(0, 5).map((state, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-gray-700/50 rounded">
            <div className="flex items-center space-x-3">
              <MapPin className="text-blue-400" size={20} />
              <div>
                <div className="text-white font-medium">{state.name}</div>
                <div className="text-sm text-gray-400">
                  {state.volume} shipments
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-white font-semibold">{state.percentage}%</div>
              <div className="text-sm text-gray-400">
                Avg: ${state.avgCost?.toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Recommendations Section
 */
const SmashFoodsRecommendations = ({ recommendations }) => {
  if (!recommendations || recommendations.length === 0) return null;

  const getImpactColor = (impact) => {
    switch (impact) {
      case 'high': return 'text-red-400 bg-red-900/20';
      case 'medium': return 'text-yellow-400 bg-yellow-900/20';
      case 'low': return 'text-green-400 bg-green-900/20';
      default: return 'text-gray-400 bg-gray-700/50';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <h2 className="text-xl font-bold text-white mb-4">Key Recommendations</h2>

      <div className="space-y-4">
        {recommendations.map((rec, index) => (
          <div key={index} className="bg-gray-700/50 p-4 rounded-lg">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-white font-semibold">{rec.title}</h3>
              <span className={`px-2 py-1 rounded text-xs font-medium ${getImpactColor(rec.impact)}`}>
                {rec.impact.toUpperCase()} IMPACT
              </span>
            </div>
            <p className="text-gray-300 text-sm mb-2">{rec.description}</p>
            {rec.savings && (
              <div className="text-sm text-green-400">
                Potential savings: ${rec.savings.toLocaleString()}
              </div>
            )}
            {rec.improvement && (
              <div className="text-sm text-blue-400">
                Improvement: {rec.improvement} days faster
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
