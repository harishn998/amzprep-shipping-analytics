// ============================================================================
// AMZ PREP SHIPPING SCORECARD - Updated with Admin Dashboard Preview Background
// Creates urgency and lead generation through partial data reveal
// File: ShippingScorecard.jsx
// ============================================================================

import React, { useState } from 'react';
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

      {/* FOMO Section for ALL Users (both regular and admin) */}
      <BrandAnalysisSection
        totalSavings={scorecardData.urgencyMetrics.totalAnnualSavings}
        placementFeeSavings={scorecardData.urgencyMetrics.placementFeeSavings}
        dailyLoss={scorecardData.urgencyMetrics.dailyLoss}
        isAdmin={isAdmin}
      />

      {/* Full Analysis Section - Initially Hidden */}
      {isAdmin && (
        <div id="detailed-analysis" className="hidden">
          <DetailedAnalysisSection data={data} metadata={metadata} />
        </div>
      )}
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
                backgroundColor: i % 3 === 0 ? 'transparent' : 'transparent'
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

        {/* Right: Logo & Branding - UPDATED LAYOUT */}
        <div className="text-center lg:text-right">
          <div className="inline-flex flex-col items-center lg:items-end gap-2 mb-4">
            {/* Logo at Top */}
            <img
              src={amzprepLogo}
              alt="AMZ Prep"
              className="h-10 w-auto mb-2"
            />
            {/* Text Below Logo */}
            <div className="text-center lg:text-right">
              <div className="text-white font-bold text-xl mb-2">Shipping Score</div>
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
 /**
  * Enhanced Brand Analysis Section with Detailed Map Preview
  */
 const BrandAnalysisSection = ({
   totalSavings = 15000,
   placementFeeSavings = 0,
   dailyLoss = 41,
   isAdmin = false,
   onUnlockAnalysis
 }) => {
   const brandBlue = '#00A8FF';
   const [showFullAnalysis, setShowFullAnalysis] = useState(false);

   const formatCurrency = (amount) => {
     return new Intl.NumberFormat('en-US', {
       style: 'currency',
       currency: 'USD',
       minimumFractionDigits: 0,
       maximumFractionDigits: 0
     }).format(amount);
   };

   const handleUnlockClick = () => {
     if (isAdmin) {
       // For admin users, show the detailed analysis section
       setShowFullAnalysis(true);
       const detailedSection = document.getElementById('detailed-analysis');
       if (detailedSection) {
         detailedSection.classList.remove('hidden');
         detailedSection.scrollIntoView({ behavior: 'smooth' });
       }
     } else {
       // For regular users, go to contact page
       window.open('https://amzprep.com/contact-us/', '_blank');
     }
   };

   return (
     <div className="relative mt-12 p-8 rounded-2xl border border-gray-700/50 backdrop-blur-sm overflow-hidden">
     {/* HIGHLY VISIBLE Admin Dashboard Preview Background */}
     <div className="absolute inset-0 opacity-40 blur-[2.3px]">
       <div className="h-full w-full bg-gradient-to-br from-[#0B1426] via-[#0F1C3A] to-[#1A2847]">

         {/* Dashboard Layout - ENHANCED VISIBILITY */}
         <div className="p-8 h-full">
           {/* Header Section */}
           <div className="flex justify-between items-center mb-10">
             <div className="h-10 bg-[#00A8FF] rounded-lg w-1/3 opacity-80"></div>
             <div className="flex gap-4">
               <div className="h-8 w-24 bg-[#00A8FF] rounded opacity-70"></div>
               <div className="h-8 w-24 bg-emerald-500 rounded opacity-70"></div>
             </div>
           </div>

           {/* KPI Cards - MUCH MORE VISIBLE */}
           <div className="grid grid-cols-4 gap-6 mb-12">
             {Array.from({ length: 4 }).map((_, i) => (
               <div key={i} className="bg-[#1A2847] rounded-2xl border-2 border-[#00A8FF] p-6 opacity-90">
                 <div className="h-4 bg-[#00A8FF] rounded mb-3 w-3/4 opacity-80"></div>
                 <div className="h-8 bg-[#00A8FF] rounded w-1/2 mb-2 opacity-90"></div>
                 <div className="h-3 bg-[#00A8FF]/50 rounded w-full"></div>
               </div>
             ))}
           </div>

           {/* MAIN MAP SECTION - MAXIMUM VISIBILITY */}
           <div className="bg-[#1A2847] rounded-3xl border-3 border-[#00A8FF] p-8 h-96 opacity-95">
             <div className="flex justify-between items-center mb-6">
               <div className="h-8 bg-[#00A8FF] rounded w-1/4 opacity-90"></div>
               <div className="flex gap-3">
                 <div className="px-4 py-2 bg-[#00A8FF] rounded-lg text-white font-bold opacity-80">Heat Map</div>
                 <div className="px-4 py-2 bg-emerald-500 rounded-lg text-white font-bold opacity-80">Routes</div>
                 <div className="px-4 py-2 bg-orange-500 rounded-lg text-white font-bold opacity-80">Zones</div>
               </div>
             </div>

             {/* ULTRA-VISIBLE US MAP */}
             <div className="relative h-72 bg-[#0F1C3A] rounded-2xl border-2 border-[#00A8FF]/60 overflow-hidden">
               <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 400">
                 {/* US Map Base - THICK OUTLINE */}
                 <path
                   d="M80 120 L160 100 L240 110 L320 120 L400 100 L480 110 L560 120 L560 300 L480 320 L400 310 L320 300 L240 310 L160 320 L80 310 Z"
                   fill="rgba(0, 168, 255, 0.25)"
                   stroke="#00A8FF"
                   strokeWidth="4"
                   opacity="0.9"
                 />

                 {/* State Division Lines */}
                 <line x1="160" y1="100" x2="160" y2="320" stroke="#00A8FF" strokeWidth="2" opacity="0.4" />
                 <line x1="240" y1="110" x2="240" y2="310" stroke="#00A8FF" strokeWidth="2" opacity="0.4" />
                 <line x1="320" y1="120" x2="320" y2="300" stroke="#00A8FF" strokeWidth="2" opacity="0.4" />
                 <line x1="400" y1="100" x2="400" y2="310" stroke="#00A8FF" strokeWidth="2" opacity="0.4" />
                 <line x1="480" y1="110" x2="480" y2="320" stroke="#00A8FF" strokeWidth="2" opacity="0.4" />

                 {/* MASSIVE Heat Zones - VERY VISIBLE */}
                 <circle cx="450" cy="160" r="50" fill="#00A8FF" opacity="0.95" />
                 <circle cx="280" cy="200" r="45" fill="#00A8FF" opacity="0.90" />
                 <circle cx="180" cy="180" r="40" fill="#3B82F6" opacity="0.85" />

                 {/* Medium Zones */}
                 <circle cx="380" cy="240" r="35" fill="#60A5FA" opacity="0.80" />
                 <circle cx="220" cy="150" r="30" fill="#60A5FA" opacity="0.75" />
                 <circle cx="420" cy="190" r="32" fill="#93C5FD" opacity="0.70" />

                 {/* THICK Shipping Routes */}
                 <line x1="280" y1="200" x2="450" y2="160" stroke="#00A8FF" strokeWidth="8" opacity="0.95" strokeDasharray="12,6" />
                 <line x1="180" y1="180" x2="380" y2="240" stroke="#60A5FA" strokeWidth="8" opacity="0.90" strokeDasharray="10,5" />
                 <line x1="220" y1="150" x2="420" y2="190" stroke="#93C5FD" strokeWidth="6" opacity="0.85" strokeDasharray="8,4" />

                 {/* Warehouse Markers - LARGE */}
                 <rect x="275" y="195" width="15" height="15" fill="#FFD700" opacity="1" rx="2" />
                 <rect x="445" y="155" width="15" height="15" fill="#FFD700" opacity="1" rx="2" />
                 <rect x="175" y="175" width="15" height="15" fill="#FFD700" opacity="1" rx="2" />
                 <rect x="375" y="235" width="15" height="15" fill="#FFD700" opacity="1" rx="2" />
               </svg>

               {/* PROMINENT Labels */}
               <div className="absolute top-4 left-4 bg-[#00A8FF] px-4 py-3 rounded-xl text-white font-bold text-sm border-2 border-white/30">
                 🗺️ Interactive Heat Map
               </div>
               <div className="absolute top-4 right-4 bg-emerald-500 px-4 py-3 rounded-xl text-white font-bold text-sm border-2 border-white/30">
                 📍 Live Routes
               </div>

               {/* Enhanced Legend */}
               <div className="absolute bottom-4 left-4 bg-[#1A2847] border-2 border-[#00A8FF] rounded-xl p-4 opacity-95">
                 <div className="text-sm text-[#00A8FF] font-bold mb-2">Volume Zones</div>
                 <div className="space-y-2">
                   <div className="flex items-center gap-3 text-sm">
                     <div className="w-4 h-4 bg-[#00A8FF] rounded-full"></div>
                     <span className="text-white font-semibold">High ($3.2M)</span>
                   </div>
                   <div className="flex items-center gap-3 text-sm">
                     <div className="w-4 h-4 bg-[#60A5FA] rounded-full"></div>
                     <span className="text-white font-semibold">Medium ($1.8M)</span>
                   </div>
                   <div className="flex items-center gap-3 text-sm">
                     <div className="w-4 h-4 bg-[#93C5FD] rounded-full"></div>
                     <span className="text-white font-semibold">Low ($0.9M)</span>
                   </div>
                 </div>
               </div>

               <div className="absolute bottom-4 right-4 bg-[#00A8FF] px-4 py-3 rounded-xl text-white font-bold border-2 border-white/30">
                 Total Analysis: $5.9M Impact
               </div>
             </div>
           </div>
         </div>
       </div>
     </div>

     {/* MUCH LIGHTER Overlay for Maximum Map Visibility */}
     <div className="absolute inset-0 bg-gradient-to-t from-gray-900/75 via-gray-900/40 to-gray-900/20"></div>
     <div className="absolute inset-0 backdrop-blur-[0.5px]"></div>

       {/* Content Overlay */}
       <div className="relative z-10 text-center max-w-lg mx-auto">
         <div className="w-16 h-16 bg-gradient-to-br from-[#00A8FF]/20 to-[#00A8FF]/40 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[#00A8FF]/30 backdrop-blur-sm">
           <Lock className="text-[#00A8FF]" size={32} />
         </div>

         <h3 className="text-4xl font-bold text-white mb-4">
           Unlock Complete Analysis
         </h3>

         <p className="text-gray-300 mb-8 leading-relaxed text-lg">
           Get your comprehensive AMZ Prep optimization analysis with detailed savings breakdown,
           interactive cost mapping, and ROI projections.
         </p>

         <button
           onClick={handleUnlockClick}
           className="inline-block w-full bg-gradient-to-r from-[#00A8FF] to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-xl text-center text-lg"
         >
           {isAdmin ? 'View Full Admin Dashboard' : 'Book Free Analysis Call'}
         </button>

         <p className="text-sm text-gray-400 mt-4">
           {isAdmin
             ? 'Access complete analytics • Interactive maps • Detailed breakdowns'
             : '30-min analysis • No obligation • See exact savings before committing'
           }
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
