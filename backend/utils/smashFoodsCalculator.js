// ============================================================================
// SMASH FOODS CALCULATOR - ANALYSIS SHEET FORMULA VERSION
// This matches your manual Analysis (Pallet) sheet calculations EXACTLY
// File: backend/utils/smashFoodsCalculator.js
// ============================================================================

/**
 * SmashFoodsCalculator - UPDATED to match Analysis sheet formulas
 *
 * YOUR FORMULAS (from Analysis sheet):
 * - Pattern (DC to FBA) = Cuft × $2.625
 * - Internal (Whse to DC) = Cuft × $1.0138
 * - Freight Only = Pattern + Internal
 * - AMZ Prep Cost = Freight Only × 0.9014 (9.86% discount)
 * - Savings = Client Total - AMZ Prep Cost
 */
class SmashFoodsCalculator {

  constructor() {
    // CONSTANTS from your Analysis sheet
    this.CUFT_PER_PALLET = 67;
    this.AMZ_PREP_TRANSIT_DAYS = 6;

    // YOUR EXACT RATES from Analysis sheet
    this.PATTERN_RATE = 2.625;      // DC to FBA ($/cuft)
    this.INTERNAL_RATE = 1.0138;    // Whse to DC ($/cuft)
    this.DISCOUNT_FACTOR = 0.9014;  // 9.86% discount applied to get AMZ Prep Cost

    // Zone multipliers (not used in Analysis sheet, but keeping for compatibility)
    this.ZONE_MULTIPLIERS = {
      'FL': 1.2,  'GA': 1.15, 'PA': 1.1,  'TN': 1.05,
      'MI': 1.0,  'OH': 0.95, 'IL': 0.95
    };
  }

  /**
   * Calculate number of pallets from cubic feet
   */
  calculatePallets(cuft) {
    return cuft / this.CUFT_PER_PALLET;
  }

  /**
   * Calculate AMZ Prep costs using YOUR Analysis sheet formulas
   * @param {Array} shipments - Array of shipment objects
   * @param {Object} rates - IGNORED - uses Analysis sheet rates instead
   * @param {number} markup - IGNORED - Analysis sheet doesn't use markup
   * @returns {Object} - Detailed cost breakdown matching Analysis sheet
   */
  calculateAMZPrepCost(shipments, rates = null, markup = 0) {
    console.log('💡 Using Analysis (Pallet) sheet formulas');

    const totals = {
      patternCost: 0,      // DC to FBA
      internalCost: 0,     // Whse to DC
      freightOnlyCost: 0,  // Pattern + Internal
      amzPrepCost: 0,      // Freight Only × 0.9014
      totalCost: 0         // Same as amzPrepCost
    };

    const shipmentDetails = [];

    shipments.forEach(shipment => {
      // YOUR FORMULAS from Analysis sheet
      const patternCost = shipment.cuft * this.PATTERN_RATE;
      const internalCost = shipment.cuft * this.INTERNAL_RATE;
      const freightOnly = patternCost + internalCost;
      const amzPrepCost = freightOnly * this.DISCOUNT_FACTOR;

      // Add to totals
      totals.patternCost += patternCost;
      totals.internalCost += internalCost;
      totals.freightOnlyCost += freightOnly;
      totals.amzPrepCost += amzPrepCost;

      // Store shipment detail
      shipmentDetails.push({
        shipmentID: shipment.fbaShipmentID,
        cuft: shipment.cuft,
        patternCost: Math.round(patternCost * 100) / 100,
        internalCost: Math.round(internalCost * 100) / 100,
        freightOnlyCost: Math.round(freightOnly * 100) / 100,
        amzPrepCost: Math.round(amzPrepCost * 100) / 100
      });
    });

    // Total cost is the AMZ Prep Cost (with discount applied)
    totals.totalCost = totals.amzPrepCost;

    // Round all totals to 2 decimal places
    return {
      patternCost: Math.round(totals.patternCost * 100) / 100,
      internalCost: Math.round(totals.internalCost * 100) / 100,
      freightOnlyCost: Math.round(totals.freightOnlyCost * 100) / 100,
      amzPrepCost: Math.round(totals.amzPrepCost * 100) / 100,
      totalCost: Math.round(totals.totalCost * 100) / 100,
      shipmentDetails
    };
  }

  /**
   * Calculate current costs from vendor data
   */
  calculateCurrentCosts(shipments) {
    const totals = {
      totalFreight: 0,
      totalPlacementFees: 0,
      totalCost: 0
    };

    shipments.forEach(shipment => {
      totals.totalFreight += shipment.carrierCost;
      totals.totalPlacementFees += shipment.placementFees;
      totals.totalCost += shipment.currentTotalCost;
    });

    return {
      totalFreight: Math.round(totals.totalFreight * 100) / 100,
      totalPlacementFees: Math.round(totals.totalPlacementFees * 100) / 100,
      totalCost: Math.round(totals.totalCost * 100) / 100
    };
  }

