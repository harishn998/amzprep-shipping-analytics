// ============================================================================
// SMASH FOODS INTEGRATION - FIXED VERSION WITH ACCURATE HAZMAT ANALYSIS
// File: backend/utils/smashFoodsIntegration.js
// ============================================================================

import SmashFoodsParser from './smashFoodsParser.js';
import SmashFoodsCalculator from './smashFoodsCalculator.js';
import SmashFoodsAnalytics from './smashFoodsAnalytics.js';
import HazmatAnalytics from './hazmatAnalytics.js';
import AmazonRateEnhanced from '../models/AmazonRateEnhanced.js';

/**
 * SmashFoodsIntegration - FIXED VERSION
 *
 * KEY IMPROVEMENTS:
 * 1. Accurate hazmat detection using Hazmat sheet as source of truth
 * 2. Proper shipment filtering by hazmat status
 * 3. Correct cost calculations for filtered data
 * 4. Enhanced analytics and insights
 */
class SmashFoodsIntegration {

  constructor() {
    this.parser = new SmashFoodsParser();
    this.calculator = new SmashFoodsCalculator();
    this.analytics = new SmashFoodsAnalytics();
    this.hazmatAnalytics = new HazmatAnalytics();
  }

  /**
   * Main analysis method - FIXED VERSION
   */
  async analyzeSmashFoodsFile(filePath, rateType = 'combined', markup = 0.10, hazmatFilter = 'all') {
    console.log('🚀 Starting Smash Foods analysis (FIXED VERSION)...');
    console.log(`   File: ${filePath}`);
    console.log(`   Rate Type: ${rateType}`);
    console.log(`   Markup: ${(markup * 100)}%`);
    console.log(`   Hazmat Filter: ${hazmatFilter}`);

    try {
      // Step 1: Parse Excel file with ACCURATE hazmat detection
      console.log('📊 Step 1: Parsing Excel file with hazmat detection...');
      const parsedData = await this.parser.parseFile(filePath);
      let shipments = parsedData.dataSheet;

      if (shipments.length === 0) {
        throw new Error('No closed shipments found in file');
      }

      console.log(`✅ Parsed ${shipments.length} closed shipments`);

      // Log hazmat detection results
      const hazmatShipments = shipments.filter(s => s.containsHazmat);
      console.log(`   🔬 Hazmat detection:`);
      console.log(`      - Products: ${parsedData.hazmatClassification.summary.hazmatCount} hazmat, ${parsedData.hazmatClassification.summary.nonHazmatCount} non-hazmat`);
      console.log(`      - Shipments: ${hazmatShipments.length} contain hazmat (${((hazmatShipments.length/shipments.length)*100).toFixed(1)}%)`);

      // Filter to 2025 shipments
      /*const shipmentsWithDates = shipments.filter(s => s.createdDate);
      const shipments2025 = shipmentsWithDates.filter(s => {
        const year = new Date(s.createdDate).getFullYear();
        return year === 2025;
      });

      if (shipments2025.length > 0) {
        shipments = shipments2025;
        console.log(`📅 Filtered to ${shipments.length} shipments from 2025`);
      }*/

      // Filter to current year
      const currentYear = new Date().getFullYear();
      const filteredByDate = shipments.filter(s => {
        if (!s.createdDate) return false;
        const year = new Date(s.createdDate).getFullYear();
        return year === currentYear;
      });

      // Filter to US shipments only (exclude Canadian postal codes)
      const usShipments = filteredByDate.filter(s => {
        const zip = String(s.shipFromZip || '').trim();
        if (!zip) return true;

        // Canadian postal codes start with letters
        const isCanadian = /^[A-Z]/i.test(zip);
        return !isCanadian; // Keep US shipments only
      });

      shipments = usShipments;
      console.log(`✅ Filtered: ${shipments.length} shipments (${currentYear}, US only)`);

      // 🆕 APPLY HAZMAT FILTER
      let originalShipmentCount = shipments.length;
      let filterDescription = 'All shipments';

      if (hazmatFilter === 'hazmat') {
        shipments = shipments.filter(s => s.containsHazmat === true);
        filterDescription = 'Hazmat shipments only';
        console.log(`🔍 Filtered to ${shipments.length} HAZMAT shipments (from ${originalShipmentCount} total)`);
      } else if (hazmatFilter === 'non-hazmat') {
        shipments = shipments.filter(s => s.containsHazmat === false);
        filterDescription = 'Non-hazmat shipments only';
        console.log(`🔍 Filtered to ${shipments.length} NON-HAZMAT shipments (from ${originalShipmentCount} total)`);
      }

      if (shipments.length === 0) {
        throw new Error(`No ${hazmatFilter} shipments found after filtering`);
      }

      // Log breakdown by hazmat type (if filtering to hazmat only)
      if (hazmatFilter === 'hazmat') {
        const typeBreakdown = {};
        shipments.forEach(s => {
          s.hazmatTypes.forEach(type => {
            typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
          });
        });
        console.log(`   📊 Hazmat types in filtered shipments:`);
        Object.entries(typeBreakdown).forEach(([type, count]) => {
          console.log(`      - ${type}: ${count} shipments`);
        });
      }

      // Step 2: Get rates
      console.log('💰 Step 2: Fetching AMZ Prep rates...');
      const rates = await this.getActiveRates();
      console.log('✅ Rates loaded');

      // Step 3: Calculate costs FOR FILTERED DATA
      console.log('🧮 Step 3: Calculating costs for filtered data...');
      const costAnalysis = this.calculator.calculateComprehensiveComparison(
        shipments,
        rates,
        markup
      );
      console.log('✅ Cost calculations complete');
      console.log(`   Current Total: $${costAnalysis.currentCosts.totalCost.toLocaleString()}`);
      console.log(`   AMZ Prep Total: $${costAnalysis.proposedCosts.totalCost.toLocaleString()}`);
      console.log(`   Savings: $${costAnalysis.savings.amount.toLocaleString()} (${costAnalysis.savings.percent}%)`);

      // Step 4: Generate analytics
      console.log('📈 Step 4: Generating insights...');
      const insights = this.analytics.generateDashboardInsights(
        costAnalysis,
        shipments
      );
      console.log('✅ Insights generated');

      // 🆕 Step 5: Generate COMPREHENSIVE hazmat analytics
      console.log('🔬 Step 5: Generating comprehensive hazmat analytics...');

      // For hazmat analytics, we need to use the FULL classification data
      // but filter shipments according to the user's selection
      const hazmatAnalysis = this.hazmatAnalytics.generateHazmatAnalysis(
        parsedData.hazmatClassification,
        shipments // Use filtered shipments
      );
      console.log('✅ Hazmat analytics complete');

      // Step 6: Compile complete analysis
      const summary = this.parser.getSummary({
        dataSheet: shipments,
        hazmatClassification: parsedData.hazmatClassification
      });

      // 🆕 Calculate metrics breakdown by hazmat status
      const hazmatMetricsBreakdown = this.calculateHazmatMetricsBreakdown(
        shipments,
        costAnalysis
      );

      const completeAnalysis = {
        // Basic metrics
        totalShipments: summary.totalShipments,
        totalUnits: summary.totalUnits,
        totalPallets: Math.round(summary.totalPallets),
        totalCuft: Math.round(summary.totalCuft),
        totalWeight: Math.round(summary.totalWeight),

        // Filter information
        filterApplied: hazmatFilter,
        filterDescription,
        originalShipmentCount,

        // Date range
        dateRange: insights.executiveSummary.overview.analysisTimeframe,

        // Current costs
        currentCosts: {
          totalFreight: costAnalysis.currentCosts.totalFreight,
          totalPlacementFees: costAnalysis.currentCosts.totalPlacementFees,
          totalCost: costAnalysis.currentCosts.totalCost,
          costPerCuft: costAnalysis.currentMetrics.costPerCuft,
          costPerUnit: costAnalysis.currentMetrics.costPerUnit,
          costPerPallet: costAnalysis.currentMetrics.costPerPallet
        },

        // Proposed costs
        proposedCosts: {
          combined: {
            patternCost: costAnalysis.proposedCosts.patternCost,
            internalCost: costAnalysis.proposedCosts.internalCost,
            freightOnlyCost: costAnalysis.proposedCosts.freightOnlyCost,
            amzPrepCost: costAnalysis.proposedCosts.amzPrepCost,
            totalCost: costAnalysis.proposedCosts.totalCost,
            costPerCuft: costAnalysis.proposedMetrics.costPerCuft,
            costPerUnit: costAnalysis.proposedMetrics.costPerUnit,
            costPerPallet: costAnalysis.proposedMetrics.costPerPallet,
            breakdown: [
              {
                type: 'Pattern (DC to FBA)',
                description: `${Math.round(summary.totalCuft)} cuft @ $2.625/cuft`,
                cost: costAnalysis.proposedCosts.patternCost
              },
              {
                type: 'Internal Transfer (Whse to DC)',
                description: `${Math.round(summary.totalCuft)} cuft @ $1.014/cuft`,
                cost: costAnalysis.proposedCosts.internalCost
              },
              {
                type: 'Freight Only Subtotal',
                description: 'Pattern + Internal before discount',
                cost: costAnalysis.proposedCosts.freightOnlyCost
              },
              {
                type: 'AMZ Prep Final Cost',
                description: 'After 9.86% operational efficiency discount',
                cost: costAnalysis.proposedCosts.amzPrepCost
              }
            ]
          }
        },

        // Savings
        savings: {
          amount: costAnalysis.savings.amount,
          percent: costAnalysis.savings.percent,
          currentTotal: costAnalysis.savings.currentTotal,
          proposedTotal: costAnalysis.savings.proposedTotal
        },

        // Transit times
        avgTransitTime: Math.round(summary.avgTransitDays),
        amzPrepTransitTime: this.calculator.AMZ_PREP_TRANSIT_DAYS,
        transitImprovement: costAnalysis.transitImprovement.improvementDays,
        transitImprovementPercent: costAnalysis.transitImprovement.improvementPercent,

        // Geographic analysis
        topStates: insights.geographic.topStates,
        stateBreakdown: insights.geographic.stateBreakdown,

        // Carrier analysis
        carriers: insights.performance.carriers.map(c => ({
          name: c.carrier,
          count: c.count,
          percentage: Math.round((c.count / summary.totalShipments) * 100)
        })),

        // Recommendations
        recommendations: insights.recommendations,
        recommendationCount: insights.recommendations.length,

        // 🆕 COMPREHENSIVE HAZMAT ANALYSIS
        hazmat: {
          // Overview
          overview: {
            totalHazmatProducts: parsedData.hazmatClassification.summary.hazmatCount,
            totalNonHazmatProducts: parsedData.hazmatClassification.summary.nonHazmatCount,
            totalProducts: parsedData.hazmatClassification.total,
            hazmatPercentage: hazmatAnalysis.products.percentHazmat,

            totalHazmatShipments: hazmatAnalysis.shipments.hazmat,
            totalNonHazmatShipments: hazmatAnalysis.shipments.nonHazmat,
            shipmentsAnalyzed: summary.totalShipments,
            shipmentHazmatPercentage: hazmatAnalysis.shipments.percentHazmat
          },

          // Product-level metrics
          products: hazmatAnalysis.products,

          // Type and class breakdown
          typeBreakdown: hazmatAnalysis.typeBreakdown,
          dgClassBreakdown: hazmatAnalysis.dgClassBreakdown,
          confidenceBreakdown: hazmatAnalysis.confidenceBreakdown,

          // Shipment-level metrics (for filtered data)
          shipments: hazmatAnalysis.shipments,

          // 🆕 Metrics breakdown by hazmat status
          metricsBreakdown: hazmatMetricsBreakdown,

          // Geographic analysis for hazmat
          geographic: hazmatAnalysis.geographic,

          // Compliance insights
          compliance: hazmatAnalysis.compliance,

          // Hazmat-specific recommendations
          recommendations: hazmatAnalysis.recommendations,

          // Pivot data (for charts)
          pivotData: this.hazmatAnalytics.generateHazmatPivotData(shipments),

          // Sample hazmat products (for reference)
          sampleProducts: parsedData.hazmatClassification.hazmat.slice(0, 20).map(item => ({
            asin: item.asin,
            productName: item.product_name,
            type: item.classification.hazmatType,
            storageType: item.classification.storageType,
            confidence: item.classification.confidence
          }))
        },

        // Executive summary
        executiveSummary: this.generateExecutiveSummary(
          summary,
          costAnalysis,
          insights,
          hazmatAnalysis,
          hazmatFilter,
          filterDescription
        ),

        // Metadata
        metadata: {
          dataFormat: 'smash_foods_with_hazmat_sheet',
          rateType,
          markup,
          analysisDate: new Date().toISOString(),
          version: '2.0-fixed',
          filtered: shipments.length < originalShipmentCount,
          hazmatFilter,
          originalShipmentCount,
          hasHazmatSheet: parsedData.hazmatSheet !== null,
          hasHazmatData: true,
          parserVersion: 'fixed-accurate',
          classifierVersion: 'reference-based'
        }
      };

      console.log('\n✅ Smash Foods analysis complete!');
      console.log(`   📊 Analysis Summary:`);
      console.log(`      - Filter: ${filterDescription}`);
      console.log(`      - Shipments: ${completeAnalysis.totalShipments}`);
      console.log(`      - Hazmat Products: ${hazmatAnalysis.products.hazmat} (${hazmatAnalysis.products.percentHazmat}%)`);
      console.log(`      - Total Savings: $${completeAnalysis.savings.amount.toLocaleString()}`);
      console.log(`      - Transit Improvement: ${completeAnalysis.transitImprovement} days`);
      console.log(`      - Recommendations: ${completeAnalysis.recommendationCount}`);

      return completeAnalysis;

    } catch (error) {
      console.error('❌ Smash Foods analysis failed:', error);
      throw error;
    }
  }

