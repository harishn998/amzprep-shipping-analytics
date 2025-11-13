// ============================================================================
// SMASH FOODS INTEGRATION - WITH HAZMAT ANALYTICS
// File: backend/utils/smashFoodsIntegration.js
// ============================================================================

import SmashFoodsParser from './smashFoodsParser.js';
import SmashFoodsCalculator from './smashFoodsCalculator.js';
import SmashFoodsAnalytics from './smashFoodsAnalytics.js';
import HazmatAnalytics from './hazmatAnalytics.js'; // 🆕 ADD THIS IMPORT
import AmazonRateEnhanced from '../models/AmazonRateEnhanced.js';

/**
 * SmashFoodsIntegration - WITH HAZMAT ANALYSIS SUPPORT
 */
class SmashFoodsIntegration {

  constructor() {
    this.parser = new SmashFoodsParser();
    this.calculator = new SmashFoodsCalculator();
    this.analytics = new SmashFoodsAnalytics();
    this.hazmatAnalytics = new HazmatAnalytics(); // 🆕 ADD THIS
  }

  /**
   * Main analysis method
   * 🆕 NOW INCLUDES HAZMAT ANALYSIS
   *
   * @param {string} filePath - Path to uploaded Excel file
   * @param {string} rateType - Rate type
   * @param {number} markup - Markup percentage
   * @param {string} hazmatFilter - 'all', 'hazmat', or 'non-hazmat' 🆕 NEW PARAMETER
   */
  async analyzeSmashFoodsFile(filePath, rateType = 'combined', markup = 0.10, hazmatFilter = 'all') {
    console.log('🚀 Starting Smash Foods analysis...');
    console.log(`   File: ${filePath}`);
    console.log(`   Rate Type: ${rateType}`);
    console.log(`   Markup: ${(markup * 100)}%`);
    console.log(`   Hazmat Filter: ${hazmatFilter}`); // 🆕 LOG FILTER

    try {
      // Step 1: Parse Excel file (NOW INCLUDES HAZMAT CLASSIFICATION)
      console.log('📊 Step 1: Parsing Excel file...');
      const parsedData = await this.parser.parseFile(filePath);
      let shipments = parsedData.dataSheet;

      if (shipments.length === 0) {
        throw new Error('No closed shipments found in file');
      }

      console.log(`✅ Parsed ${shipments.length} closed shipments`);

      // Filter to 2025 shipments
      const shipmentsWithDates = shipments.filter(s => s.createdDate);
      const shipments2025 = shipmentsWithDates.filter(s => {
        const year = new Date(s.createdDate).getFullYear();
        return year === 2025;
      });

      if (shipments2025.length > 0) {
        shipments = shipments2025;
        console.log(`📅 Filtered to ${shipments.length} shipments from 2025`);
      }

      // 🆕 STEP 1.5: APPLY HAZMAT FILTER IF REQUESTED
      let originalShipmentCount = shipments.length;
      if (hazmatFilter === 'hazmat') {
        shipments = shipments.filter(s => s.containsHazmat === true);
        console.log(`🔍 Filtered to ${shipments.length} HAZMAT shipments (from ${originalShipmentCount} total)`);
      } else if (hazmatFilter === 'non-hazmat') {
        shipments = shipments.filter(s => s.containsHazmat === false);
        console.log(`🔍 Filtered to ${shipments.length} NON-HAZMAT shipments (from ${originalShipmentCount} total)`);
      }

      if (shipments.length === 0) {
        throw new Error(`No ${hazmatFilter} shipments found after filtering`);
      }

      // Step 2: Get rates
      console.log('💰 Step 2: Fetching AMZ Prep rates...');
      const rates = await this.getActiveRates();
      console.log('✅ Rates loaded');

      // Step 3: Calculate costs
      console.log('🧮 Step 3: Calculating costs...');
      const costAnalysis = this.calculator.calculateComprehensiveComparison(
        shipments,
        rates,
        markup
      );
      console.log('✅ Cost calculations complete');

      // Step 4: Generate analytics
      console.log('📈 Step 4: Generating insights...');
      const insights = this.analytics.generateDashboardInsights(
        costAnalysis,
        shipments
      );
      console.log('✅ Insights generated');

      // 🆕 STEP 5: GENERATE HAZMAT ANALYTICS
      console.log('🔬 Step 5: Generating hazmat analytics...');
      const hazmatAnalysis = this.hazmatAnalytics.generateHazmatAnalysis(
        parsedData.hazmatClassification,
        shipments
      );
      console.log('✅ Hazmat analytics complete');

      // Step 6: Compile complete analysis
      const summary = this.parser.getSummary({
        dataSheet: shipments,
        hazmatClassification: parsedData.hazmatClassification
      });

      const completeAnalysis = {
        // Basic metrics
        totalShipments: summary.totalShipments,
        totalUnits: summary.totalUnits,
        totalPallets: Math.round(summary.totalPallets),
        totalCuft: Math.round(summary.totalCuft),
        totalWeight: Math.round(summary.totalWeight),

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

        // Prep time
        avgPrepTime: this.analytics.calculateAvgPrepTime(shipments),

        // Split shipments
        splitShipments: shipments.filter(s => s.placementFees > 0).length,
        splitShipmentRate: this.analytics.calculateSplitShipmentRate(shipments),

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

        // 🆕 HAZMAT ANALYSIS
        hazmat: {
          // Product-level metrics
          products: hazmatAnalysis.products,

          // Type and class breakdown
          typeBreakdown: hazmatAnalysis.typeBreakdown,
          dgClassBreakdown: hazmatAnalysis.dgClassBreakdown,
          confidenceBreakdown: hazmatAnalysis.confidenceBreakdown,

          // Shipment-level metrics
          shipments: hazmatAnalysis.shipments,

          // Geographic analysis for hazmat
          geographic: hazmatAnalysis.geographic,

          // Compliance insights
          compliance: hazmatAnalysis.compliance,

          // Hazmat-specific recommendations
          recommendations: hazmatAnalysis.recommendations,

          // Pivot data (for charts)
          pivotData: this.hazmatAnalytics.generateHazmatPivotData(shipments),

          // Full product list (for reference)
          productList: parsedData.hazmatClassification.hazmat.slice(0, 50) // First 50
        },

        // Executive summary
        executiveSummary: {
          title: hazmatFilter === 'hazmat'
            ? 'Hazmat Products Freight Analysis'
            : hazmatFilter === 'non-hazmat'
            ? 'Non-Hazmat Products Freight Analysis'
            : 'Complete Freight Analysis',
          subtitle: `${summary.totalShipments} Shipments | ${summary.totalUnits.toLocaleString()} Units | ${Math.round(summary.totalPallets)} Pallets`,
          keyFindings: [
            costAnalysis.savings.amount >= 0
              ? `Save $${Math.abs(costAnalysis.savings.amount).toLocaleString()} (${Math.abs(costAnalysis.savings.percent)}%) by switching to AMZ Prep`
              : `AMZ Prep would cost $${Math.abs(costAnalysis.savings.amount).toLocaleString()} more (${Math.abs(costAnalysis.savings.percent)}% increase)`,
            costAnalysis.transitImprovement.improvementDays > 0
              ? `Reduce transit time by ${costAnalysis.transitImprovement.improvementDays} days (${costAnalysis.transitImprovement.improvementPercent}% faster)`
              : `Current transit time: ${costAnalysis.transitImprovement.currentTransitDays} days`,
            `Top destination: ${insights.geographic.topStates[0]?.state || 'Various'} with ${insights.geographic.topStates[0]?.percentage || 0}% of shipments`,
            `${this.analytics.calculateSplitShipmentRate(shipments)}% of shipments incurred placement fees`,
            // 🆕 ADD HAZMAT FINDING
            hazmatFilter === 'all'
              ? `${hazmatAnalysis.products.hazmat} hazmat products (${hazmatAnalysis.products.percentHazmat}%) requiring special handling`
              : null
          ].filter(Boolean)
        },

        // Metadata
        metadata: {
          dataFormat: 'smash_foods_actual',
          rateType,
          markup,
          analysisDate: new Date().toISOString(),
          version: '1.0',
          filtered: shipments2025.length > 0 && shipments2025.length < parsedData.dataSheet.length,
          hazmatFilter, // 🆕 TRACK FILTER APPLIED
          originalShipmentCount, // 🆕 TRACK ORIGINAL COUNT
          hasHazmatData: true // 🆕 FLAG THAT HAZMAT DATA IS AVAILABLE
        }
      };

      console.log('✅ Smash Foods analysis complete!');
      console.log(`   Total Savings: $${completeAnalysis.savings.amount.toLocaleString()}`);
      console.log(`   Transit Improvement: ${completeAnalysis.transitImprovement} days`);
      console.log(`   Hazmat Products: ${hazmatAnalysis.products.hazmat} (${hazmatAnalysis.products.percentHazmat}%)`);
      console.log(`   Recommendations: ${completeAnalysis.recommendationCount}`);

      return completeAnalysis;

    } catch (error) {
      console.error('❌ Smash Foods analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get active rates - NO CHANGES
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
   * Get default rates - NO CHANGES
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
   * Validate file - NO CHANGES
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
