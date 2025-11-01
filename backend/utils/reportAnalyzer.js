// ============================================================================
// FIXED REPORT ANALYZER - HANDLES ACTUAL SMASH FOODS FORMAT
// File: backend/utils/reportAnalyzer.js
// ============================================================================

import XLSX from 'xlsx';
import AmazonRateEnhanced from '../models/AmazonRateEnhanced.js';
import ShopifyRate from '../models/ShopifyRate.js';
import { zipToState } from './zipToState.js';

// ============================================================================
// MAIN ANALYZER CLASS
// ============================================================================

class ReportAnalyzer {

  /**
   * Analyze uploaded Excel file for Amazon shipments
   * Supports the ACTUAL Smash Foods data structure
   */
  static async analyzeAmazonReport(filePath, uploadType, rateType) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Use raw: false to get formatted values (resolves formulas)
      const data = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: null });

      if (!data || data.length === 0) {
        throw new Error('No data found in uploaded file');
      }

      console.log('First row columns:', Object.keys(data[0]));

      // Detect data format
      const dataFormat = this.detectDataFormat(data[0]);
      console.log('Detected data format:', dataFormat);

      let analysis;
      switch (dataFormat) {
        case 'smash_foods_actual':
          analysis = await this.analyzeSmashFoodsActualFormat(data, rateType);
          break;
        case 'amazon_seller_central':
          analysis = await this.analyzeSellerCentralFormat(data, rateType);
          break;
        case 'generic_shipment':
        default:
          analysis = await this.analyzeGenericFormat(data, rateType);
      }

      return {
        ...analysis,
        uploadType,
        rateType,
        dataFormat
      };
    } catch (error) {
      console.error('Error analyzing report:', error);
      throw error;
    }
  }

  /**
   * Detect data format based on column headers
   */
  static detectDataFormat(firstRow) {
    const headers = Object.keys(firstRow).map(h => h.toLowerCase());
    console.log('Headers detected:', headers.join(', '));

    // ACTUAL Smash Foods format detection
    if (headers.includes('shipment name') &&
        headers.includes('fba shipment id') &&
        headers.includes('total shipped qty') &&
        headers.includes('amazon partnered carrier cost')) {
      return 'smash_foods_actual';
    }

    // Old Smash Foods format (from original spec)
    if (headers.includes('shipment id') &&
        headers.includes('destination fulfillment center id')) {
      return 'smash_foods_original';
    }

    // Amazon Seller Central format
    if (headers.includes('shipment-id') || headers.includes('amazon-reference-id')) {
      return 'amazon_seller_central';
    }

    // Generic format
    return 'generic_shipment';
  }

  /**
   * Analyze ACTUAL Smash Foods format data
   * This matches the real Excel file structure
   */
  static async analyzeSmashFoodsActualFormat(data, rateType) {
    console.log('Analyzing ACTUAL Smash Foods format data...');
    console.log(`Processing ${data.length} shipments`);

    // Extract shipment details with ACTUAL column names
    const shipments = data.map((row, index) => {
      // Parse weight and volume carefully (may be formulas or numbers)
      let weight = 0;
      let volume = 0;

      try {
        const weightStr = String(row['Total Weight'] || '0').replace(/[^0-9.]/g, '');
        weight = parseFloat(weightStr) || 0;
      } catch (e) {
        console.warn(`Row ${index}: Could not parse weight, using 0`);
      }

      try {
        const volumeStr = String(row['Cuft'] || '0').replace(/[^0-9.]/g, '');
        volume = parseFloat(volumeStr) || 0;
      } catch (e) {
        console.warn(`Row ${index}: Could not parse volume, using 0`);
      }

      // Extract state from ZIP code
      const zipCode = row['Ship To Postal Code'];
      const stateInfo = zipCode ? zipToState(String(zipCode)) : null;
      const destinationState = stateInfo ? stateInfo.code : 'Unknown';

      return {
        shipmentId: row['FBA Shipment ID'] || row['Shipment Name'],
        shipmentName: row['Shipment Name'],
        destinationFC: row['Destination FC'],
        destinationState: destinationState,
        zipCode: zipCode,

        // Order and ship dates
        orderDate: row['Created Date'],
        shipDate: row['Shipment Status: SHIPPED'],

        // Quantities
        units: parseInt(row['Total Shipped Qty'] || 0),
        pallets: parseInt(row['Total Pallet Quantity'] || 0),
        volume: parseFloat(row['Cuft'] || 0),
        weight: parseFloat(row['Total Weight'] || 0),
        skus: parseInt(row['Total SKUs'] || 0),

        // Carrier information
        carrier: row['Carrier'],
        shipMethod: row['Ship Method'],

        // Costs
        placementFee: parseFloat(row['Placement Fees'] || 0),
        estFreight: parseFloat(row['Amazon Partnered Carrier Cost'] || 0),
        prepFees: parseFloat(row['Prep and Labeling Fees'] || 0),

        // Additional info
        status: row['Status'],
        origin: row['Ship From Owner Name']
      };
    }).filter(s => s.units > 0 || s.weight > 0); // Filter out empty rows

    console.log(`Valid shipments after filtering: ${shipments.length}`);

    if (shipments.length === 0) {
      throw new Error('No valid shipment data found. Please check the file format.');
    }

    // Calculate totals and averages
    const totalShipments = shipments.length;
    const totalUnits = shipments.reduce((sum, s) => sum + s.units, 0);
    const totalPallets = shipments.reduce((sum, s) => sum + s.pallets, 0);
    const totalVolume = shipments.reduce((sum, s) => sum + s.volume, 0);
    const totalWeight = shipments.reduce((sum, s) => sum + s.weight, 0);
    const totalPlacementFees = shipments.reduce((sum, s) => sum + s.placementFee, 0);
    const totalFreight = shipments.reduce((sum, s) => sum + s.estFreight, 0);
    const totalPrepFees = shipments.reduce((sum, s) => sum + s.prepFees, 0);

    const avgWeight = totalShipments > 0 ? totalWeight / totalShipments : 0;
    const avgUnitsPerShipment = totalShipments > 0 ? totalUnits / totalShipments : 0;
    const avgPalletsPerShipment = totalShipments > 0 ? totalPallets / totalShipments : 0;

    console.log('Totals calculated:', {
      totalShipments,
      totalUnits,
      totalPallets,
      totalVolume,
      totalWeight,
      totalPlacementFees,
      totalFreight
    });

    // Extract destination states
    const stateDistribution = this.extractStateDistribution(shipments);

    // Count unique SKUs
    const uniqueSKUs = shipments.reduce((sum, s) => sum + s.skus, 0);

    // Calculate current cost per cubic foot
    const currentCostPerCuft = totalVolume > 0 ? totalFreight / totalVolume : 0;

    // ============================================================================
    // COST COMPARISON WITH DIFFERENT RATE TYPES
    // ============================================================================

    const costComparison = await this.calculateCostComparison({
      shipments,
      totalUnits,
      totalPallets,
      totalVolume,
      totalWeight,
      uniqueSKUs,
      stateDistribution,
      rateType
    });

    // ============================================================================
    // RETURN COMPREHENSIVE ANALYSIS
    // ============================================================================

    return {
      totalShipments,
      totalUnits,
      totalPallets,
      avgWeight: parseFloat(avgWeight.toFixed(2)),
      avgUnitsPerShipment: parseFloat(avgUnitsPerShipment.toFixed(0)),
      avgPalletsPerShipment: parseFloat(avgPalletsPerShipment.toFixed(2)),
      analysisMonths: 1,

      // Current costs
      currentCosts: {
        totalFreight: parseFloat(totalFreight.toFixed(2)),
        totalPlacementFees: parseFloat(totalPlacementFees.toFixed(2)),
        totalPrepFees: parseFloat(totalPrepFees.toFixed(2)),
        totalCost: parseFloat((totalFreight + totalPlacementFees + totalPrepFees).toFixed(2)),
        costPerCuft: parseFloat(currentCostPerCuft.toFixed(2)),
        costPerUnit: totalUnits > 0 ? parseFloat((totalFreight / totalUnits).toFixed(2)) : 0,
        costPerPallet: totalPallets > 0 ? parseFloat((totalFreight / totalPallets).toFixed(2)) : 0
      },

      // Proposed costs and savings
      ...costComparison,

      // Distribution data
      stateDistribution,
      topStates: this.getTopStates(stateDistribution, 5),

      // Shipment details
      transportModes: this.getTransportModeDistribution(shipments),
      carriers: this.getCarrierDistribution(shipments),

      // Timeline analysis
      dateRange: this.getDateRange(shipments),
      avgPrepTime: this.calculateAvgPrepTime(shipments),
      avgTransitTime: 28, // From Trestle analysis (industry standard)

      // Placement analysis
      splitShipments: shipments.filter(s => s.placementFee > 0).length,
      splitShipmentRate: parseFloat((shipments.filter(s => s.placementFee > 0).length / totalShipments * 100).toFixed(1)),

      // Domestic vs International (all domestic for Smash Foods)
      domesticVsInternational: {
        domestic: totalShipments,
        international: 0,
        domesticPercent: '100%',
        internationalPercent: '0%'
      },

      // Raw data for detailed view (first 10 shipments)
      shipmentDetails: shipments.slice(0, 10)
    };
  }

  /**
   * Calculate cost comparison using different rate structures
   */
  static async calculateCostComparison(params) {
    const {
      shipments,
      totalUnits,
      totalPallets,
      totalVolume,
      totalWeight,
      uniqueSKUs,
      stateDistribution,
      rateType
    } = params;

    console.log('Calculating cost comparison...');

    const results = {
      proposedCosts: {},
      savings: {},
      recommendations: []
    };

    try {
      // Get relevant active rates
      const prepRate = await AmazonRateEnhanced.getActiveRate('prep');
      const middleMileRate = await AmazonRateEnhanced.getActiveRate('middleMile');
      const combinedRate = await AmazonRateEnhanced.getActiveRate('combined');

      if (!prepRate && !middleMileRate && !combinedRate) {
        throw new Error('No active rates found in database. Please seed rates first.');
      }

      // Calculate current total cost
      const currentTotalCost = shipments.reduce((sum, s) =>
        sum + s.estFreight + s.placementFee + s.prepFees, 0
      );

      // ============================================================================
      // 1. PREP COST CALCULATION
      // ============================================================================
      if (prepRate) {
        try {
          const prepCalculation = prepRate.calculatePrepCost({
            units: totalUnits,
            skus: uniqueSKUs || Math.ceil(totalUnits / 1000), // Estimate if not available
            pallets: totalPallets,
            cubicFeet: totalVolume,
            weight: totalWeight
          });

          results.proposedCosts.prep = {
            totalCost: prepCalculation.totalCost,
            breakdown: prepCalculation.breakdown
          };

          console.log('Prep cost calculated:', prepCalculation.totalCost);
        } catch (err) {
          console.warn('Prep calculation failed:', err.message);
        }
      }

      // ============================================================================
      // 2. MIDDLE-MILE COST CALCULATION (by destination state)
      // ============================================================================
      if (middleMileRate) {
        try {
          let totalMiddleMileCost = 0;
          const stateBreakdown = [];

          for (const [state, data] of Object.entries(stateDistribution)) {
            if (state === 'Unknown') continue;

            try {
              // Determine shipment type based on pallet count
              const shipmentType = data.pallets >= 26 ? 'FTL' : 'LTL';

              const middleMileCalc = middleMileRate.calculateMiddleMileCost({
                shipmentType,
                pallets: data.pallets,
                cubicFeet: data.volume || (data.pallets * 48), // Estimate if not available
                weight: data.weight || (data.pallets * 1000), // Estimate
                destinationState: state
              });

              totalMiddleMileCost += middleMileCalc.totalCost;
              stateBreakdown.push({
                state,
                cost: middleMileCalc.totalCost,
                transitDays: middleMileCalc.transitDays || 6,
                pallets: data.pallets,
                shipmentType
              });

            } catch (err) {
              console.warn(`Middle-mile calc failed for ${state}:`, err.message);
            }
          }

          results.proposedCosts.middleMile = {
            totalCost: parseFloat(totalMiddleMileCost.toFixed(2)),
            breakdown: stateBreakdown
          };

          console.log('Middle-mile cost calculated:', totalMiddleMileCost);
        } catch (err) {
          console.warn('Middle-mile calculation failed:', err.message);
        }
      }

      // ============================================================================
      // 3. COMBINED SOLUTION CALCULATION
      // ============================================================================
      if (combinedRate) {
        try {
          const combinedCalc = combinedRate.calculateComprehensiveCost({
            units: totalUnits,
            skus: uniqueSKUs || Math.ceil(totalUnits / 1000),
            pallets: totalPallets,
            cubicFeet: totalVolume,
            weight: totalWeight,
            shipmentType: totalPallets >= 26 ? 'FTL' : 'LTL',
            shipments: shipments.length,
            isSplit: shipments.filter(s => s.placementFee > 0).length > 0,
            states: Object.keys(stateDistribution).filter(s => s !== 'Unknown')
          });

          results.proposedCosts.combined = {
            totalCost: combinedCalc.totalCost,
            breakdown: combinedCalc.breakdown
          };

          console.log('Combined cost calculated:', combinedCalc.totalCost);
        } catch (err) {
          console.warn('Combined calculation failed:', err.message);
        }
      }

      // ============================================================================
      // 4. CALCULATE SAVINGS
      // ============================================================================
      const proposedCost = results.proposedCosts.combined?.totalCost ||
                          results.proposedCosts.middleMile?.totalCost ||
                          results.proposedCosts.prep?.totalCost ||
                          0;

      if (proposedCost > 0) {
        const savingsAmount = currentTotalCost - proposedCost;
        const savingsPercent = (savingsAmount / currentTotalCost) * 100;

        results.savings = {
          amount: parseFloat(savingsAmount.toFixed(2)),
          percent: parseFloat(savingsPercent.toFixed(2)),
          currentTotal: parseFloat(currentTotalCost.toFixed(2)),
          proposedTotal: parseFloat(proposedCost.toFixed(2))
        };

        console.log('Savings calculated:', results.savings);
      }

      // ============================================================================
      // 5. GENERATE RECOMMENDATIONS
      // ============================================================================
      results.recommendations = this.generateRecommendations({
        savings: results.savings,
        currentTransitTime: 28,
        proposedTransitTime: 6,
        currentPrepTime: this.calculateAvgPrepTime(shipments),
        proposedPrepTime: 2,
        splitShipmentCount: shipments.filter(s => s.placementFee > 0).length,
        totalShipments: shipments.length
      });

    } catch (error) {
      console.error('Error calculating cost comparison:', error);
      results.error = error.message;
    }

    return results;
  }

  /**
   * Generate actionable recommendations based on analysis
   */
  static generateRecommendations(params) {
    const {
      savings,
      currentTransitTime,
      proposedTransitTime,
      currentPrepTime,
      proposedPrepTime,
      splitShipmentCount,
      totalShipments
    } = params;

    const recommendations = [];

    // Cost savings recommendation
    if (savings && savings.amount > 0) {
      recommendations.push({
        type: 'cost_savings',
        title: 'Cost Savings Opportunity',
        description: `AMZ Prep combined solution saves $${savings.amount.toLocaleString()} (${savings.percent.toFixed(1)}%)`,
        impact: savings.percent > 5 ? 'high' : savings.percent > 2 ? 'medium' : 'low',
        savings: savings.amount
      });
    }

    // Transit time improvement
    if (currentTransitTime > proposedTransitTime) {
      const improvement = currentTransitTime - proposedTransitTime;
      const percentImprovement = ((improvement / currentTransitTime) * 100).toFixed(0);

      recommendations.push({
        type: 'transit_time',
        title: 'Significant Transit Time Improvement',
        description: `Average transit time reduces from ${currentTransitTime} days to ${proposedTransitTime} days (${percentImprovement}% faster)`,
        impact: improvement > 20 ? 'high' : improvement > 10 ? 'medium' : 'low',
        improvement: improvement
      });
    }

    // Prep time optimization
    if (currentPrepTime > proposedPrepTime) {
      recommendations.push({
        type: 'prep_time',
        title: 'Streamlined Prep Process',
        description: `Prep time reduces from ${currentPrepTime} days to ${proposedPrepTime} days`,
        impact: 'medium',
        improvement: currentPrepTime - proposedPrepTime
      });
    }

    // Split shipment optimization
    if (splitShipmentCount > totalShipments * 0.5) {
      recommendations.push({
        type: 'consolidation',
        title: 'High Split Shipment Rate',
        description: `${splitShipmentCount} of ${totalShipments} shipments are split. AMZ Prep's optimized routing can reduce split placement fees.`,
        impact: 'medium',
        savings: splitShipmentCount * 150 // Estimated savings
      });
    }

    return recommendations;
  }

  /**
   * Extract state distribution from shipments
   */
  static extractStateDistribution(shipments) {
    const distribution = {};

    shipments.forEach(shipment => {
      const state = shipment.destinationState || 'Unknown';

      if (!distribution[state]) {
        distribution[state] = {
          count: 0,
          units: 0,
          pallets: 0,
          volume: 0,
          weight: 0,
          placementFees: 0,
          freight: 0,
          shipmentCount: 0
        };
      }

      distribution[state].count += 1;
      distribution[state].units += shipment.units || 0;
      distribution[state].pallets += shipment.pallets || 0;
      distribution[state].volume += shipment.volume || 0;
      distribution[state].weight += shipment.weight || 0;
      distribution[state].placementFees += shipment.placementFee || 0;
      distribution[state].freight += shipment.estFreight || 0;
      distribution[state].shipmentCount += 1;
    });

    return distribution;
  }

  /**
   * Get top N states by shipment count
   */
  static getTopStates(distribution, n = 5) {
    const total = Object.values(distribution).reduce((sum, d) => sum + d.count, 0);

    return Object.entries(distribution)
      .map(([state, data]) => ({
        state,
        ...data,
        percentage: parseFloat((data.count / total * 100).toFixed(1))
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, n);
  }

  /**
   * Get transport mode distribution
   */
  static getTransportModeDistribution(shipments) {
    const modes = {};
    shipments.forEach(s => {
      const mode = s.shipMethod || 'Unknown';
      modes[mode] = (modes[mode] || 0) + 1;
    });

    return Object.entries(modes).map(([name, count]) => ({
      name,
      count,
      percentage: parseFloat((count / shipments.length * 100).toFixed(1))
    }));
  }

  /**
   * Get carrier distribution
   */
  static getCarrierDistribution(shipments) {
    const carriers = {};
    shipments.forEach(s => {
      const carrier = s.carrier || 'Unknown';
      carriers[carrier] = (carriers[carrier] || 0) + 1;
    });

    return Object.entries(carriers)
      .map(([name, count]) => ({
        name,
        count,
        percentage: parseFloat((count / shipments.length * 100).toFixed(1))
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get date range of shipments
   */
  static getDateRange(shipments) {
    const dates = shipments
      .map(s => s.shipDate || s.orderDate)
      .filter(d => d)
      .map(d => {
        try {
          return new Date(d);
        } catch {
          return null;
        }
      })
      .filter(d => d && !isNaN(d.getTime()))
      .sort((a, b) => a - b);

    if (dates.length === 0) {
      return { start: 'Unknown', end: 'Unknown' };
    }

    return {
      start: dates[0].toISOString().split('T')[0],
      end: dates[dates.length - 1].toISOString().split('T')[0]
    };
  }

  /**
   * Calculate average prep time (order to shipment)
   */
  static calculateAvgPrepTime(shipments) {
    const prepTimes = shipments
      .filter(s => s.orderDate && s.shipDate)
      .map(s => {
        try {
          const order = new Date(s.orderDate);
          const ship = new Date(s.shipDate);
          return Math.floor((ship - order) / (1000 * 60 * 60 * 24));
        } catch {
          return null;
        }
      })
      .filter(days => days !== null && days >= 0 && days < 365); // Filter outliers

    if (prepTimes.length === 0) return 7; // Default estimate

    const avg = prepTimes.reduce((sum, t) => sum + t, 0) / prepTimes.length;
    return parseFloat(avg.toFixed(1));
  }

  /**
   * Analyze Amazon Seller Central format (standard export)
   */
  static async analyzeSellerCentralFormat(data, rateType) {
    console.log('Analyzing Seller Central format...');
    // Implement seller central specific parsing if needed
    return this.analyzeGenericFormat(data, rateType);
  }

  /**
   * Analyze generic shipment format (fallback)
   */
  static async analyzeGenericFormat(data, rateType) {
    console.log('Analyzing generic format...');

    const shipments = data.map(row => ({
      weight: parseFloat(row.Weight || row.weight || row.WEIGHT || 0),
      zone: parseInt(row.Zone || row.zone || row.ZONE || 5),
      cost: parseFloat(row.Cost || row.cost || row.COST || 0),
      state: row.State || row.state || row.STATE || 'Unknown'
    }));

    const totalShipments = shipments.length;
    const totalWeight = shipments.reduce((sum, s) => sum + s.weight, 0);
    const totalCost = shipments.reduce((sum, s) => sum + s.cost, 0);
    const avgWeight = totalWeight / totalShipments || 0;
    const avgCost = totalCost / totalShipments || 0;

    return {
      totalShipments,
      avgWeight: parseFloat(avgWeight.toFixed(2)),
      avgCost: totalCost > 0 ? parseFloat(avgCost.toFixed(2)) : 'Not available',
      analysisMonths: 1,
      dateRange: { start: 'Unknown', end: 'Unknown' },
      domesticVsInternational: {
        domestic: totalShipments,
        international: 0,
        domesticPercent: '100%',
        internationalPercent: '0%'
      },
      topStates: [],
      warehouseComparison: [],
      shippingMethods: [],
      weightDistribution: [],
      zoneDistribution: []
    };
  }
}

export default ReportAnalyzer;
