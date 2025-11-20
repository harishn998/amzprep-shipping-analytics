// ============================================================================
// AMZ PREP SHIPPING SCORECARD - Updated with Admin Dashboard Preview Background
// Creates urgency and lead generation through partial data reveal
// File: ShippingScorecard.jsx
// ============================================================================

import React from 'react';
import { TrendingDown, Clock, Package, DollarSign, ExternalLink, Lock } from 'lucide-react';
import amzprepLogo from './assets/amzprep_white_logo.png';

/**
 * Enterprise-level shipping scorecard component
 * Using brand colors: #00A8FF and Poppins font
 */
export const ShippingScorecard = ({ data, metadata = {}, isAdmin = false }) => {
  // Calculate scorecard metrics from dashboard data
  const scorecardData = calculateScorecardMetrics(data, metadata);

  return (
    <div className="shipping-scorecard space-y-8 font-['Poppins']">
      {/* Header Section - Updated Layout: Score Left, Logo Right */}
      <BrandHeader scorecardData={scorecardData} />

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Industry Comparison */}
        <BrandIndustryComparison comparison={scorecardData.comparison} />

        {/* Right Column: Performance Breakdown */}
        <BrandPerformanceMetrics breakdown={scorecardData.breakdown} />
      </div>

      {/* Key Insights Section */}
      <BrandInsightsSection metrics={scorecardData.urgencyMetrics} />

      {/* Blurred Detailed Analysis Section (unless admin) */}
      {!isAdmin && (
        <BrandAnalysisSection
          totalSavings={scorecardData.urgencyMetrics.totalAnnualSavings}
          placementFeeSavings={scorecardData.urgencyMetrics.placementFeeSavings}
          dailyLoss={scorecardData.urgencyMetrics.dailyLoss}
        />
      )}

      {/* Full Analysis (admin only) */}
      {isAdmin && <DetailedAnalysisSection data={data} metadata={metadata} />}
    </div>
  );
};

/**
 * Calculate scorecard metrics from existing dashboard data
 */
