// ============================================================================
// MIDDLE MILE CALCULATOR - SOP COMPLIANT VERSION WITH CORRECT FORMULAS
// File: backend/utils/middleMileCalculatorSOP.js
//
// FIX: Corrected Total Freight Cost calculation to match pivot table
// Total Freight Cost = MM + Internal Transfer (NOT the per-shipment freight)
// ============================================================================

class MiddleMileCalculatorSOP {

  constructor() {
    // Default Pattern Rate Card (from Excel analysis)
    // Excel shows $2.63 in header, but exact calculation gives $2.625/cuft
    // (37032.36 / 14107.57 = 2.6249...)
    this.DEFAULT_PATTERN_RATES = {
      'Las Vegas': {
        'Standard': 3.75,
        'Oversize': 5.00,
        'Hazmat': 7.00
      },
      'Hebron, KY': {
        'Standard': 2.625,  // ✅ EXACT: 37032.36 / 14107.57 = 2.625
        'Oversize': 4.00,
        'Hazmat': 6.00
      }
    };

    // Backward compatibility - keep old reference
    this.PATTERN_RATES = this.DEFAULT_PATTERN_RATES;

    // Constants from SOP
    this.CUFT_PER_PALLET = 67;
    this.CUFT_PER_FTL = 1742;
    this.PALLETS_PER_FTL = 26;

    // Defaults (can be overridden via config)
    this.DEFAULT_FTL_COST = 3000;
    this.DEFAULT_PALLET_COST = 150;
    this.DEFAULT_INTERNAL_TRANSFER_MARKUP = 1.20;  // 20% markup
    this.DEFAULT_MM_MARKUP = 1.0;  // No markup by default

    // Keep old reference for backward compatibility
    this.INTERNAL_TRANSFER_MARKUP = this.DEFAULT_INTERNAL_TRANSFER_MARKUP;
  }

  /**
   * Determine shipment type based on hazmat and weight
   */
  determineShipmentType(shipment) {
    // Priority: Hazmat > Oversize > Standard
    if (shipment.containsHazmat ||
        (shipment.hazmatProductCount && shipment.hazmatProductCount > 0)) {
      return 'Hazmat';
    }

    if (shipment.weight && shipment.weight > 50) {
      return 'Oversize';
    }

    return 'Standard';
  }

  /**
   * Select warehouse based on ZIP code (East/West routing)
   */
  selectWarehouse(shipToZip) {
    if (!shipToZip) return 'Hebron, KY';

    const zipNum = parseInt(String(shipToZip).replace(/\D/g, ''));
    if (isNaN(zipNum)) return 'Hebron, KY';

    // East < 50000 → KY, West >= 50000 → Vegas
    return zipNum < 50000 ? 'Hebron, KY' : 'Las Vegas';
  }

