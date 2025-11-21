// ============================================================================
// MIDDLE MILE CALCULATOR - SOP COMPLIANT VERSION
// File: backend/utils/middleMileCalculatorSOP.js
// ============================================================================

class MiddleMileCalculatorSOP {

  constructor() {
    // Pattern Rate Card (from SOP Page 2)
    this.PATTERN_RATES = {
      'Las Vegas': {
        'Standard': 3.75,
        'Oversize': 5.00,
        'Hazmat': 7.00
      },
      'Hebron, KY': {
        'Standard': 2.75,
        'Oversize': 4.00,
        'Hazmat': 6.00
      }
    };

    // Constants from SOP
    this.CUFT_PER_PALLET = 67;
    this.CUFT_PER_FTL = 1742;
    this.PALLETS_PER_FTL = 26;
    this.INTERNAL_TRANSFER_MARKUP = 1.20; // 20% markup

    this.DEFAULT_FTL_COST = 3000;
    this.DEFAULT_PALLET_COST = 150;
  }

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

  selectWarehouse(shipToZip) {
    if (!shipToZip) return 'Hebron, KY';

    const zipNum = parseInt(String(shipToZip).replace(/\D/g, ''));
    if (isNaN(zipNum)) return 'Hebron, KY';

    // East < 50000 → KY, West >= 50000 → Vegas
    return zipNum < 50000 ? 'Hebron, KY' : 'Las Vegas';
  }

  calculateMM(cuft, warehouse, shipmentType) {
    const rate = this.PATTERN_RATES[warehouse]?.[shipmentType];

    if (!rate) {
      console.warn(`⚠️ No rate for ${warehouse} - ${shipmentType}`);
      return cuft * this.PATTERN_RATES[warehouse]['Standard'];
    }

    return cuft * rate;
  }

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

  calculateMMCostPT(pallets, cuft, ftlCost, basePatternRate) {
    const palletComponent = (ftlCost / this.PALLETS_PER_FTL) * pallets;
    const cuftComponent = cuft * basePatternRate;
    return palletComponent + cuftComponent;
  }

  calculateTotalFreightCost(mmCost, internalTransferCost) {
    return mmCost + internalTransferCost;
  }

  calculateMerchantSavings(clientTotalFees, totalFreightCost) {
    return clientTotalFees - totalFreightCost;
  }

  calculateClientTotal(placementFee, carrierCost) {
    return (placementFee || 0) + (carrierCost || 0);
  }

  calculateShipmentCosts(shipment, config = {}) {
    const {
      ftlCost = this.DEFAULT_FTL_COST,
      palletCost = this.DEFAULT_PALLET_COST,
      useFTL = true,
    } = config;

    const pallets = shipment.cuft / this.CUFT_PER_PALLET;
    const shipmentType = this.determineShipmentType(shipment);
    const warehouse = this.selectWarehouse(shipment.shipToZip);
    const patternRate = this.PATTERN_RATES[warehouse][shipmentType];

    const clientTotal = this.calculateClientTotal(
      shipment.placementFees,
      shipment.carrierCost
    );

    const mmCost = this.calculateMM(shipment.cuft, warehouse, shipmentType);
    const internalTransferCost = this.calculateInternalTransfer(
      shipment.cuft, ftlCost, palletCost, useFTL
    );
    const totalFreightCost = this.calculateTotalFreightCost(mmCost, internalTransferCost);
    const mmCostPT = this.calculateMMCostPT(pallets, shipment.cuft, ftlCost, patternRate);
    const merchantSavings = this.calculateMerchantSavings(clientTotal, totalFreightCost);

    return {
      shipmentID: shipment.fbaShipmentID,
      shipmentName: shipment.shipmentName,
      cuft: shipment.cuft,
      pallets: Math.round(pallets * 100) / 100,
      warehouse,
      shipmentType,
      patternRate,
      clientPlacementFee: shipment.placementFees || 0,
      clientCarrierCost: shipment.carrierCost || 0,
      clientTotal: Math.round(clientTotal * 100) / 100,
      mmCost: Math.round(mmCost * 100) / 100,
      internalTransferCost: Math.round(internalTransferCost * 100) / 100,
      totalFreightCost: Math.round(totalFreightCost * 100) / 100,
      mmCostPT: Math.round(mmCostPT * 100) / 100,
      merchantSavings: Math.round(merchantSavings * 100) / 100,
      savingsPercent: clientTotal > 0 ?
        Math.round((merchantSavings / clientTotal) * 10000) / 100 : 0
    };
  }