  /**
   * 🆕 Calculate metrics breakdown by hazmat status
   */
  calculateHazmatMetricsBreakdown(shipments, costAnalysis) {
    const hazmatShipments = shipments.filter(s => s.containsHazmat);
    const nonHazmatShipments = shipments.filter(s => !s.containsHazmat);

    const calculateTotals = (ships) => ({
      count: ships.length,
      units: ships.reduce((sum, s) => sum + s.units, 0),
      pallets: ships.reduce((sum, s) => sum + s.calculatedPallets, 0),
      cuft: ships.reduce((sum, s) => sum + s.cuft, 0),
      currentCost: ships.reduce((sum, s) => sum + s.currentTotalCost, 0),
      placementFees: ships.reduce((sum, s) => sum + s.placementFees, 0),
      carrierCost: ships.reduce((sum, s) => sum + s.carrierCost, 0)
    });

    const hazmatTotals = calculateTotals(hazmatShipments);
    const nonHazmatTotals = calculateTotals(nonHazmatShipments);
    const allTotals = calculateTotals(shipments);

    return {
      all: {
        ...allTotals,
        percentage: 100,
        avgCostPerShipment: allTotals.count > 0 ? allTotals.currentCost / allTotals.count : 0
      },
      hazmat: {
        ...hazmatTotals,
        percentage: allTotals.count > 0 ? (hazmatTotals.count / allTotals.count) * 100 : 0,
        avgCostPerShipment: hazmatTotals.count > 0 ? hazmatTotals.currentCost / hazmatTotals.count : 0
      },
      nonHazmat: {
        ...nonHazmatTotals,
        percentage: allTotals.count > 0 ? (nonHazmatTotals.count / allTotals.count) * 100 : 0,
        avgCostPerShipment: nonHazmatTotals.count > 0 ? nonHazmatTotals.currentCost / nonHazmatTotals.count : 0
      }
    };
  }