  /**
   * Calculate shipment costs with fully dynamic configuration
   *
   * CORRECTED FORMULAS (matching pivot table):
   * - MM = Cuft × Pattern Rate (varies by type: $2.75-$7.00)
   * - Internal Transfer = Cuft × (FTL Cost × Markup / 1742)
   * - Total Freight Cost = MM + Internal Transfer
   * - MM Cost PT = (FTL Cost / 26 × Pallets) + (Cuft × Base Pattern Rate)
   */
  calculateShipmentCostsWithConfig(shipment, config = {}) {
    // Extract config with defaults
    const {
      freightCost = this.DEFAULT_FTL_COST,
      freightMarkup = this.DEFAULT_INTERNAL_TRANSFER_MARKUP,
      mmBaseCost = null,  // If null, use pattern rates
      mmMarkup = this.DEFAULT_MM_MARKUP,
      rateMode = 'FTL',   // 'FTL' or 'PALLET'
      destination = null, // 'KY' or 'VEGAS' - if null, auto-detect
      palletCost = this.DEFAULT_PALLET_COST
    } = config;

    const cuft = shipment.cuft || 0;
    const pallets = cuft / this.CUFT_PER_PALLET;
    const shipmentType = this.determineShipmentType(shipment);

    // Determine warehouse (manual override or auto-detect from ZIP)
    let warehouse;
    if (destination) {
      warehouse = destination === 'VEGAS' ? 'Las Vegas' : 'Hebron, KY';
    } else {
      warehouse = this.selectWarehouse(shipment.shipToZip);
    }

    // Get pattern rate (custom or default from rate card)
    const basePatternRate = mmBaseCost !== null
      ? mmBaseCost
      : (this.DEFAULT_PATTERN_RATES[warehouse]?.[shipmentType] || 2.75);

    // Apply MM markup to get effective rate
    const effectivePatternRate = basePatternRate * mmMarkup;

    // =========================================================================
    // CORRECTED CALCULATIONS (matching pivot table formulas)
    // =========================================================================

    // MM = Cuft × Effective Pattern Rate
    // Example: 14,107.57 cuft × $2.625 = $37,032.36
    const mmCost = cuft * effectivePatternRate;

    // Calculate marked-up freight cost (for internal transfer calculation)
    // Example: $1315 × 1.2 = $1578
    const markedUpFreightCost = freightCost * freightMarkup;

    // Internal Transfer = Cuft × (Marked Up Freight Cost / 1742)
    // Example: 14,107.57 × ($1578 / 1742) = 14,107.57 × 0.9059 = $12,779.41
    let internalTransferCost;
    let internalTransferRatePerCuft;

    if (rateMode === 'FTL') {
      internalTransferRatePerCuft = markedUpFreightCost / this.CUFT_PER_FTL;
      internalTransferCost = cuft * internalTransferRatePerCuft;
    } else {
      // Pallet mode: (Pallet Cost * Markup) / 67 cuft per pallet
      const effectivePalletCost = palletCost * freightMarkup;
      internalTransferRatePerCuft = effectivePalletCost / this.CUFT_PER_PALLET;
      internalTransferCost = cuft * internalTransferRatePerCuft;
    }

    // ✅ FIXED: Total Freight Cost = MM + Internal Transfer
    // This is what the client pays through AMZ Prep
    // Example: $37,032.36 + $12,779.41 = $49,811.77
    const totalFreightCost = mmCost + internalTransferCost;

    // Client costs (from their current Amazon charges)
    const clientPlacementFee = shipment.placementFees || 0;
    const clientCarrierCost = shipment.carrierCost || 0;
    const clientTotal = clientPlacementFee + clientCarrierCost;

    // MM Cost PT = (FTL Cost / 26 × Pallets) + (Cuft × $2.50)
    // This is what AMZ Prep pays to Pattern
    // ✅ FIXED: Excel uses FIXED $2.50 rate for MM Cost PT (not the configurable MM rate)
    // Formula from Excel: =($AE$1/26)*T3+(U3*2.5)
    // Example: ($1315 / 26 × 210.56) + (14,107.57 × $2.50) = $10,654.32 + $35,268.93 = $45,923.25
    const MM_COST_PT_RATE = 2.50;  // Fixed rate used by Pattern for their cost
    const mmCostPT = (freightCost / this.PALLETS_PER_FTL) * pallets + (cuft * MM_COST_PT_RATE);

    // Total proposed cost for the client = Total Freight Cost
    const totalProposedCost = totalFreightCost;

    // Merchant savings = What client currently pays - What they'd pay with AMZ Prep
    const merchantSavings = clientTotal - totalProposedCost;

    return {
      // Shipment identification
      shipmentID: shipment.fbaShipmentID,
      shipmentName: shipment.shipmentName,

      // Volume metrics
      cuft: cuft,
      pallets: Math.round(pallets * 100) / 100,

      // Configuration that was used
      configUsed: {
        warehouse,
        shipmentType,
        rateMode,
        freightCost,
        freightMarkup,
        mmBaseCost: basePatternRate,
        mmMarkup,
        effectivePatternRate,
        palletCost: rateMode === 'PALLET' ? palletCost : null
      },

      // Client costs (current Amazon charges)
      clientPlacementFee: Math.round(clientPlacementFee * 100) / 100,
      clientCarrierCost: Math.round(clientCarrierCost * 100) / 100,
      clientTotal: Math.round(clientTotal * 100) / 100,

      // ✅ CORRECTED: Calculated costs (matching pivot table columns)
      mmCost: Math.round(mmCost * 100) / 100,                              // Column: MM
      internalTransferCost: Math.round(internalTransferCost * 100) / 100,  // Column: INTERNAL TRANSFER
      totalFreightCost: Math.round(totalFreightCost * 100) / 100,          // Column: TOTAL FREIGHT COST (MM + IT)
      mmCostPT: Math.round(mmCostPT * 100) / 100,                          // Column: MM COST PT

      // Per cuft rates for reference
      mmRatePerCuft: Math.round(effectivePatternRate * 10000) / 10000,
      internalTransferRatePerCuft: Math.round(internalTransferRatePerCuft * 10000) / 10000,

      // Totals and savings
      totalProposedCost: Math.round(totalProposedCost * 100) / 100,
      merchantSavings: Math.round(merchantSavings * 100) / 100,
      savingsPercent: clientTotal > 0
        ? Math.round((merchantSavings / clientTotal) * 10000) / 100
        : 0
    };
  }

