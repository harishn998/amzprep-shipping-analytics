// ============================================================================
// AMZ PREP INBOUND SPEED SCORECARD - REVAMPED VERSION
// Implements all requested changes from team feedback:
// - Letter grades (A-F) instead of just numeric scores
// - Prominent INBOUND SPEED display at the top
// - Data-driven Key Insights section
// - Professional tone (no excessive FOMO)
// - Subtitle: "Grading your inbound speed and cost performance"
// - Removed rate lock countdown
// File: ShippingScorecard.jsx
// ============================================================================

import React, { useState } from 'react';
import {
  TrendingDown,
  Clock,
  Package,
  DollarSign,
  ExternalLink,
  Lock,
  Truck,
  MapPin,
  BarChart3,
  Zap,
  AlertTriangle,
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import amzprepLogo from './assets/amzprep_white_logo.png';

// Sales Rep Images
import richImage from './assets/Rich-Pearl.png';
import angeloImage from './assets/Angelo.png';

// ============================================================================
// BRAND CONSTANTS
// ============================================================================
const BRAND_BLUE = '#00A8FF';
const BRAND_BLUE_RGB = '0, 168, 255';

// ============================================================================
// SCORING THRESHOLDS & LETTER GRADES
// ============================================================================
const GRADE_THRESHOLDS = {
  A: { min: 85, color: '#10b981', label: 'Excellent', bgColor: 'rgba(16, 185, 129, 0.15)' },
  B: { min: 70, color: '#22d3ee', label: 'Good', bgColor: 'rgba(34, 211, 238, 0.15)' },
  C: { min: 55, color: '#fbbf24', label: 'Average', bgColor: 'rgba(251, 191, 36, 0.15)' },
  D: { min: 40, color: '#f97316', label: 'Below Average', bgColor: 'rgba(249, 115, 22, 0.15)' },
  E: { min: 25, color: '#ef4444', label: 'Poor', bgColor: 'rgba(239, 68, 68, 0.15)' },
  F: { min: 0, color: '#dc2626', label: 'Critical', bgColor: 'rgba(220, 38, 38, 0.15)' }
};

// Speed thresholds (days)
const SPEED_THRESHOLDS = {
  excellent: 5,    // <= 5 days = A
  good: 7,         // <= 7 days = B
  average: 10,     // <= 10 days = C
  belowAverage: 15, // <= 15 days = D
  poor: 20,        // <= 20 days = E
  critical: 21     // > 20 days = F (WORST)
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export const ShippingScorecard = ({ data, metadata = {}, isAdmin = false }) => {
  const scorecardData = calculateScorecardMetrics(data, metadata);

  return (
    <div className="shipping-scorecard space-y-6 font-['Poppins']">
      {/* Header Section - Score + Inbound Speed Prominently */}
      <ScorecardHeader scorecardData={scorecardData} />

      {/* Inbound Speed Hero Bar - MOST IMPORTANT */}
      <InboundSpeedHero metrics={scorecardData.speedMetrics} />

      {/* Key Insights Section - Data Driven (MOVED UP per feedback) */}
      <KeyInsightsSection
        metrics={scorecardData.keyMetrics}
        shipMethodData={scorecardData.shipMethodData}
      />

      {/* Two Column Layout: Performance Grades + Industry Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Performance Grades */}
        <PerformanceGrades breakdown={scorecardData.breakdown} />

        {/* Right Column: Industry Comparison */}
        <IndustryComparison comparison={scorecardData.comparison} />
      </div>

      {/* CTA Section */}
      <CTASection
        totalSavings={scorecardData.keyMetrics.totalAnnualOpportunity}
        placementFeeSavings={scorecardData.keyMetrics.placementFees}
        isAdmin={isAdmin}
      />

      {/* Full Analysis Section - Initially Hidden (Admin Only) */}
      {isAdmin && (
        <div id="detailed-analysis" className="hidden">
          <DetailedAnalysisSection data={data} metadata={metadata} />
        </div>
      )}
    </div>
  );
};

// ============================================================================
// CALCULATE SCORECARD METRICS
// ============================================================================
const calculateScorecardMetrics = (data, metadata) => {
  console.log('🎯 Calculating scorecard from analysis data...');

  // Extract data from metadata (backend structure)
  const currentCosts = metadata?.currentCosts || {};
  const proposedCosts = metadata?.proposedCosts?.sop || metadata?.proposedCosts || {};
  const savings = metadata?.savings || {};
  const transitImprovement = metadata?.transitImprovement || {};

  // Core metrics
  const currentTransitTime = Math.round(
    transitImprovement.currentTransitDays ||
    metadata?.avgTransitTime ||
    16
  );
  const amzPrepTransitTime = transitImprovement.amzPrepTransitDays || 3;

  // Volume metrics
  const totalShipments = data?.totalShipments || metadata?.totalShipments || 0;
  const totalUnits = metadata?.totalUnits || 0;
  const totalCuft = metadata?.totalCuft || 0;
  const totalPallets = metadata?.totalPallets || Math.round(totalCuft / 67);

  // Cost metrics
  const totalPlacementFees = currentCosts.totalPlacementFees || 0;
  const totalFreightCost = currentCosts.totalCost || currentCosts.totalFreight || 0;
  const clientCarrierCost = currentCosts.totalFreight || 0;

  // AMZ Prep costs
  const mmCost = proposedCosts.mmCost || 0;
  const internalTransfer = proposedCosts.internalTransferCost || proposedCosts.internalTransfer || 0;
  const totalAMZPrepCost = proposedCosts.totalFreightCost || proposedCosts.totalCost || 0;

  // Savings calculations
  const savingsAmount = savings.amount || (totalFreightCost - totalAMZPrepCost);
  const savingsPercent = savings.percent || (totalFreightCost > 0 ? (savingsAmount / totalFreightCost) * 100 : 0);

  // Ship method breakdown
  const shipMethodBreakdown = metadata?.shipMethodBreakdown || [];
  const spdCount = shipMethodBreakdown.find(m => m.method === 'SPD')?.shipmentCount || 0;
  const tlCount = shipMethodBreakdown.find(m => m.method === 'TL')?.shipmentCount || 0;
  const ltlCount = shipMethodBreakdown.find(m => m.method === 'LTL')?.shipmentCount || 0;

  // From Zip data for facility count
  const fromZipBreakdown = metadata?.fromZipBreakdown || [];
  const uniqueDestinations = new Set();
  if (data?.topStates) {
    data.topStates.forEach(s => uniqueDestinations.add(s.code));
  }
  const amazonFacilityCount = uniqueDestinations.size || fromZipBreakdown.length || 0;

  // ============================================================================
  // SCORING CALCULATIONS
  // ============================================================================

  // SPEED SCORE (40 points max) - Based on transit time
  let speedScore = 40;
  let speedGrade = 'A';
  if (currentTransitTime > 20) {
    speedScore = 5;
    speedGrade = 'F';
  } else if (currentTransitTime > 15) {
    speedScore = 10;
    speedGrade = 'E';
  } else if (currentTransitTime > 10) {
    speedScore = 18;
    speedGrade = 'D';
  } else if (currentTransitTime > 7) {
    speedScore = 25;
    speedGrade = 'C';
  } else if (currentTransitTime > 5) {
    speedScore = 32;
    speedGrade = 'B';
  }

  // COST SCORE (35 points max) - Based on placement fees & waste
  let costScore = 35;
  let costGrade = 'A';
  const placementFeeRatio = totalFreightCost > 0 ? (totalPlacementFees / totalFreightCost) : 0;

  if (totalPlacementFees > 0 && placementFeeRatio > 0.5) {
    // WORST: More than 50% of cost is placement fees
    costScore = 5;
    costGrade = 'F';
  } else if (totalPlacementFees > 0 && placementFeeRatio > 0.3) {
    costScore = 12;
    costGrade = 'E';
  } else if (totalPlacementFees > 0 && placementFeeRatio > 0.15) {
    costScore = 18;
    costGrade = 'D';
  } else if (totalPlacementFees > 0) {
    costScore = 25;
    costGrade = 'C';
  } else if (savingsPercent > 20) {
    costScore = 28;
    costGrade = 'B';
  }

  // GEO SCORE (25 points max) - Based on distribution strategy
  let geoScore = 25;
  let geoGrade = 'A';
  const splitShipmentRate = data?.splitShipmentRate || 0;

  if (splitShipmentRate > 40) {
    geoScore = 8;
    geoGrade = 'E';
  } else if (splitShipmentRate > 30) {
    geoScore = 12;
    geoGrade = 'D';
  } else if (splitShipmentRate > 20) {
    geoScore = 16;
    geoGrade = 'C';
  } else if (splitShipmentRate > 10) {
    geoScore = 20;
    geoGrade = 'B';
  }

  // TOTAL SCORE & OVERALL GRADE
  const totalScore = speedScore + costScore + geoScore;
  const overallGrade = getLetterGrade(totalScore);
  const gradeInfo = GRADE_THRESHOLDS[overallGrade];

  // Determine status message (professional tone, not excessive FOMO)
  let statusMessage = '';
  if (overallGrade === 'F') {
    statusMessage = 'Significant optimization needed';
  } else if (overallGrade === 'E') {
    statusMessage = 'Multiple areas need attention';
  } else if (overallGrade === 'D') {
    statusMessage = 'Room for improvement';
  } else if (overallGrade === 'C') {
    statusMessage = 'Meeting industry average';
  } else if (overallGrade === 'B') {
    statusMessage = 'Performing well';
  } else {
    statusMessage = 'Excellent performance';
  }

  return {
    totalScore,
    overallGrade,
    gradeInfo,
    statusMessage,

    speedMetrics: {
      currentDays: currentTransitTime,
      amzPrepDays: amzPrepTransitTime,
      improvement: Math.max(0, currentTransitTime - amzPrepTransitTime),
      improvementPercent: currentTransitTime > 0
        ? Math.round(((currentTransitTime - amzPrepTransitTime) / currentTransitTime) * 100)
        : 0,
      grade: speedGrade
    },

    breakdown: {
      speed: {
        score: speedScore,
        max: 40,
        grade: speedGrade,
        gradeInfo: GRADE_THRESHOLDS[speedGrade],
        message: getSpeedMessage(currentTransitTime, amzPrepTransitTime)
      },
      cost: {
        score: costScore,
        max: 35,
        grade: costGrade,
        gradeInfo: GRADE_THRESHOLDS[costGrade],
        message: getCostMessage(totalPlacementFees, savingsAmount, placementFeeRatio)
      },
      geo: {
        score: geoScore,
        max: 25,
        grade: geoGrade,
        gradeInfo: GRADE_THRESHOLDS[geoGrade],
        message: getGeoMessage(splitShipmentRate, amazonFacilityCount)
      }
    },

    comparison: {
      current: totalScore,
      currentGrade: overallGrade,
      industryAverage: 55,
      industryGrade: 'C',
      topPerformers: 90,
      topGrade: 'A'
    },

    keyMetrics: {
      totalUnits,
      totalCuft: Math.round(totalCuft),
      totalPallets: Math.round(totalPallets * 100) / 100,
      totalShipments,
      placementFees: Math.round(totalPlacementFees),
      clientCarrierCost: Math.round(clientCarrierCost),
      totalFreightCost: Math.round(totalFreightCost),
      mmCost: Math.round(mmCost),
      internalTransfer: Math.round(internalTransfer),
      totalAMZPrepCost: Math.round(totalAMZPrepCost),
      savingsAmount: Math.round(savingsAmount),
      savingsPercent: Math.round(savingsPercent * 10) / 10,
      amazonFacilityCount,
      totalAnnualOpportunity: Math.round(savingsAmount + totalPlacementFees)
    },

    shipMethodData: {
      spd: { count: spdCount, percent: totalShipments > 0 ? Math.round((spdCount / totalShipments) * 100) : 0 },
      tl: { count: tlCount, percent: totalShipments > 0 ? Math.round((tlCount / totalShipments) * 100) : 0 },
      ltl: { count: ltlCount, percent: totalShipments > 0 ? Math.round((ltlCount / totalShipments) * 100) : 0 }
    }
  };
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const getLetterGrade = (score) => {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  if (score >= 25) return 'E';
  return 'F';
};

const getSpeedMessage = (current, target) => {
  const diff = current - target;
  if (current > 20) {
    return `${current} days transit time is significantly slower than optimal. AMZ Prep delivers in ${target} days.`;
  } else if (current > 10) {
    return `${current} days transit puts inventory at risk. AMZ Prep can reduce this to ${target} days.`;
  } else if (current > 5) {
    return `${current} days is acceptable, but ${target} days with AMZ Prep improves cash flow.`;
  }
  return `${current} days transit time is competitive.`;
};

const getCostMessage = (placementFees, savings, ratio) => {
  if (placementFees > 0 && ratio > 0.5) {
    return `Placement fees are ${Math.round(ratio * 100)}% of total cost. AMZ Prep eliminates these entirely.`;
  } else if (placementFees > 0) {
    return `$${placementFees.toLocaleString()} in placement fees can be eliminated with AMZ Prep.`;
  } else if (savings > 5000) {
    return `$${Math.round(savings).toLocaleString()} in optimization opportunities identified.`;
  }
  return 'Cost structure is reasonably efficient.';
};

const getGeoMessage = (splitRate, facilityCount) => {
  if (splitRate > 30) {
    return `${splitRate}% split shipment rate is driving up costs. Strategic positioning can help.`;
  } else if (facilityCount > 10) {
    return `Shipping to ${facilityCount} Amazon facilities. Central positioning could reduce complexity.`;
  }
  return 'Geographic distribution strategy is working well.';
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
};

const formatNumber = (num) => {
  return new Intl.NumberFormat('en-US').format(Math.round(num || 0));
};

// ============================================================================
// SCORECARD HEADER COMPONENT
// ============================================================================
const ScorecardHeader = ({ scorecardData }) => {
  const { totalScore, overallGrade, gradeInfo, statusMessage } = scorecardData;

  return (
    <div
      className="relative rounded-2xl border border-gray-700/50 p-6 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0a0f1a 0%, #111827 100%)',
        borderColor: `${gradeInfo.color}30`
      }}
    >
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(${gradeInfo.color} 1px, transparent 1px)`,
            backgroundSize: '20px 20px'
          }}
        />
      </div>

      <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
        {/* Left: Grade Display */}
        <div className="flex items-center gap-6">
          {/* Large Letter Grade */}
          <div
            className="relative flex items-center justify-center w-28 h-28 rounded-2xl"
            style={{
              background: gradeInfo.bgColor,
              border: `2px solid ${gradeInfo.color}40`
            }}
          >
            <span
              className="text-6xl font-black"
              style={{ color: gradeInfo.color }}
            >
              {overallGrade}
            </span>
            {/* Small numeric score */}
            <span
              className="absolute -bottom-2 -right-2 bg-gray-900 px-2 py-0.5 rounded-lg text-xs font-bold border"
              style={{ borderColor: gradeInfo.color, color: gradeInfo.color }}
            >
              {totalScore}/100
            </span>
          </div>

          {/* Score Info */}
          <div>
            <h2
              className="text-2xl font-bold mb-1"
              style={{ color: gradeInfo.color }}
            >
              {gradeInfo.label}
            </h2>
            <p className="text-gray-400 text-sm">
              {statusMessage}
            </p>
          </div>
        </div>

        {/* Right: Logo & Title */}
        <div className="text-right">
          <img
            src={amzprepLogo}
            alt="AMZ Prep"
            className="h-9 w-auto ml-auto mb-3"
          />
          <h1 className="text-xl font-bold text-white mb-1">
            Inbound Speed Scorecard
          </h1>
          <p className="text-sm" style={{ color: BRAND_BLUE }}>
            Grading your inbound speed and cost performance
          </p>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// INBOUND SPEED HERO BAR - MOST IMPORTANT METRIC
// Updated: Added Dock-to-Dock clarification and range-based display
// ============================================================================
const InboundSpeedHero = ({ metrics }) => {
  const { currentDays, amzPrepDays, improvement, improvementPercent, grade } = metrics;
  const gradeInfo = GRADE_THRESHOLDS[grade];

  // AMZ Prep transit time range (2-5 days dock-to-dock)
  const amzPrepRangeMin = 2;
  const amzPrepRangeMax = 5;
  const amzPrepAverage = 4;

  return (
    <div
      className="rounded-xl p-5 border"
      style={{
        background: 'linear-gradient(90deg, rgba(0, 168, 255, 0.08) 0%, rgba(0, 168, 255, 0.02) 100%)',
        borderColor: `${BRAND_BLUE}30`
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5" style={{ color: BRAND_BLUE }} />
          <h3 className="text-lg font-bold text-white">Speed Into Amazon</h3>
          <span
            className="ml-2 px-2 py-0.5 rounded text-xs font-bold"
            style={{ backgroundColor: gradeInfo.bgColor, color: gradeInfo.color }}
          >
            Grade: {grade}
          </span>
        </div>
      </div>

      {/* Dock-to-Dock Clarification Badge */}
      <p className="text-xs text-gray-400 mb-4 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Transit time calculated on a <span className="text-white font-medium">dock-to-dock</span> basis
      </p>

      {/* Speed Comparison Bar */}
      <div className="relative">
        {/* Background track */}
        <div className="h-12 bg-gray-800/50 rounded-xl overflow-hidden relative">
          {/* Current speed indicator */}
          <div
            className="absolute left-0 top-0 h-full flex items-center justify-end pr-4 transition-all duration-1000"
            style={{
              width: `${Math.min((currentDays / 30) * 100, 100)}%`,
              background: `linear-gradient(90deg, ${gradeInfo.color}40 0%, ${gradeInfo.color}20 100%)`
            }}
          >
            <div className="text-right">
              <span className="text-2xl font-black text-white">{currentDays}</span>
              <span className="text-sm text-gray-400 ml-1">days</span>
            </div>
          </div>

          {/* AMZ Prep target zone (range indicator) */}
          <div
            className="absolute top-0 h-full z-10 opacity-30"
            style={{
              left: `${(amzPrepRangeMin / 30) * 100}%`,
              width: `${((amzPrepRangeMax - amzPrepRangeMin) / 30) * 100}%`,
              background: BRAND_BLUE
            }}
          />

          {/* AMZ Prep target line (average) */}
          <div
            className="absolute top-0 h-full w-0.5 z-10"
            style={{
              left: `${(amzPrepAverage / 30) * 100}%`,
              background: BRAND_BLUE
            }}
          >
            <div
              className="absolute -top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap"
              style={{ backgroundColor: BRAND_BLUE, color: 'white' }}
            >
              AMZ Prep: {amzPrepRangeMin}–{amzPrepRangeMax} days
            </div>
          </div>

          {/* Scale markers */}
          <div className="absolute bottom-1 left-0 right-0 flex justify-between px-4 text-[10px] text-gray-500">
            <span>0</span>
            <span>10</span>
            <span>20</span>
            <span>30+ days</span>
          </div>
        </div>

        {/* Improvement callout */}
        {improvement > 0 && (
          <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-gray-400">
              <span className="text-white font-medium">Faster inbound</span> = better cashflow = less storage fees = higher in-stock rate
            </p>
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: `${BRAND_BLUE}15` }}
            >
              <ArrowRight className="w-4 h-4" style={{ color: BRAND_BLUE }} />
              <span className="text-sm font-bold" style={{ color: BRAND_BLUE }}>
                ~{amzPrepAverage} days avg with AMZ Prep
              </span>
            </div>
          </div>
        )}

        {/* Dock-to-Dock Helper Text */}
        <p className="text-xs text-gray-500 mt-3 italic">
          * Actual transit time may vary between {amzPrepRangeMin}–{amzPrepRangeMax} days depending on origin and destination.
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// PERFORMANCE GRADES COMPONENT
// ============================================================================
const PerformanceGrades = ({ breakdown }) => {
  const metrics = [
    { key: 'speed', title: 'Speed Performance', icon: Clock, ...breakdown.speed },
    { key: 'cost', title: 'Cost Efficiency', icon: DollarSign, ...breakdown.cost },
    { key: 'geo', title: 'Geographic Strategy', icon: MapPin, ...breakdown.geo }
  ];

  return (
    <div className="bg-gray-900/50 rounded-xl border border-gray-700/50 p-5">
      <h3 className="text-lg font-bold text-white mb-4">Performance Breakdown</h3>

      <div className="space-y-4">
        {metrics.map(({ key, title, icon: Icon, score, max, grade, gradeInfo, message }) => (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-white">{title}</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="text-lg font-bold"
                  style={{ color: gradeInfo.color }}
                >
                  {grade}
                </span>
                <span className="text-xs text-gray-500">
                  {score}/{max}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(score / max) * 100}%`,
                  backgroundColor: gradeInfo.color
                }}
              />
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              {message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// INDUSTRY COMPARISON COMPONENT
// ============================================================================
const IndustryComparison = ({ comparison }) => {
  const positions = [
    {
      label: 'Your Score',
      score: comparison.current,
      grade: comparison.currentGrade,
      color: GRADE_THRESHOLDS[comparison.currentGrade].color,
      highlight: true
    },
    {
      label: 'Industry Average',
      score: comparison.industryAverage,
      grade: comparison.industryGrade,
      color: '#6b7280',
      highlight: false
    },
    {
      label: 'Top Performers',
      score: comparison.topPerformers,
      grade: comparison.topGrade,
      color: BRAND_BLUE,
      highlight: false
    }
  ];

  return (
    <div className="bg-gray-900/50 rounded-xl border border-gray-700/50 p-5">
      <h3 className="text-lg font-bold text-white mb-4">Where You Stand</h3>

      <div className="space-y-4">
        {positions.map(({ label, score, grade, color, highlight }) => (
          <div
            key={label}
            className={`p-3 rounded-lg ${highlight ? 'border' : ''}`}
            style={{
              backgroundColor: highlight ? `${color}10` : 'transparent',
              borderColor: highlight ? `${color}40` : 'transparent'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm ${highlight ? 'text-white font-medium' : 'text-gray-400'}`}>
                {label}
              </span>
              <div className="flex items-center gap-2">
                <span
                  className="text-xl font-bold"
                  style={{ color }}
                >
                  {grade}
                </span>
                <span className="text-sm text-gray-500">
                  {score}/100
                </span>
              </div>
            </div>

            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${score}%`,
                  backgroundColor: color,
                  opacity: highlight ? 1 : 0.6
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Gap indicator */}
      <div className="mt-4 pt-4 border-t border-gray-700/50">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Gap to Top Performers</span>
          <span className="font-bold" style={{ color: BRAND_BLUE }}>
            {comparison.topPerformers - comparison.current} points
          </span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// KEY INSIGHTS SECTION - DATA DRIVEN
// ============================================================================
const KeyInsightsSection = ({ metrics, shipMethodData }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <BarChart3 className="w-5 h-5" style={{ color: BRAND_BLUE }} />
        Key Insights
      </h3>

      {/* Placement Fee Callout - If Applicable */}
      {metrics.placementFees > 0 && (
        <div
          className="p-4 rounded-xl border"
          style={{
            background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.02) 100%)',
            borderColor: 'rgba(239, 68, 68, 0.3)'
          }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-white font-semibold mb-1">Total Placement Fee Cost</h4>
              <p className="text-2xl font-bold text-red-400 mb-1">
                {formatCurrency(metrics.placementFees)}
              </p>
              <p className="text-sm text-gray-400">
                You'd save {formatCurrency(metrics.placementFees)} per year with AMZ Prep as we eliminate placement fees entirely
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon={Package}
          label="Total Items Shipped"
          value={formatNumber(metrics.totalUnits)}
          subtext={`${formatNumber(metrics.totalShipments)} shipments`}
        />
        <MetricCard
          icon={Truck}
          label="Cubic Footage"
          value={formatNumber(metrics.totalCuft)}
          subtext={`${metrics.totalPallets.toFixed(1)} pallets`}
        />
        <MetricCard
          icon={DollarSign}
          label="Total Freight Cost"
          value={formatCurrency(metrics.totalFreightCost)}
          subtext="Current spend"
        />
        <MetricCard
          icon={MapPin}
          label="Amazon Facilities"
          value={metrics.amazonFacilityCount || '-'}
          subtext="Destinations"
          highlight={metrics.amazonFacilityCount > 10}
        />
      </div>

      {/* Ship Method Breakdown */}
      {(shipMethodData.spd.count > 0 || shipMethodData.tl.count > 0) && (
        <div className="bg-gray-900/30 rounded-xl p-4 border border-gray-700/30">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Shipping Method Distribution</h4>
          <div className="flex items-center gap-6">
            {shipMethodData.spd.count > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-400" />
                <span className="text-sm text-white">
                  SPD: <span className="font-semibold">{shipMethodData.spd.percent}%</span>
                </span>
              </div>
            )}
            {shipMethodData.tl.count > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BRAND_BLUE }} />
                <span className="text-sm text-white">
                  TL: <span className="font-semibold">{shipMethodData.tl.percent}%</span>
                </span>
              </div>
            )}
            {shipMethodData.ltl.count > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-400" />
                <span className="text-sm text-white">
                  LTL: <span className="font-semibold">{shipMethodData.ltl.percent}%</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// METRIC CARD COMPONENT
// ============================================================================
const MetricCard = ({ icon: Icon, label, value, subtext, highlight = false }) => {
  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        highlight ? 'border-orange-500/30 bg-orange-500/5' : 'border-gray-700/30 bg-gray-900/30'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon
          className="w-4 h-4"
          style={{ color: highlight ? '#f97316' : BRAND_BLUE }}
        />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className={`text-xl font-bold ${highlight ? 'text-orange-400' : 'text-white'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{subtext}</p>
    </div>
  );
};

// ============================================================================
// SALES REP ROUND-ROBIN CONFIGURATION
// ============================================================================
const SALES_REPS = [
  {
    id: 'rich',
    name: 'Rich Pearl',
    meetingLink: 'https://meetings.hubspot.com/rich338?uuid=44a8278a-9cbd-4a28-8876-5886306d367c',
    title: 'Freight Solutions Specialist',
    avatar: '👨‍💼',
    image: richImage,
    specialties: ['Cost Optimization', 'FTL/LTL Strategy']
  },
  {
    id: 'angelo',
    name: "Angelo D'onofrio",
    meetingLink: 'https://calendly.com/angelo-amzprep/45min',
    title: 'Inbound Logistics Expert',
    avatar: '👨‍💼',
    image: angeloImage,
    specialties: ['Speed Optimization', 'Placement Fee Elimination']
  }
];

/**
 * Get the next sales rep in round-robin order
 * Uses localStorage to persist across sessions
 */
const getNextSalesRep = () => {
  const STORAGE_KEY = 'amzprep_rep_index';

  try {
    // Get current index from localStorage
    const currentIndex = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);

    // Calculate next index (round-robin)
    const nextIndex = (currentIndex + 1) % SALES_REPS.length;

    // Save next index for future visits
    localStorage.setItem(STORAGE_KEY, nextIndex.toString());

    // Return current rep (before incrementing)
    return SALES_REPS[currentIndex % SALES_REPS.length];
  } catch (e) {
    // Fallback if localStorage is unavailable (e.g., incognito mode)
    // Use time-based alternation as backup
    const hourOfDay = new Date().getHours();
    return SALES_REPS[hourOfDay % SALES_REPS.length];
  }
};

/**
 * Get assigned rep for this session (cached)
 * Only assigns once per page load to ensure consistency
 */
let cachedRep = null;
const getAssignedRep = () => {
  if (!cachedRep) {
    cachedRep = getNextSalesRep();
    console.log(`📞 Assigned sales rep: ${cachedRep.name}`);
  }
  return cachedRep;
};

// ============================================================================
// CTA SECTION WITH BOOKING MODAL JOURNEY
// ============================================================================
const CTASection = ({ totalSavings, placementFeeSavings, isAdmin }) => {
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingStep, setBookingStep] = useState('intro'); // 'intro' | 'matched' | 'redirecting'
  const [assignedRep, setAssignedRep] = useState(null);

  const handleUnlockClick = () => {
    if (isAdmin) {
      const detailedSection = document.getElementById('detailed-analysis');
      if (detailedSection) {
        detailedSection.classList.remove('hidden');
        detailedSection.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      // Open booking modal for users
      setShowBookingModal(true);
      setBookingStep('intro');
    }
  };

  const handleConnectToSpecialist = () => {
    // Get the next rep in rotation when user clicks connect
    const rep = getAssignedRep();
    setAssignedRep(rep);
    setBookingStep('matched');
  };

  const handleBookMeeting = () => {
    if (assignedRep) {
      setBookingStep('redirecting');
      // Short delay for UX feedback before redirect
      setTimeout(() => {
        window.open(assignedRep.meetingLink, '_blank');
        // Close modal after redirect
        setTimeout(() => {
          setShowBookingModal(false);
          setBookingStep('intro');
        }, 500);
      }, 800);
    }
  };

  const handleCloseModal = () => {
    setShowBookingModal(false);
    setBookingStep('intro');
  };

  return (
    <>
      <div className="relative mt-8 p-8 rounded-2xl border border-gray-700/50 backdrop-blur-sm overflow-hidden">
        {/* Blurred background preview */}
        <div className="absolute inset-0 opacity-30 blur-[3px]">
          <div className="h-full w-full bg-gradient-to-br from-[#0B1426] via-[#0F1C3A] to-[#1A2847]">
            <div className="p-8 h-full">
              {/* Mock dashboard elements */}
              <div className="flex justify-between items-center mb-8">
                <div className="h-8 bg-[#00A8FF]/60 rounded-lg w-1/3" />
                <div className="flex gap-3">
                  <div className="h-6 w-20 bg-[#00A8FF]/40 rounded" />
                  <div className="h-6 w-20 bg-emerald-500/40 rounded" />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-8">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-[#1A2847]/80 rounded-xl border border-[#00A8FF]/20 p-4">
                    <div className="h-3 bg-[#00A8FF]/50 rounded mb-2 w-3/4" />
                    <div className="h-6 bg-[#00A8FF]/70 rounded w-1/2" />
                  </div>
                ))}
              </div>

              {/* Map placeholder */}
              <div className="bg-[#1A2847]/60 rounded-2xl border border-[#00A8FF]/30 h-48 flex items-center justify-center">
                <div className="text-[#00A8FF]/60 text-lg font-bold">📊 Interactive Analysis</div>
              </div>
            </div>
          </div>
        </div>

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/70 to-gray-900/50" />

        {/* Content */}
        <div className="relative z-10 text-center max-w-lg mx-auto">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-5"
            style={{
              background: `${BRAND_BLUE}20`,
              border: `1px solid ${BRAND_BLUE}40`
            }}
          >
            <Lock className="w-7 h-7" style={{ color: BRAND_BLUE }} />
          </div>

          <h3 className="text-3xl font-bold text-white mb-3">
            Unlock Full Freight Analysis
          </h3>

          <p className="text-gray-300 mb-6 leading-relaxed">
            See how your inbound speed stacks up vs competitors and where you're leaving money on the table.
            Get your real benchmarks, real savings, and a customized optimization plan.
          </p>

          <button
            onClick={handleUnlockClick}
            className="w-full py-4 px-8 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-[1.02] shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${BRAND_BLUE} 0%, #0066cc 100%)`,
              color: 'white'
            }}
          >
            {isAdmin ? 'View Full Admin Dashboard' : 'Book Free Analysis Call'}
          </button>

          <p className="text-sm text-gray-500 mt-4">
            {isAdmin
              ? 'Access complete analytics • Interactive maps • Detailed breakdowns'
              : '30-min analysis • Zero Placement Fees • See exact savings before committing'
            }
          </p>
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <BookingModal
          step={bookingStep}
          assignedRep={assignedRep}
          totalSavings={totalSavings}
          onConnectToSpecialist={handleConnectToSpecialist}
          onBookMeeting={handleBookMeeting}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};

// ============================================================================
// BOOKING MODAL COMPONENT - USER JOURNEY
// ============================================================================
const BookingModal = ({
  step,
  assignedRep,
  totalSavings,
  onConnectToSpecialist,
  onBookMeeting,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden animate-fadeIn"
        style={{
          background: 'linear-gradient(135deg, #0a0f1a 0%, #111827 100%)',
          border: `1px solid ${BRAND_BLUE}30`,
          animation: 'fadeIn 0.3s ease-out'
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors z-10"
        >
          <svg className="w-5 h-5 text-gray-400 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Step 1: Introduction */}
        {step === 'intro' && (
          <div className="p-8">
            <div className="text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: `${BRAND_BLUE}20` }}
              >
                <Clock className="w-8 h-8" style={{ color: BRAND_BLUE }} />
              </div>

              <h3 className="text-2xl font-bold text-white mb-3">
                Schedule Your Free Analysis
              </h3>

              <p className="text-gray-400 mb-6 leading-relaxed">
                Get a personalized 30-minute consultation with one of our freight optimization specialists.
              </p>
            </div>

            {/* What to expect */}
            <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4" style={{ color: BRAND_BLUE }} />
                What We'll Cover
              </h4>
              <ul className="space-y-2.5">
                {[
                  'Deep dive into your shipping data',
                  'Identify cost-saving opportunities',
                  'Transit time optimization strategies',
                  'Custom recommendations for your business'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Savings callout */}
            {totalSavings > 0 && (
              <div
                className="rounded-xl p-3 mb-6 text-center"
                style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}
              >
                <p className="text-sm text-emerald-400">
                  💰 Based on your data: <span className="font-bold">{formatCurrency(totalSavings)}</span> potential savings identified
                </p>
              </div>
            )}

            <button
              onClick={onConnectToSpecialist}
              className="w-full py-4 px-8 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-[1.02]"
              style={{
                background: `linear-gradient(135deg, ${BRAND_BLUE} 0%, #0066cc 100%)`,
                color: 'white'
              }}
            >
              Connect Me With a Specialist
            </button>

            <p className="text-xs text-gray-500 text-center mt-4">
              No commitment required • Takes 30 seconds
            </p>
          </div>
        )}

        {/* Step 2: Rep Matched */}
        {step === 'matched' && assignedRep && (
          <div className="p-8">
            <div className="text-center">
              {/* Success checkmark animation */}
              <div className="relative mb-6">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center mx-auto overflow-hidden animate-scaleIn"
                  style={{
                    background: `${BRAND_BLUE}15`,
                    border: `3px solid ${BRAND_BLUE}40`,
                    animation: 'scaleIn 0.4s ease-out'
                  }}
                >
                  {assignedRep.image ? (
                    <img
                      src={assignedRep.image}
                      alt={assignedRep.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl">{assignedRep.avatar}</span>
                  )}
                </div>
                <div
                  className="absolute bottom-0 right-1/2 transform translate-x-10 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#10b981' }}
                >
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
              </div>

              <h3 className="text-2xl font-bold text-white mb-2">
                You've Been Matched!
              </h3>

              <p className="text-gray-400 mb-6">
                Based on your needs and availability
              </p>
            </div>

            {/* Rep Card */}
            <div
              className="rounded-xl p-5 mb-6"
              style={{
                background: `${BRAND_BLUE}08`,
                border: `1px solid ${BRAND_BLUE}25`
              }}
            >
              <div className="text-center mb-4">
                <h4 className="text-xl font-bold text-white mb-1">
                  {assignedRep.name}
                </h4>
                <p className="text-sm" style={{ color: BRAND_BLUE }}>
                  {assignedRep.title}
                </p>
              </div>

              {/* Specialties */}
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                {assignedRep.specialties.map((specialty, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{
                      background: `${BRAND_BLUE}15`,
                      color: BRAND_BLUE
                    }}
                  >
                    {specialty}
                  </span>
                ))}
              </div>

              <div className="pt-4 border-t border-gray-700/50">
                <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>30-minute video consultation</span>
                </div>
              </div>
            </div>

            <button
              onClick={onBookMeeting}
              className="w-full py-4 px-8 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${BRAND_BLUE} 0%, #0066cc 100%)`,
                color: 'white'
              }}
            >
              <span>Book Time with {assignedRep.name}</span>
              <ExternalLink className="w-5 h-5" />
            </button>

            <p className="text-xs text-gray-500 text-center mt-4">
              You'll be redirected to {assignedRep.name}'s calendar
            </p>
          </div>
        )}

        {/* Step 3: Redirecting */}
        {step === 'redirecting' && assignedRep && (
          <div className="p-8 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse"
              style={{ background: `${BRAND_BLUE}20` }}
            >
              <ExternalLink className="w-8 h-8" style={{ color: BRAND_BLUE }} />
            </div>

            <h3 className="text-xl font-bold text-white mb-2">
              Opening {assignedRep.name}'s Calendar...
            </h3>

            <p className="text-gray-400 text-sm">
              A new tab is opening. If it doesn't appear, please disable your popup blocker.
            </p>

            {/* Loading dots animation */}
            <div className="flex justify-center gap-1 mt-6">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: BRAND_BLUE,
                    animation: `bounce 1s infinite ${i * 0.15}s`
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes scaleIn {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-8px); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.4s ease-out;
        }
      `}</style>
    </div>
  );
};

// ============================================================================
// DETAILED ANALYSIS SECTION (Admin Only)
// ============================================================================
const DetailedAnalysisSection = ({ data, metadata }) => {
  return (
    <div className="space-y-6 mt-8">
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">Detailed Cost Analysis</h3>
        <p className="text-gray-400">
          Full analysis dashboard would be rendered here for admin users...
        </p>
      </div>
    </div>
  );
};

export default ShippingScorecard;
