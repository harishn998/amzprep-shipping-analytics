// ============================================================================
// SMASH FOODS INTEGRATION - SOP COMPLIANT VERSION
// File: backend/utils/smashFoodsIntegration.js
//
// THIS IS THE CORRECTED FILE - ONLY 2 CHANGES FROM ORIGINAL
// ============================================================================

import SmashFoodsParser from './smashFoodsParser.js';
import SmashFoodsCalculator from './smashFoodsCalculator.js'; // Keep for backup
import MiddleMileCalculatorSOP from './middleMileCalculatorSOP.js'; // NEW SOP calculator
import SmashFoodsAnalytics from './smashFoodsAnalytics.js';
import HazmatAnalytics from './hazmatAnalytics.js';
import AmazonRateEnhanced from '../models/AmazonRateEnhanced.js';

/**
 * SmashFoodsIntegration - SOP COMPLIANT VERSION
 */
class SmashFoodsIntegration {

  constructor() {
    this.parser = new SmashFoodsParser();
    this.oldCalculator = new SmashFoodsCalculator(); // Keep for comparison
    this.sopCalculator = new MiddleMileCalculatorSOP(); // NEW SOP calculator
    this.analytics = new SmashFoodsAnalytics();
    this.hazmatAnalytics = new HazmatAnalytics();
  }