  /**
   * Bulk calculation with dynamic configuration
   */
  calculateBulkShipmentsWithConfig(shipments, config = {}) {
    console.log(`\n📊 SOP-COMPLIANT CALCULATION WITH DYNAMIC CONFIG`);
    console.log(`   Shipments: ${shipments.length}`);
    console.log(`   Rate Mode: ${config.rateMode || 'FTL'}`);
    console.log(`   Freight Cost: $${config.freightCost || this.DEFAULT_FTL_COST}`);
    console.log(`   Freight Markup: ${config.freightMarkup || this.DEFAULT_INTERNAL_TRANSFER_MARKUP}`);
    console.log(`   MM Base Cost: ${config.mmBaseCost || 'Auto (Pattern Rates)'}`);
    console.log(`   MM Markup: ${config.mmMarkup || this.DEFAULT_MM_MARKUP}`);

    // Calculate each shipment with the config
    const results = shipments.map(s => this.calculateShipmentCostsWithConfig(s, config));

    // ✅ CORRECTED: Sum all values properly (not taking first element's value)
    const summary = {
      totalShipments: results.length,
      totalCuft: results.reduce((sum, r) => sum + r.cuft, 0),
      totalPallets: results.reduce((sum, r) => sum + r.pallets, 0),

      // Client costs (current)
      totalClientPlacementFee: results.reduce((sum, r) => sum + r.clientPlacementFee, 0),
      totalClientCarrierCost: results.reduce((sum, r) => sum + r.clientCarrierCost, 0),
      totalClientCost: results.reduce((sum, r) => sum + r.clientTotal, 0),

      // ✅ CORRECTED: Proposed costs (all summed properly)
      totalMM: results.reduce((sum, r) => sum + r.mmCost, 0),
      totalInternalTransfer: results.reduce((sum, r) => sum + r.internalTransferCost, 0),

      // ✅ FIXED: Total Freight Cost = SUM of all shipment totalFreightCost
      // This is MM + Internal Transfer for all shipments
      totalFreightCost: results.reduce((sum, r) => sum + r.totalFreightCost, 0),

      // Total proposed is same as total freight cost
      totalProposedCost: results.reduce((sum, r) => sum + r.totalProposedCost, 0),

      // MM Cost PT (what AMZ Prep pays)
      totalMMCostPT: results.reduce((sum, r) => sum + r.mmCostPT, 0),

      // Savings
      totalMerchantSavings: results.reduce((sum, r) => sum + r.merchantSavings, 0),

      // Configuration used (for audit trail)
      configUsed: {
        freightCost: config.freightCost || this.DEFAULT_FTL_COST,
        freightMarkup: config.freightMarkup || this.DEFAULT_INTERNAL_TRANSFER_MARKUP,
        mmBaseCost: config.mmBaseCost || null,
        mmMarkup: config.mmMarkup || this.DEFAULT_MM_MARKUP,
        rateMode: config.rateMode || 'FTL',
        destination: config.destination || null,
        palletCost: config.palletCost || this.DEFAULT_PALLET_COST
      }
    };

    // Calculate savings percent
    summary.savingsPercent = summary.totalClientCost > 0
      ? Math.round((summary.totalMerchantSavings / summary.totalClientCost) * 10000) / 100
      : 0;

    // Round all numeric totals
    Object.keys(summary).forEach(key => {
      if (typeof summary[key] === 'number' && !key.includes('Percent') && !key.includes('Shipments')) {
        summary[key] = Math.round(summary[key] * 100) / 100;
      }
    });

    // Warehouse breakdown
    const warehouseBreakdown = {};
    results.forEach(r => {
      const wh = r.configUsed.warehouse;
      if (!warehouseBreakdown[wh]) {
        warehouseBreakdown[wh] = {
          shipmentCount: 0,
          totalCuft: 0,
          totalMM: 0,
          totalIT: 0,
          totalCost: 0
        };
      }
      warehouseBreakdown[wh].shipmentCount++;
      warehouseBreakdown[wh].totalCuft += r.cuft;
      warehouseBreakdown[wh].totalMM += r.mmCost;
      warehouseBreakdown[wh].totalIT += r.internalTransferCost;
      warehouseBreakdown[wh].totalCost += r.totalProposedCost;
    });

    // Type breakdown
    const typeBreakdown = {};
    results.forEach(r => {
      const type = r.configUsed.shipmentType;
      if (!typeBreakdown[type]) {
        typeBreakdown[type] = {
          shipmentCount: 0,
          totalCuft: 0,
          totalCost: 0,
          avgRate: 0
        };
      }
      typeBreakdown[type].shipmentCount++;
      typeBreakdown[type].totalCuft += r.cuft;
      typeBreakdown[type].totalCost += r.totalProposedCost;
    });

    // Calculate average rates
    Object.keys(typeBreakdown).forEach(type => {
      typeBreakdown[type].avgRate = typeBreakdown[type].totalCuft > 0
        ? Math.round((typeBreakdown[type].totalCost / typeBreakdown[type].totalCuft) * 100) / 100
        : 0;
    });

    console.log(`\n✅ Calculation Complete:`);
    console.log(`   Total Cuft: ${summary.totalCuft.toFixed(2)}`);
    console.log(`   Client Total: $${summary.totalClientCost.toFixed(2)}`);
    console.log(`   MM (Middle Mile): $${summary.totalMM.toFixed(2)}`);
    console.log(`   Internal Transfer: $${summary.totalInternalTransfer.toFixed(2)}`);
    console.log(`   Total Freight Cost (MM + IT): $${summary.totalFreightCost.toFixed(2)}`);
    console.log(`   MM Cost PT (AMZ Prep Cost): $${summary.totalMMCostPT.toFixed(2)}`);
    console.log(`   Savings: $${summary.totalMerchantSavings.toFixed(2)} (${summary.savingsPercent}%)`);

    return {
      summary,
      shipmentDetails: results,
      warehouseBreakdown,
      typeBreakdown,
      config: summary.configUsed,
      method: 'SOP_COMPLIANT_DYNAMIC'
    };
  }