  calculateBulkShipments(shipments, config = {}) {
    console.log(`\n📊 SOP-COMPLIANT CALCULATION (${shipments.length} shipments)`);

    const results = shipments.map(s => this.calculateShipmentCosts(s, config));

    const summary = {
      totalShipments: results.length,
      totalCuft: results.reduce((sum, r) => sum + r.cuft, 0),
      totalPallets: results.reduce((sum, r) => sum + r.pallets, 0),
      totalClientPlacementFee: results.reduce((sum, r) => sum + r.clientPlacementFee, 0),
      totalClientCarrierCost: results.reduce((sum, r) => sum + r.clientCarrierCost, 0),
      totalClientCost: results.reduce((sum, r) => sum + r.clientTotal, 0),
      totalMM: results.reduce((sum, r) => sum + r.mmCost, 0),
      totalInternalTransfer: results.reduce((sum, r) => sum + r.internalTransferCost, 0),
      totalFreightCost: results.reduce((sum, r) => sum + r.totalFreightCost, 0),
      totalMMCostPT: results.reduce((sum, r) => sum + r.mmCostPT, 0),
      totalMerchantSavings: results.reduce((sum, r) => sum + r.merchantSavings, 0)
    };

    summary.savingsPercent = summary.totalClientCost > 0 ?
      Math.round((summary.totalMerchantSavings / summary.totalClientCost) * 10000) / 100 : 0;

    Object.keys(summary).forEach(key => {
      if (typeof summary[key] === 'number' && !key.includes('Percent') && !key.includes('total')) {
        summary[key] = Math.round(summary[key] * 100) / 100;
      }
    });

    const warehouseBreakdown = {};
    results.forEach(r => {
      if (!warehouseBreakdown[r.warehouse]) {
        warehouseBreakdown[r.warehouse] = {
          shipmentCount: 0,
          totalCuft: 0,
          totalMM: 0,
          totalIT: 0,
          totalCost: 0
        };
      }
      warehouseBreakdown[r.warehouse].shipmentCount++;
      warehouseBreakdown[r.warehouse].totalCuft += r.cuft;
      warehouseBreakdown[r.warehouse].totalMM += r.mmCost;
      warehouseBreakdown[r.warehouse].totalIT += r.internalTransferCost;
      warehouseBreakdown[r.warehouse].totalCost += r.totalFreightCost;
    });

    const typeBreakdown = {};
    results.forEach(r => {
      if (!typeBreakdown[r.shipmentType]) {
        typeBreakdown[r.shipmentType] = {
          shipmentCount: 0,
          totalCuft: 0,
          totalCost: 0,
          avgRate: 0
        };
      }
      typeBreakdown[r.shipmentType].shipmentCount++;
      typeBreakdown[r.shipmentType].totalCuft += r.cuft;
      typeBreakdown[r.shipmentType].totalCost += r.totalFreightCost;
    });

    Object.keys(typeBreakdown).forEach(type => {
      typeBreakdown[type].avgRate = typeBreakdown[type].totalCuft > 0 ?
        Math.round((typeBreakdown[type].totalCost / typeBreakdown[type].totalCuft) * 100) / 100 : 0;
    });

    console.log(`✅ Current: $${summary.totalClientCost.toFixed(2)} | Proposed: $${summary.totalFreightCost.toFixed(2)} | Savings: $${summary.totalMerchantSavings.toFixed(2)}\n`);

    return {
      summary,
      shipmentDetails: results,
      warehouseBreakdown,
      typeBreakdown,
      config,
      method: 'SOP_COMPLIANT'
    };
  }

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