  /**
   * 🆕 Generate executive summary with hazmat context
   */
  generateExecutiveSummary(summary, costAnalysis, insights, hazmatAnalysis, hazmatFilter, filterDescription) {
    const keyFindings = [];

    // Cost savings finding
    if (costAnalysis.savings.amount >= 0) {
      keyFindings.push(
        `Save $${Math.abs(costAnalysis.savings.amount).toLocaleString()} (${Math.abs(costAnalysis.savings.percent)}%) by switching to AMZ Prep`
      );
    } else {
      keyFindings.push(
        `AMZ Prep would cost $${Math.abs(costAnalysis.savings.amount).toLocaleString()} more (${Math.abs(costAnalysis.savings.percent)}% increase)`
      );
    }

    // Transit time finding
    if (costAnalysis.transitImprovement.improvementDays > 0) {
      keyFindings.push(
        `Reduce transit time by ${costAnalysis.transitImprovement.improvementDays} days (${costAnalysis.transitImprovement.improvementPercent}% faster)`
      );
    }

    // Geographic finding
    if (insights.geographic.topStates[0]) {
      keyFindings.push(
        `Top destination: ${insights.geographic.topStates[0].state} with ${insights.geographic.topStates[0].percentage}% of shipments`
      );
    }

    // Hazmat finding (context-aware)
    if (hazmatFilter === 'all') {
      keyFindings.push(
        `${hazmatAnalysis.products.hazmat} hazmat products (${hazmatAnalysis.products.percentHazmat}%) across ${hazmatAnalysis.shipments.hazmat} shipments requiring special handling`
      );
    } else if (hazmatFilter === 'hazmat') {
      const topType = hazmatAnalysis.typeBreakdown[0];
      if (topType) {
        keyFindings.push(
          `Analysis of hazmat shipments: ${topType.type} is the dominant type (${topType.count} shipments, ${topType.percentage}%)`
        );
      }
    } else if (hazmatFilter === 'non-hazmat') {
      keyFindings.push(
        `Analysis of non-hazmat shipments only: standard handling procedures apply`
      );
    }

    return {
      title: hazmatFilter === 'hazmat'
        ? 'Hazmat Products Freight Analysis'
        : hazmatFilter === 'non-hazmat'
        ? 'Non-Hazmat Products Freight Analysis'
        : 'Complete Freight Analysis',
      subtitle: `${summary.totalShipments} Shipments | ${summary.totalUnits.toLocaleString()} Units | ${Math.round(summary.totalPallets)} Pallets`,
      filterApplied: filterDescription,
      keyFindings
    };
  }