  // ============================================================================
  // BACKWARD COMPATIBILITY - Keep existing methods working
  // ============================================================================

  /**
   * Original method - kept for backward compatibility
   * Internally uses the new method with default config
   */
  calculateShipmentCosts(shipment, config = {}) {
    // Convert old config format to new format
    const newConfig = {
      freightCost: config.ftlCost || this.DEFAULT_FTL_COST,
      freightMarkup: this.INTERNAL_TRANSFER_MARKUP,
      palletCost: config.palletCost || this.DEFAULT_PALLET_COST,
      rateMode: config.useFTL !== false ? 'FTL' : 'PALLET',
      mmBaseCost: null,  // Use pattern rates
      mmMarkup: 1.0
    };

    return this.calculateShipmentCostsWithConfig(shipment, newConfig);
  }

  /**
   * Original bulk method - kept for backward compatibility
   */
  calculateBulkShipments(shipments, config = {}) {
    // Convert old config format to new format
    const newConfig = {
      freightCost: config.ftlCost || this.DEFAULT_FTL_COST,
      freightMarkup: this.INTERNAL_TRANSFER_MARKUP,
      palletCost: config.palletCost || this.DEFAULT_PALLET_COST,
      rateMode: config.useFTL !== false ? 'FTL' : 'PALLET',
      mmBaseCost: null,
      mmMarkup: 1.0
    };

    return this.calculateBulkShipmentsWithConfig(shipments, newConfig);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Calculate MM cost for a given cuft and config
   */
  calculateMM(cuft, warehouse, shipmentType) {
    const rate = this.PATTERN_RATES[warehouse]?.[shipmentType];
    if (!rate) {
      console.warn(`⚠️ No rate for ${warehouse} - ${shipmentType}`);
      return cuft * this.PATTERN_RATES[warehouse]['Standard'];
    }
    return cuft * rate;
  }

  /**
   * Calculate Internal Transfer
   */
  calculateInternalTransfer(cuft, ftlCost = null, palletCost = null, useFTL = true) {
    let baseRatePerCuft;

    if (useFTL) {
      const cost = ftlCost || this.DEFAULT_FTL_COST;
      baseRatePerCuft = (cost / this.CUFT_PER_FTL) * this.INTERNAL_TRANSFER_MARKUP;
    } else {
      const cost = palletCost || this.DEFAULT_PALLET_COST;
      baseRatePerCuft = (cost / this.CUFT_PER_PALLET) * this.INTERNAL_TRANSFER_MARKUP;
    }

    return cuft * baseRatePerCuft;
  }

  /**
   * Get the rate card (for display purposes)
   */
  getRateCard() {
    return {
      patternRates: this.PATTERN_RATES,
      constants: {
        cuftPerPallet: this.CUFT_PER_PALLET,
        cuftPerFTL: this.CUFT_PER_FTL,
        palletsPerFTL: this.PALLETS_PER_FTL,
        internalTransferMarkup: this.INTERNAL_TRANSFER_MARKUP
      },
      defaults: {
        ftlCost: this.DEFAULT_FTL_COST,
        palletCost: this.DEFAULT_PALLET_COST
      }
    };
  }
}

export default MiddleMileCalculatorSOP;