const calculateScorecardMetrics = (data, metadata) => {
  console.log('🎯 Calculating scorecard from REAL analysis data...');
  console.log('📊 Metadata available:', !!metadata);

  // Get current costs from analysis (your backend data structure)
  const currentCosts = metadata?.currentCosts || {};
  const proposedCosts = metadata?.proposedCosts?.combined || metadata?.proposedCosts || {};
  const savings = metadata?.savings || {};

  // Get transit time data
  const transitImprovement = metadata?.transitImprovement || {};
  const currentTransitTime = transitImprovement.currentTransitDays || metadata?.avgTransitTime || 11;
  const amzPrepTransitTime = transitImprovement.amzPrepTransitDays || 3;

  // Get totals from analysis
  const totalLogisticsCost = currentCosts.totalCost || 200000;
  const actualPlacementFees = currentCosts.totalPlacementFees || 0;
  const totalUnits = metadata?.totalUnits || data?.totalShipments || 1000;
  const totalCuft = metadata?.totalCuft || 500;
  const totalPallets = metadata?.totalPallets || (totalCuft / 67);

  // Calculate opportunity values
  const placementFeeSavings = actualPlacementFees;
  let totalAnnualSavings;
  if (savings.amount && savings.amount > 0) {
    totalAnnualSavings = savings.amount;
  } else {
    const hiddenCostSavings = Math.max(totalLogisticsCost * 0.10, 5000);
    const speedImpactSavings = Math.max(totalLogisticsCost * 0.05, 2000);
    totalAnnualSavings = placementFeeSavings + hiddenCostSavings + speedImpactSavings;
  }

  const hiddenCostSavings = Math.max((totalLogisticsCost - actualPlacementFees) * 0.10, 5000);
  const transitTimeDifference = Math.max(0, currentTransitTime - amzPrepTransitTime);
  const speedImpactSavings = transitTimeDifference > 5 ? Math.max(totalLogisticsCost * 0.05, 2000) : 1000;
  const dailyLoss = Math.round(totalAnnualSavings / 365);

  // Scoring framework
  let speedScore = 40;
  if (currentTransitTime >= 10) speedScore = 2;
  else if (currentTransitTime >= 7) speedScore = 5;
  else if (currentTransitTime >= 5) speedScore = 12;
  else if (currentTransitTime >= 4) speedScore = 20;
  else if (currentTransitTime >= 3) speedScore = 30;

  let costScore = 35;
  if (actualPlacementFees > 0) {
    costScore = 0;
  } else if (totalAnnualSavings > totalLogisticsCost * 0.20) {
    costScore = 5;
  } else if (totalAnnualSavings > totalLogisticsCost * 0.15) {
    costScore = 10;
  } else if (totalAnnualSavings > totalLogisticsCost * 0.10) {
    costScore = 20;
  }

  let geoScore = 25;
  const splitShipmentRate = data?.splitShipmentRate || 0;
  const topStatesCount = data?.topStates?.length || 0;

  if (splitShipmentRate > 30) geoScore = 5;
  else if (splitShipmentRate > 20) geoScore = 10;
  else if (splitShipmentRate > 10) geoScore = 15;
  else if (topStatesCount < 5) geoScore -= 5;

  const rawScore = speedScore + costScore + geoScore;

  // Timer for 2025 rate lock
  const currentDate = new Date();
  const endOfYear = new Date(currentDate.getFullYear(), 11, 31);
  const daysUntilRateIncrease = Math.max(0, Math.ceil((endOfYear - currentDate) / (1000 * 60 * 60 * 24)));

  // Industry benchmark positioning
  let scoreStatus = 'CRITICAL';
  let percentileRank = 'Bottom 5%';
  let urgencyLevel = 'EMERGENCY';

  if (rawScore >= 90) {
    scoreStatus = 'EXCELLENT'; percentileRank = 'Top 1%'; urgencyLevel = 'OPTIMIZED';
  } else if (rawScore >= 70) {
    scoreStatus = 'GOOD'; percentileRank = 'Top 10%'; urgencyLevel = 'MINOR TWEAKS';
  } else if (rawScore >= 50) {
    scoreStatus = 'AVERAGE'; percentileRank = '50th Percentile'; urgencyLevel = 'SIGNIFICANT WASTE';
  } else if (rawScore >= 30) {
    scoreStatus = 'POOR'; percentileRank = 'Bottom 25%'; urgencyLevel = 'URGENT ACTION NEEDED';
  }

  const totalScore = Math.min(rawScore, 35);

  return {
    totalScore,
    scoreStatus,
    percentileRank,
    urgencyLevel,
    daysUntilRateIncrease,
    urgencyMetrics: {
      dailyLoss,
      extraDays: Math.max(0, currentTransitTime - amzPrepTransitTime),
      totalAnnualSavings,
      placementFeeSavings,
      hiddenCostSavings,
      speedImpactSavings,
      currentTransitTime,
      targetTransitTime: amzPrepTransitTime
    },
    breakdown: {
      speed: {
        score: speedScore,
        max: 40,
        status: speedScore <= 5 ? 'BOTTOM 1%' : speedScore <= 12 ? 'BOTTOM 5%' : speedScore <= 20 ? 'BOTTOM 20%' : speedScore <= 30 ? 'BELOW AVERAGE' : 'GOOD',
        message: speedScore <= 5 ? `${currentTransitTime} days delivery puts you in bottom 1% - AMZ Prep delivers in 2-3 days` :
                speedScore <= 12 ? `${currentTransitTime} days delivery is bottom 5% - customers expect faster` :
                speedScore <= 20 ? `${currentTransitTime} days is bottom 20% - AMZ Prep delivers in 2-3 days to 90% ZIP codes` :
                speedScore <= 30 ? `${currentTransitTime} days is below average - AMZ Prep achieves 2-3 days` : 'Competitive delivery speed'
      },
      cost: {
        score: costScore,
        max: 35,
        status: costScore === 0 ? 'CRITICAL' : costScore <= 10 ? 'BOTTOM 10%' : costScore <= 20 ? 'BELOW AVERAGE' : 'GOOD',
        message: actualPlacementFees > 0 ? `Paying $${actualPlacementFees.toLocaleString()}/year in placement fees - AMZ Prep eliminates these completely FREE` :
                costScore <= 10 ? `$${Math.round(totalAnnualSavings).toLocaleString()}+ annual waste identified - emergency optimization needed` :
                costScore <= 20 ? `$${Math.round(hiddenCostSavings).toLocaleString()}+ in hidden waste - significant improvement opportunity` : 'Decent cost efficiency'
      },
      geo: {
        score: geoScore,
        max: 25,
        status: geoScore <= 10 ? 'CRITICAL' : geoScore <= 15 ? 'POOR' : geoScore <= 20 ? 'BELOW AVERAGE' : 'GOOD',
        message: splitShipmentRate > 30 ? `${splitShipmentRate}% split shipment rate causing major inefficiencies` :
                splitShipmentRate > 20 ? `${splitShipmentRate}% split rate - geographic optimization needed` :
                splitShipmentRate > 10 ? `${splitShipmentRate}% split rate - distribution strategy can improve` : 'Good geographic distribution strategy'
      }
    },
    comparison: {
      current: totalScore,
      currentStatus: scoreStatus,
      amzPrepClients: 95,
      industryAverage: 55,
      opportunity: totalAnnualSavings,
      realData: {
        actualPlacementFees,
        currentLogisticsCost: totalLogisticsCost,
        calculatedSavings: totalAnnualSavings,
        transitTimeGap: currentTransitTime - amzPrepTransitTime,
        percentileRank,
        urgencyLevel,
        daysUntilRateIncrease
      }
    }
  };
};