  /**
   * Get active rates (unchanged)
   */
  async getActiveRates() {
    try {
      let rate = await AmazonRateEnhanced.getActiveRate('combined');

      if (!rate) {
        const prepRate = await AmazonRateEnhanced.getActiveRate('prep');
        const middleMileRate = await AmazonRateEnhanced.getActiveRate('middleMile');

        if (!prepRate || !middleMileRate) {
          console.warn('⚠️  No rates found in database, using default rates');
          return this.getDefaultRates();
        }

        return {
          palletRate: 56.00,
          cuftRate: 2.50,
          prepRate: 0.60,
          middleMileRate: 61.60
        };
      }

      return {
        palletRate: rate.rateDetails?.palletRate || 56.00,
        cuftRate: rate.rateDetails?.cuftRate || 2.50,
        prepRate: rate.rateDetails?.prepRate || 0.60,
        middleMileRate: rate.rateDetails?.middleMileRate || 61.60
      };

    } catch (error) {
      console.error('Error fetching rates:', error);
      return this.getDefaultRates();
    }
  }

  /**
   * Get default rates (unchanged)
   */
  getDefaultRates() {
    return {
      palletRate: 56.00,
      cuftRate: 2.50,
      prepRate: 0.60,
      middleMileRate: 61.60
    };
  }

  /**
   * Validate file (unchanged)
   */
  async validateFile(filePath) {
    try {
      const parsedData = await this.parser.parseFile(filePath);
      return parsedData.dataSheet.length > 0;
    } catch (error) {
      console.error('File validation failed:', error);
      return false;
    }
  }
}

export default SmashFoodsIntegration;