  /**
   * Main analysis method - SOP COMPLIANT WITH DYNAMIC CONFIG
   */
  async analyzeSmashFoodsFile(filePath, rateType = 'combined', markup = 0.10, hazmatFilter = 'all', config = {}) {
    console.log('\n🚀 ===============================================');
    console.log('   SMASH FOODS ANALYSIS - SOP COMPLIANT');
    console.log('===============================================');
    console.log(`   File: ${filePath}`);
    console.log(`   Hazmat Filter: ${hazmatFilter}`);
    console.log(`   Dynamic Config: ${JSON.stringify(config)}`);
    console.log('===============================================\n');

    try {
      // =========================================================================
      // 🆕 CHANGE #1: Build parser options from config for date filtering
      // =========================================================================
      const parserOptions = {
        year: config.analysisYear || new Date().getFullYear(),
        startMonth: config.analysisStartMonth || 1,
        endMonth: config.analysisEndMonth || 12,
        shipFromZips: config.shipFromFilter || []
      };

      console.log(`📅 Analysis Period: ${parserOptions.year} (${parserOptions.startMonth}-${parserOptions.endMonth})`);

      // Step 1: Parse Excel file WITH OPTIONS
      console.log('📊 Step 1: Parsing Excel file...');
      const parsedData = await this.parser.parseFile(filePath, parserOptions);
      let shipments = parsedData.dataSheet;

      if (shipments.length === 0) {
        throw new Error('No closed shipments found in file');
      }

      console.log(`✅ Parsed ${shipments.length} closed shipments`);

      // Log hazmat detection
      const hazmatShipments = shipments.filter(s => s.containsHazmat);
      console.log(`\n🔬 Hazmat Detection:`);
      console.log(`   Products: ${parsedData.hazmatClassification.summary.hazmatCount} hazmat, ${parsedData.hazmatClassification.summary.nonHazmatCount} non-hazmat`);
      console.log(`   Shipments: ${hazmatShipments.length} contain hazmat (${((hazmatShipments.length/shipments.length)*100).toFixed(1)}%)`);

      // =========================================================================
      // 🆕 CHANGE #2: Date filtering now handled by parser - just log it
      // =========================================================================
      console.log(`\n📅 Filtered to ${shipments.length} shipments from ${parserOptions.year} (months ${parserOptions.startMonth}-${parserOptions.endMonth})`);

      // Apply hazmat filter
      let originalShipmentCount = shipments.length;
      let filterDescription = 'All shipments';

      if (hazmatFilter === 'hazmat') {
        shipments = shipments.filter(s => s.containsHazmat === true);
        filterDescription = 'Hazmat shipments only';
        console.log(`\n🔍 Filtered to ${shipments.length} HAZMAT shipments (from ${originalShipmentCount} total)`);
      } else if (hazmatFilter === 'non-hazmat') {
        shipments = shipments.filter(s => s.containsHazmat === false);
        filterDescription = 'Non-hazmat shipments only';
        console.log(`\n🔍 Filtered to ${shipments.length} NON-HAZMAT shipments (from ${originalShipmentCount} total)`);
      }

      if (shipments.length === 0) {
        throw new Error(`No ${hazmatFilter} shipments found after filtering`);
      }

      // Log hazmat type breakdown
      if (hazmatFilter === 'hazmat') {
        const typeBreakdown = {};
        shipments.forEach(s => {
          s.hazmatTypes.forEach(type => {
            typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
          });
        });
        console.log(`\n📊 Hazmat Types:`);
        Object.entries(typeBreakdown).forEach(([type, count]) => {
          console.log(`   - ${type}: ${count} shipments`);
        });
      }

      // Step 2: Calculate costs using SOP WITH DYNAMIC CONFIG
      console.log(`\n🧮 Step 2: Calculating costs (SOP method with dynamic config)...`);

      // 🆕 Build sopConfig from request config
      const sopConfig = {
        freightCost: config.freightCost || 3000,
        freightMarkup: config.freightMarkup || 1.20,
        mmBaseCost: config.mmBaseCost || null,  // null = use default pattern rates
        mmMarkup: config.mmMarkup || 1.0,
        rateMode: config.rateMode || 'FTL',
        destination: config.destination || null,  // null = auto-detect
        palletCost: config.palletCost || 150
      };

      // =========================================================================
      // ⚠️ CRITICAL: Use calculateBulkShipmentsWithConfig - NOT calculateAllCosts
      // =========================================================================
      const sopCalculation = this.sopCalculator.calculateBulkShipmentsWithConfig(shipments, sopConfig);

      // Step 3: Get current costs
      console.log(`\n💰 Step 3: Calculating current costs...`);
      const currentCosts = this.calculateCurrentCosts(shipments);

      console.log(`✅ Current: $${currentCosts.totalCost.toFixed(2)}`);
      console.log(`   - Placement: $${currentCosts.totalPlacementFees.toFixed(2)}`);
      console.log(`   - Carrier: $${currentCosts.totalFreight.toFixed(2)}`);

      // Step 4: Generate analytics
      console.log(`\n📈 Step 4: Generating insights...`);

      const costAnalysisForAnalytics = {
        currentCosts,
        currentMetrics: this.calculateMetrics(
          currentCosts.totalCost,
          sopCalculation.summary.totalCuft,
          sopCalculation.summary.totalShipments * 50,
          sopCalculation.summary.totalPallets
        ),
        proposedCosts: {
          totalCost: sopCalculation.summary.totalFreightCost
        },
        proposedMetrics: this.calculateMetrics(
          sopCalculation.summary.totalFreightCost,
          sopCalculation.summary.totalCuft,
          sopCalculation.summary.totalShipments * 50,
          sopCalculation.summary.totalPallets
        ),
        savings: {
          amount: sopCalculation.summary.totalMerchantSavings,
          percent: sopCalculation.summary.savingsPercent,
          currentTotal: sopCalculation.summary.totalClientCost,
          proposedTotal: sopCalculation.summary.totalFreightCost
        },
        transitImprovement: {
          currentTransitDays: Math.round(shipments.reduce((sum, s) => sum + s.transitDays, 0) / shipments.length),
          amzPrepTransitDays: 6,
          improvementDays: 0,
          improvementPercent: 0
        },
        stateBreakdown: this.calculateStateBreakdown(shipments)
      };

      // Calculate transit improvement
      if (costAnalysisForAnalytics.transitImprovement.currentTransitDays > 6) {
        costAnalysisForAnalytics.transitImprovement.improvementDays =
          costAnalysisForAnalytics.transitImprovement.currentTransitDays - 6;
        costAnalysisForAnalytics.transitImprovement.improvementPercent =
          (costAnalysisForAnalytics.transitImprovement.improvementDays /
           costAnalysisForAnalytics.transitImprovement.currentTransitDays) * 100;
      }

      const insights = this.analytics.generateDashboardInsights(
        costAnalysisForAnalytics,
        shipments
      );
      console.log('✅ Insights generated');

      // Step 5: Hazmat analytics
      console.log(`\n🔬 Step 5: Generating hazmat analytics...`);
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

      const hazmatMetricsBreakdown = this.calculateHazmatMetricsBreakdown(
        shipments,
        costAnalysisForAnalytics
      );

      const completeAnalysis = {
        // Basic metrics
        totalShipments: summary.totalShipments,
        totalUnits: summary.totalUnits,
        totalPallets: Math.round(summary.totalPallets),
        totalCuft: Math.round(summary.totalCuft),
        totalWeight: Math.round(summary.totalWeight),

        // Filter info
        filterApplied: hazmatFilter,
        filterDescription,
        originalShipmentCount,

        // Date range
        dateRange: insights.executiveSummary.overview.analysisTimeframe,

        // 🆕 Add analysis period to response
        analysisPeriod: {
          year: parserOptions.year,
          startMonth: parserOptions.startMonth,
          endMonth: parserOptions.endMonth
        },

        // Calculation method
        calculationMethod: 'SOP_COMPLIANT',
        sopConfig,

        // Current costs
        currentCosts: {
          totalFreight: currentCosts.totalFreight,
          totalPlacementFees: currentCosts.totalPlacementFees,
          totalCost: currentCosts.totalCost,
          costPerCuft: costAnalysisForAnalytics.currentMetrics.costPerCuft,
          costPerUnit: costAnalysisForAnalytics.currentMetrics.costPerUnit,
          costPerPallet: costAnalysisForAnalytics.currentMetrics.costPerPallet
        },

        // Proposed costs (SOP)
        proposedCosts: {
          sop: {
            mmCost: sopCalculation.summary.totalMM,
            internalTransferCost: sopCalculation.summary.totalInternalTransfer,
            totalFreightCost: sopCalculation.summary.totalFreightCost,
            mmCostPT: sopCalculation.summary.totalMMCostPT,

            costPerCuft: costAnalysisForAnalytics.proposedMetrics.costPerCuft,
            costPerUnit: costAnalysisForAnalytics.proposedMetrics.costPerUnit,
            costPerPallet: costAnalysisForAnalytics.proposedMetrics.costPerPallet,

            breakdown: [
              {
                type: 'Middle Mile (Pattern to Amazon)',
                description: `${Math.round(summary.totalCuft)} cuft × rate (varies by type)`,
                cost: sopCalculation.summary.totalMM,
                formula: 'Cuft × Pattern Rate ($2.75-$7.00 depending on type)'
              },
              {
                type: 'Internal Transfer (Warehouse to Pattern)',
                description: `${Math.round(summary.totalCuft)} cuft × (FTL/1742) × 1.20`,
                cost: sopCalculation.summary.totalInternalTransfer,
                formula: 'Cuft × (FTL/1742) × 1.20 markup'
              },
              {
                type: 'Total Freight Cost',
                description: 'MM + Internal Transfer',
                cost: sopCalculation.summary.totalFreightCost,
                formula: 'Client would pay this amount'
              },
              {
                type: 'MM COST PT (AMZ Prep\'s Cost)',
                description: 'What AMZ Prep is charged by Pattern',
                cost: sopCalculation.summary.totalMMCostPT,
                formula: '[(FTL/26) × Pallets] + [Cuft × Base Rate]'
              }
            ],

            warehouseBreakdown: sopCalculation.warehouseBreakdown,
            typeBreakdown: sopCalculation.typeBreakdown,
            rateCard: this.sopCalculator.getRateCard()
          }
        },

        // Savings
        savings: {
          amount: sopCalculation.summary.totalMerchantSavings,
          percent: sopCalculation.summary.savingsPercent,
          currentTotal: sopCalculation.summary.totalClientCost,
          proposedTotal: sopCalculation.summary.totalFreightCost,
          explanation: sopCalculation.summary.totalMerchantSavings >= 0 ?
            'Client saves money with AMZ Prep' :
            'Client would pay more with AMZ Prep'
        },

        // Transit times
        avgTransitTime: costAnalysisForAnalytics.transitImprovement.currentTransitDays,
        amzPrepTransitTime: 6,
        transitImprovement: costAnalysisForAnalytics.transitImprovement.improvementDays,
        transitImprovementPercent: Math.round(costAnalysisForAnalytics.transitImprovement.improvementPercent),

        // Geographic
        topStates: insights.geographic.topStates,
        stateBreakdown: insights.geographic.stateBreakdown,

        // Carriers
        carriers: insights.performance.carriers.map(c => ({
          name: c.carrier,
          count: c.count,
          percentage: Math.round((c.count / summary.totalShipments) * 100)
        })),

        // Recommendations
        recommendations: insights.recommendations,
        recommendationCount: insights.recommendations.length,

        // HAZMAT ANALYSIS
        hazmat: {
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
          products: hazmatAnalysis.products,
          typeBreakdown: hazmatAnalysis.typeBreakdown,
          dgClassBreakdown: hazmatAnalysis.dgClassBreakdown,
          confidenceBreakdown: hazmatAnalysis.confidenceBreakdown,
          shipments: hazmatAnalysis.shipments,
          metricsBreakdown: hazmatMetricsBreakdown,
          geographic: hazmatAnalysis.geographic,
          compliance: hazmatAnalysis.compliance,
          recommendations: hazmatAnalysis.recommendations,
          pivotData: this.hazmatAnalytics.generateHazmatPivotData(shipments),
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
          costAnalysisForAnalytics,
          insights,
          hazmatAnalysis,
          hazmatFilter,
          filterDescription
        ),

        // Metadata
        metadata: {
          dataFormat: 'smash_foods_with_hazmat',
          rateType,
          markup,
          analysisDate: new Date().toISOString(),
          version: '3.0-sop',
          filtered: shipments.length < originalShipmentCount,
          hazmatFilter,
          originalShipmentCount,
          hasHazmatSheet: parsedData.hazmatSheet !== null,
          sopCompliant: true,
          rateCardVersion: '2025-SOP'
        }
      };

      console.log('\n✅ ===============================================');
      console.log('   ANALYSIS COMPLETE');
      console.log('===============================================');
      console.log(`   Method: SOP Compliant`);
      console.log(`   Analysis Period: ${parserOptions.year} (${parserOptions.startMonth}-${parserOptions.endMonth})`);
      console.log(`   Shipments: ${completeAnalysis.totalShipments}`);
      console.log(`   Current: $${completeAnalysis.currentCosts.totalCost.toFixed(2)}`);
      console.log(`   Proposed: $${completeAnalysis.proposedCosts.sop.totalFreightCost.toFixed(2)}`);
      console.log(`   Savings: $${completeAnalysis.savings.amount.toFixed(2)} (${completeAnalysis.savings.percent.toFixed(2)}%)`);
      console.log('===============================================\n');

      return completeAnalysis;

    } catch (error) {
      console.error('❌ Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Calculate current costs
   */
  calculateCurrentCosts(shipments) {
    const totals = {
      totalFreight: 0,
      totalPlacementFees: 0,
      totalCost: 0
    };

    shipments.forEach(shipment => {
      totals.totalFreight += shipment.carrierCost || 0;
      totals.totalPlacementFees += shipment.placementFees || 0;
      totals.totalCost += shipment.currentTotalCost || 0;
    });

    return {
      totalFreight: Math.round(totals.totalFreight * 100) / 100,
      totalPlacementFees: Math.round(totals.totalPlacementFees * 100) / 100,
      totalCost: Math.round(totals.totalCost * 100) / 100
    };
  }

  /**
   * Calculate metrics
   */
  calculateMetrics(totalCost, totalCuft, totalUnits, totalPallets) {
    return {
      costPerCuft: totalCuft > 0 ? parseFloat((totalCost / totalCuft).toFixed(2)) : 0,
      costPerUnit: totalUnits > 0 ? parseFloat((totalCost / totalUnits).toFixed(2)) : 0,
      costPerPallet: totalPallets > 0 ? parseFloat((totalCost / totalPallets).toFixed(2)) : 0
    };
  }

  /**
   * Calculate state breakdown
   */
  calculateStateBreakdown(shipments) {
    const stateData = {};

    shipments.forEach(shipment => {
      const state = shipment.destinationState || 'Unknown';

      if (!stateData[state]) {
        stateData[state] = {
          state,
          count: 0,
          units: 0,
          pallets: 0,
          cuft: 0,
          currentCost: 0,
          avgTransitDays: 0
        };
      }

      stateData[state].count += 1;
      stateData[state].units += shipment.units || 0;
      stateData[state].pallets += shipment.calculatedPallets || 0;
      stateData[state].cuft += shipment.cuft || 0;
      stateData[state].currentCost += shipment.currentTotalCost || 0;
      stateData[state].avgTransitDays += shipment.transitDays || 0;
    });

    Object.keys(stateData).forEach(state => {
      stateData[state].avgTransitDays = Math.round(
        stateData[state].avgTransitDays / stateData[state].count
      );
      stateData[state].currentCost = Math.round(stateData[state].currentCost * 100) / 100;
      stateData[state].pallets = parseFloat(stateData[state].pallets.toFixed(2));
      stateData[state].cuft = parseFloat(stateData[state].cuft.toFixed(2));
    });

    return stateData;
  }

  /**
   * Calculate hazmat metrics breakdown
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
   * Generate executive summary
   */
  generateExecutiveSummary(summary, costAnalysis, insights, hazmatAnalysis, hazmatFilter, filterDescription) {
    const keyFindings = [];

    // Cost savings
    if (costAnalysis.savings.amount >= 0) {
      keyFindings.push(
        `Save $${Math.abs(costAnalysis.savings.amount).toLocaleString()} (${Math.abs(costAnalysis.savings.percent)}%) with AMZ Prep`
      );
    } else {
      keyFindings.push(
        `AMZ Prep costs $${Math.abs(costAnalysis.savings.amount).toLocaleString()} more (${Math.abs(costAnalysis.savings.percent)}%)`
      );
    }

    // Transit time
    if (costAnalysis.transitImprovement.improvementDays > 0) {
      keyFindings.push(
        `Reduce transit by ${costAnalysis.transitImprovement.improvementDays} days (${costAnalysis.transitImprovement.improvementPercent}%)`
      );
    }

    // Geographic
    if (insights.geographic.topStates[0]) {
      keyFindings.push(
        `Top destination: ${insights.geographic.topStates[0].state} (${insights.geographic.topStates[0].percentage}%)`
      );
    }

    // Hazmat
    if (hazmatFilter === 'all') {
      keyFindings.push(
        `${hazmatAnalysis.products.hazmat} hazmat products (${hazmatAnalysis.products.percentHazmat}%)`
      );
    }

    return {
      title: hazmatFilter === 'hazmat' ? 'Hazmat Freight Analysis' :
             hazmatFilter === 'non-hazmat' ? 'Non-Hazmat Freight Analysis' :
             'Complete Freight Analysis',
      subtitle: `${summary.totalShipments} Shipments | ${summary.totalUnits.toLocaleString()} Units`,
      filterApplied: filterDescription,
      keyFindings
    };
  }

  /**
   * Get active rates
   */
  async getActiveRates() {
    try {
      const rates = await AmazonRateEnhanced.findOne({ isActive: true });
      return rates || { palletRate: 15, cuftRate: 0.35, prepFee: 0.15 };
    } catch (error) {
      console.warn('⚠️ Could not fetch rates');
      return { palletRate: 15, cuftRate: 0.35, prepFee: 0.15 };
    }
  }

  /**
   * Validate file
   */
  async validateFile(filePath) {
    try {
      const parsedData = await this.parser.parseFile(filePath);
      return parsedData.dataSheet.length > 0;
    } catch (error) {
      console.error('Validation failed:', error);
      return false;
    }
  }
}

export default SmashFoodsIntegration;