  /**
   * Calculate savings between current and proposed costs
   */
  calculateSavings(currentCost, proposedCost) {
    const savingsAmount = currentCost - proposedCost;
    const savingsPercent = (savingsAmount / currentCost) * 100;

    return {
      amount: Math.round(savingsAmount * 100) / 100,
      percent: parseFloat(savingsPercent.toFixed(2)),
      currentTotal: Math.round(currentCost * 100) / 100,
      proposedTotal: Math.round(proposedCost * 100) / 100
    };
  }

  /**
   * Calculate cost per metrics
   */
  calculateCostPerMetrics(totalCost, totalCuft, totalUnits, totalPallets) {
    return {
      costPerCuft: totalCuft > 0 ? parseFloat((totalCost / totalCuft).toFixed(2)) : 0,
      costPerUnit: totalUnits > 0 ? parseFloat((totalCost / totalUnits).toFixed(2)) : 0,
      costPerPallet: totalPallets > 0 ? parseFloat((totalCost / totalPallets).toFixed(2)) : 0
    };
  }

  /**
   * Calculate transit time improvement
   */
  calculateTransitImprovement(currentAvgTransitDays) {
    if (!currentAvgTransitDays || isNaN(currentAvgTransitDays) || currentAvgTransitDays <= 0) {
      return {
        currentTransitDays: 0,
        amzPrepTransitDays: this.AMZ_PREP_TRANSIT_DAYS,
        improvementDays: 0,
        improvementPercent: 0
      };
    }

    const improvement = currentAvgTransitDays - this.AMZ_PREP_TRANSIT_DAYS;
    const improvementPercent = (improvement / currentAvgTransitDays) * 100;

    return {
      currentTransitDays: Math.round(currentAvgTransitDays),
      amzPrepTransitDays: this.AMZ_PREP_TRANSIT_DAYS,
      improvementDays: Math.max(0, Math.round(improvement)),
      improvementPercent: Math.max(0, parseFloat(improvementPercent.toFixed(2)))
    };
  }

  /**
   * Calculate state-based costs breakdown
   */
  calculateStateBreakdown(shipments) {
    const stateData = {};

    shipments.forEach(shipment => {
      const state = shipment.destinationState;

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
      stateData[state].units += shipment.units;
      stateData[state].pallets += shipment.calculatedPallets;
      stateData[state].cuft += shipment.cuft;
      stateData[state].currentCost += shipment.currentTotalCost;
      stateData[state].avgTransitDays += shipment.transitDays;
    });

    // Calculate averages and round
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
   * Calculate comprehensive comparison using Analysis sheet formulas
   */
  calculateComprehensiveComparison(shipments, rates = null, markup = 0) {
    console.log('📊 Calculating costs using Analysis (Pallet) sheet formulas');

    // Current costs
    const currentCosts = this.calculateCurrentCosts(shipments);

    // Proposed AMZ Prep costs (using YOUR formulas)
    const proposedCosts = this.calculateAMZPrepCost(shipments, rates, markup);

    // Calculate totals
    const totalPallets = shipments.reduce((sum, s) => sum + s.calculatedPallets, 0);
    const totalCuft = shipments.reduce((sum, s) => sum + s.cuft, 0);
    const totalUnits = shipments.reduce((sum, s) => sum + s.units, 0);

    // Cost per metrics
    const currentMetrics = this.calculateCostPerMetrics(
      currentCosts.totalCost,
      totalCuft,
      totalUnits,
      totalPallets
    );

    const proposedMetrics = this.calculateCostPerMetrics(
      proposedCosts.totalCost,
      totalCuft,
      totalUnits,
      totalPallets
    );

    // Savings
    const savings = this.calculateSavings(
      currentCosts.totalCost,
      proposedCosts.totalCost
    );

    // Transit improvement
    const avgTransitDays = shipments.reduce((sum, s) => sum + s.transitDays, 0) / shipments.length;
    const transitImprovement = this.calculateTransitImprovement(avgTransitDays);

    // State breakdown
    const stateBreakdown = this.calculateStateBreakdown(shipments);

    console.log(`✅ Analysis sheet calculation complete:`);
    console.log(`   Current Total: $${currentCosts.totalCost.toFixed(2)}`);
    console.log(`   AMZ Prep Total: $${proposedCosts.totalCost.toFixed(2)}`);
    console.log(`   Savings: $${savings.amount.toFixed(2)} (${savings.percent.toFixed(2)}%)`);

    return {
      currentCosts,
      currentMetrics,
      proposedCosts,
      proposedMetrics,
      savings,
      transitImprovement,
      stateBreakdown
    };
  }
}

export default SmashFoodsCalculator;