/**
 * Brand Header Component - Updated Layout
 */
const BrandHeader = ({ scorecardData }) => {
  const brandBlue = '#00A8FF';
  const brandBlueRGB = '0, 168, 255';

  return (
    <div className="relative bg-gray-900 rounded-2xl border border-gray-700/50 p-8 overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="grid grid-cols-12 grid-rows-8 h-full w-full gap-1">
          {Array.from({ length: 96 }).map((_, i) => (
            <div
              key={i}
              className="rounded"
              style={{
                backgroundColor: i % 3 === 0 ? brandBlue : 'transparent'
              }}
            />
          ))}
        </div>
      </div>

      {/* Content Grid: Score Left, Logo Right */}
      <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left: Score Section */}
        <div>
          <div className="mb-6">
            <div className="text-6xl font-black mb-2">
              <span className="text-red-500">{scorecardData.totalScore}</span>
              <span className="text-gray-500 text-4xl">/100</span>
            </div>
            <div className="text-red-500 font-bold text-lg tracking-wider">
              {scorecardData.scoreStatus}
            </div>
            <div className="text-gray-400 text-sm uppercase tracking-wider">
              {scorecardData.urgencyLevel}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative w-full h-3 bg-gray-800 rounded-xl border border-gray-700/50 mb-4">
            <div
              className="h-full rounded-xl transition-all duration-2000"
              style={{
                width: `${scorecardData.totalScore}%`,
                background: scorecardData.totalScore <= 35 ? 'linear-gradient(90deg, #ef4444, #dc2626)' : 'linear-gradient(90deg, #3b82f6, #1d4ed8)'
              }}
            />
          </div>

          <div className="text-brand-blue text-sm font-medium">
            {scorecardData.daysUntilRateIncrease} days to lock 2024 rates before increases
          </div>
        </div>

        {/* Right: Logo & Branding */}
        <div className="text-center lg:text-right">
          <div className="inline-flex items-center gap-3 mb-4">
            <img
              src={amzprepLogo}
              alt="AMZ Prep"
              className="h-12 w-auto"
            />
            <div className="text-left">
              <div className="text-white font-bold text-2xl">Shipping Score</div>
              <div className="text-brand-blue text-sm">Comprehensive logistics efficiency analysis</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Brand Industry Comparison Component
 */
const BrandIndustryComparison = ({ comparison }) => {
  const brandBlue = '#00A8FF';
  const brandBlueRGB = '0, 168, 255';

  const comparisonData = [
    {
      label: 'Your Current Score',
      value: comparison.current,
      max: 100,
      status: comparison.currentStatus,
      color: 'rgb(239, 68, 68)',
      description: comparison.realData.percentileRank
    },
    {
      label: 'Industry Average',
      value: comparison.industryAverage,
      max: 100,
      status: '50th Percentile',
      color: 'rgb(59, 130, 246)',
      description: '$2M+ industry money'
    },
    {
      label: 'Top Performers',
      value: comparison.amzPrepClients,
      max: 100,
      status: 'Optimized sellers',
      color: brandBlue,
      description: 'Top 1%'
    }
  ];

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700/50 p-6">
      <h2 className="text-2xl font-semibold text-white mb-6">
        Where You Stand vs Industry
      </h2>

      <div className="space-y-6">
        {comparisonData.map((item, index) => (
          <div key={index}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-white font-medium">{item.label}</span>
              <div className="text-right">
                <span className="text-2xl font-bold" style={{ color: item.color }}>
                  {item.value}/100
                </span>
                <div className="text-xs" style={{ color: item.color }}>
                  {item.status}
                </div>
              </div>
            </div>
            <div className="w-full h-4 bg-gray-800 rounded-xl border border-gray-700/50">
              <div
                className="h-full rounded-xl transition-all duration-2000"
                style={{
                  width: `${item.value}%`,
                  backgroundColor: item.color,
                  boxShadow: item.value === comparison.current ? 'none' : `0 0 8px ${item.color}40`
                }}
              />
            </div>
            <p className="text-sm text-gray-400 mt-1">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Brand Performance Metrics Component
 */
const BrandPerformanceMetrics = ({ breakdown }) => {
  const brandBlue = '#00A8FF';

  const metrics = [
    {
      title: 'Cost Efficiency',
      score: breakdown.cost.score,
      max: breakdown.cost.max,
      status: breakdown.cost.status,
      message: breakdown.cost.message
    },
    {
      title: 'Speed Performance',
      score: breakdown.speed.score,
      max: breakdown.speed.max,
      status: breakdown.speed.status,
      message: breakdown.speed.message
    },
    {
      title: 'Geographic Strategy',
      score: breakdown.geo.score,
      max: breakdown.geo.max,
      status: breakdown.geo.status,
      message: breakdown.geo.message
    }
  ];

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700/50 p-6">
      <h2 className="text-2xl font-semibold text-white mb-6">
        Performance Breakdown
      </h2>

      <div className="space-y-6">
        {metrics.map((metric, index) => (
          <div key={index}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-white font-medium">{metric.title}</h3>
              <div className="text-right">
                <span className="text-xl font-bold text-brand-blue">
                  {metric.score}/{metric.max}
                </span>
                <div className={`text-xs font-medium ${
                  metric.status.includes('CRITICAL') || metric.status.includes('BOTTOM') ? 'text-red-500' :
                  metric.status.includes('POOR') || metric.status.includes('BELOW') ? 'text-orange-500' :
                  'text-brand-blue'
                }`}>
                  {metric.status}
                </div>
              </div>
            </div>

            <div className="w-full h-3 bg-gray-800 rounded-xl border border-gray-700/50 mb-2">
              <div
                className="h-full rounded-xl transition-all duration-2000"
                style={{
                  width: `${(metric.score / metric.max) * 100}%`,
                  background: metric.score <= (metric.max * 0.3) ?
                    'linear-gradient(90deg, #ef4444, #dc2626)' :
                    metric.score <= (metric.max * 0.6) ?
                    'linear-gradient(90deg, #f59e0b, #d97706)' :
                    `linear-gradient(90deg, ${brandBlue}, rgba(0, 168, 255, 0.8))`
                }}
              />
            </div>

            <p className="text-sm text-gray-300 leading-relaxed">
              {metric.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Brand Insights Section Component
 */
const BrandInsightsSection = ({ metrics }) => {
  console.log('🔍 Insights metrics received:', {
    placementFeeSavings: metrics.placementFeeSavings,
    hiddenCostSavings: metrics.hiddenCostSavings,
    totalAnnualSavings: metrics.totalAnnualSavings,
    dailyLoss: metrics.dailyLoss
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const insights = [
    {
      title: 'Speed Crisis',
      value: `${metrics.currentTransitTime} days`,
      subtitle: `vs AMZ Prep's ${metrics.targetTransitTime} days`,
      description: `Your ${metrics.extraDays} extra days = lost sales to faster competitors`,
    },
    {
      title: 'Hidden Cost Discovery',
      value: formatCurrency(metrics.hiddenCostSavings),
      subtitle: 'additional waste',
      description: 'Conservative estimate in optimization opportunities you\'re missing',
    },
    {
      title: 'Total Annual Opportunity (Est.)',
      value: formatCurrency(metrics.totalAnnualSavings),
      subtitle: 'in preventable losses',
      description: `Daily opportunity cost: ${formatCurrency(metrics.dailyLoss)}/day`,
    }
  ];

  // Add placement fees insight if applicable
  if (metrics.placementFeeSavings > 0) {
    insights.unshift({
      title: 'Placement Fees Waste',
      value: formatCurrency(metrics.placementFeeSavings),
      subtitle: 'per year',
      description: 'AMZ Prep Middle Mile eliminates placement fees completely',
    });
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-white">
        Key Insights
      </h2>

      <div className={`grid grid-cols-1 ${insights.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6`}>
        {insights.map((insight, index) => (
          <div
            key={index}
            className="bg-gray-900 rounded-xl border border-gray-700 p-6"
          >
            <div className="mb-4">
              <h3 className="text-lg font-medium text-white mb-1">
                {insight.title}
              </h3>
              <div className="text-2xl font-bold text-brand-blue mb-1">
                {insight.value}
              </div>
              <p className="text-sm text-gray-400">
                {insight.subtitle}
              </p>
            </div>

            <div className="pt-4 border-t border-gray-700/50">
              <p className="text-sm text-gray-300 leading-relaxed">
                {insight.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Brand Analysis Section - UPDATED with Admin Dashboard Preview Background
 */
const BrandAnalysisSection = ({ totalSavings = 15000, placementFeeSavings = 0, dailyLoss = 41 }) => {
  const brandBlue = '#00A8FF';
  const brandBlueRGB = '0, 168, 255';

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="relative mt-12 p-8 rounded-2xl border border-gray-700/50 backdrop-blur-sm overflow-hidden">
      {/* Admin Dashboard Preview Background */}
      <div className="absolute inset-0 opacity-20 blur-sm">
        <div className="h-full w-full bg-gradient-to-br from-[#0B1426] via-[#0F1C3A] to-[#1A2847]">
          {/* Mock Dashboard Elements */}
          <div className="p-6">
            {/* Mock Header */}
            <div className="h-6 bg-[#00A8FF]/30 rounded mb-6 w-1/3"></div>

            {/* Mock Metrics Cards */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="h-20 bg-[#1A2847]/80 rounded-xl border border-[#00A8FF]/20"></div>
              <div className="h-20 bg-[#1A2847]/80 rounded-xl border border-[#00A8FF]/20"></div>
              <div className="h-20 bg-[#1A2847]/80 rounded-xl border border-[#00A8FF]/20"></div>
            </div>

            {/* Mock Map Area */}
            <div className="h-64 bg-[#1A2847]/80 rounded-2xl border border-[#00A8FF]/20 relative overflow-hidden">
              {/* Mock US Map Outline */}
              <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 400 300">
                <path
                  d="M50 100 L100 80 L150 90 L200 100 L250 80 L300 90 L350 100 L350 200 L300 220 L250 210 L200 200 L150 210 L100 220 L50 200 Z"
                  fill="none"
                  stroke="#00A8FF"
                  strokeWidth="2"
                />
                {/* Mock State Highlights */}
                <circle cx="120" cy="150" r="8" fill="#00A8FF" opacity="0.6" />
                <circle cx="180" cy="130" r="6" fill="#00A8FF" opacity="0.4" />
                <circle cx="250" cy="160" r="10" fill="#00A8FF" opacity="0.8" />
              </svg>

              {/* Mock Data Points */}
              <div className="absolute top-4 left-4 bg-[#00A8FF]/20 px-3 py-1 rounded text-xs text-[#00A8FF]">
                Heat Map View
              </div>
              <div className="absolute bottom-4 right-4 bg-[#00A8FF]/20 px-3 py-1 rounded text-xs text-[#00A8FF]">
                Cost Analysis
              </div>
            </div>

            {/* Mock Charts */}
            <div className="grid grid-cols-2 gap-6 mt-6">
              <div className="h-32 bg-[#1A2847]/80 rounded-xl border border-[#00A8FF]/20"></div>
              <div className="h-32 bg-[#1A2847]/80 rounded-xl border border-[#00A8FF]/20"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/60 to-transparent"></div>

      {/* Blur Effect */}
      <div className="absolute inset-0 backdrop-blur-sm bg-gray-900/40"></div>

      {/* Content Overlay */}
      <div className="relative z-10 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center mx-auto mb-6 border border-gray-700">
          <Lock className="text-brand-blue" size={32} />
        </div>

        <h3 className="text-3xl font-bold text-white mb-4">
          Unlock Complete Analysis
        </h3>

        <p className="text-gray-300 mb-8 leading-relaxed">
          Get your comprehensive AMZ Prep optimization analysis with detailed savings breakdown,
          implementation roadmap, and ROI projections.
        </p>

        <a
          href="https://amzprep.com/contact-us/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block w-full bg-gradient-to-r from-[#00A8FF] to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-xl text-center"
        >
          Book Free Analysis Call
        </a>

        <p className="text-sm text-gray-400 mt-4">
          30-min analysis • No obligation • See exact savings before committing
        </p>
      </div>
    </div>
  );
};

/**
 * Full detailed analysis for admin users
 */
const DetailedAnalysisSection = ({ data, metadata }) => {
  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">Detailed Cost Analysis</h3>
        <p className="text-gray-400">Full analysis would be rendered here for admin users...</p>
      </div>
    </div>
  );
};

export default ShippingScorecard;
