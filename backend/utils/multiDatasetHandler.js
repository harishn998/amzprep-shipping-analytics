// ============================================================================
// MULTI-DATASET HANDLER FOR DIFFERENT RATE TYPES
// File: backend/utils/multiDatasetHandler.js
// ============================================================================

import XLSX from 'xlsx';
import AmazonRateEnhanced from '../models/AmazonRateEnhanced.js';

/**
 * This handler allows you to provide different datasets (like Smash Foods)
 * for different rate types, and the system will:
 * 1. Auto-detect which rate type the data represents
 * 2. Parse accordingly
 * 3. Use the appropriate active rate for calculations
 */

class MultiDatasetHandler {

  /**
   * Main entry point: Analyze uploaded file and determine what type of data it contains
   *
   * @param {string} filePath - Path to uploaded Excel/CSV file
   * @param {string} userSpecifiedRateType - Optional rate type hint from user
   * @returns {Object} - Parsed data with detected rate type
   */
  static async analyzeDataset(filePath, userSpecifiedRateType = null) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      throw new Error('No data found in uploaded file');
    }

    // Detect what type of data this is
    const dataType = this.detectDataType(data[0], userSpecifiedRateType);

    console.log(`Detected data type: ${dataType}`);

    let parsedData;
    switch (dataType) {
      case 'shipment_analysis':
        // Like Smash Foods - shipment data for analysis
        parsedData = await this.parseShipmentData(data, userSpecifiedRateType || 'combined');
        break;

      case 'prep_costs':
        // Prep cost data - itemized costs per operation
        parsedData = await this.parsePrepCostData(data);
        break;

      case 'middleMile_shipments':
        // Middle-mile specific shipments (LTL/FTL focus)
        parsedData = await this.parseMiddleMileData(data);
        break;

      case 'fba_parcel':
        // FBA parcel shipment data
        parsedData = await this.parseFBAParcelData(data);
        break;

      default:
        throw new Error(`Unknown data type: ${dataType}`);
    }

    return {
      dataType,
      ...parsedData
    };
  }

  /**
   * Detect what type of data the file contains based on columns
   */
  static detectDataType(firstRow, userHint) {
    const headers = Object.keys(firstRow).map(h => h.toLowerCase());

    // If user provides hint, validate it matches data
    if (userHint) {
      return this.validateUserHint(headers, userHint);
    }

    // Auto-detection logic

    // Smash Foods type - shipment analysis data
    if (headers.includes('shipment id') && headers.includes('destination fulfillment center id')) {
      return 'shipment_analysis';
    }

    // Prep cost itemization
    if (headers.includes('sku') && headers.includes('prep type') && headers.includes('cost')) {
      return 'prep_costs';
    }

    // Middle-mile LTL/FTL data
    if (headers.includes('carrier') && headers.includes('truck type') && headers.includes('pallets')) {
      return 'middleMile_shipments';
    }

    // FBA parcel data
    if (headers.includes('tracking number') && headers.includes('zone') && headers.includes('weight')) {
      return 'fba_parcel';
    }

    // Default to shipment analysis
    return 'shipment_analysis';
  }

  /**
   * Validate user's rate type hint matches data structure
   */
  static validateUserHint(headers, userHint) {
    const typeIndicators = {
      prep: ['prep', 'sku', 'unit'],
      middleMile: ['truck', 'ltl', 'ftl', 'pallet', 'carrier'],
      fbaShipment: ['zone', 'tracking', 'parcel'],
      combined: ['shipment', 'destination']
    };

    const indicators = typeIndicators[userHint] || [];
    const hasIndicators = indicators.some(ind =>
      headers.some(h => h.includes(ind))
    );

    if (!hasIndicators) {
      console.warn(`User specified ${userHint} but data doesn't match. Auto-detecting...`);
      return null; // Fall back to auto-detection
    }

    // Map user hint to data type
    const hintToType = {
      prep: 'prep_costs',
      middleMile: 'middleMile_shipments',
      fbaShipment: 'fba_parcel',
      combined: 'shipment_analysis'
    };

    return hintToType[userHint] || 'shipment_analysis';
  }

  /**
   * Parse shipment analysis data (like Smash Foods)
   * This uses all available rate types for comparison
   */
  static async parseShipmentData(data, rateType) {
    console.log('Parsing as shipment analysis data');

    const shipments = data.map(row => ({
      shipmentId: row['Shipment ID'] || row['shipment id'],
      units: parseInt(row['Units'] || row['units'] || 0),
      pallets: parseInt(row['Pallets'] || row['pallets'] || 0),
      volume: parseFloat(row['Volume'] || row['volume'] || 0),
      weight: parseFloat(row['Weight'] || row['weight'] || 0),
      destinationState: this.extractState(row['Destination Fulfillment Center Address'] || ''),
      carrier: row['Carrier'] || row['carrier'],
      transportMode: row['Transportation option'] || row['transportation option'],
      placementFee: parseFloat(row['Placement service fee'] || 0),
      freight: parseFloat(row['Estimated freight cost ($)'] || 0)
    }));

    // Calculate totals
    const totals = {
      units: shipments.reduce((sum, s) => sum + s.units, 0),
      pallets: shipments.reduce((sum, s) => sum + s.pallets, 0),
      volume: shipments.reduce((sum, s) => sum + s.volume, 0),
      weight: shipments.reduce((sum, s) => sum + s.weight, 0),
      placementFees: shipments.reduce((sum, s) => sum + s.placementFee, 0),
      freight: shipments.reduce((sum, s) => sum + s.freight, 0)
    };

    // Get active rates for calculation
    const rates = await this.getActiveRates(rateType);

    // Calculate costs with each rate type
    const calculations = await this.calculateWithMultipleRates(shipments, totals, rates);

    return {
      shipments,
      totals,
      calculations,
      rateType
    };
  }

  /**
   * Parse prep cost specific data
   * Data contains itemized prep operations and costs
   */
  static async parsePrepCostData(data) {
    console.log('Parsing as prep cost data');

    const prepOperations = data.map(row => ({
      sku: row['SKU'] || row['sku'],
      prepType: row['Prep Type'] || row['prepType'],
      units: parseInt(row['Units'] || row['units'] || 0),
      costPerUnit: parseFloat(row['Cost Per Unit'] || row['costPerUnit'] || 0),
      totalCost: parseFloat(row['Total Cost'] || row['totalCost'] || 0)
    }));

    const totalCost = prepOperations.reduce((sum, op) => sum + op.totalCost, 0);
    const totalUnits = prepOperations.reduce((sum, op) => sum + op.units, 0);

    // Get active prep rate for comparison
    const prepRate = await AmazonRateEnhanced.getActiveRate('prep');

    let proposedCost = 0;
    if (prepRate) {
      const calculation = prepRate.calculatePrepCost({
        units: totalUnits,
        skus: new Set(prepOperations.map(op => op.sku)).size,
        pallets: Math.ceil(totalUnits / 1500) // Estimate
      });
      proposedCost = calculation.totalCost;
    }

    return {
      prepOperations,
      currentTotal: totalCost,
      proposedTotal: proposedCost,
      savings: totalCost - proposedCost,
      rateType: 'prep'
    };
  }

  /**
   * Parse middle-mile specific data (LTL/FTL focus)
   */
  static async parseMiddleMileData(data) {
    console.log('Parsing as middle-mile shipment data');

    const shipments = data.map(row => ({
      shipmentId: row['Shipment ID'] || row['shipmentId'],
      carrier: row['Carrier'] || row['carrier'],
      truckType: row['Truck Type'] || row['truckType'] || 'LTL',
      pallets: parseInt(row['Pallets'] || row['pallets'] || 0),
      weight: parseFloat(row['Weight'] || row['weight'] || 0),
      origin: row['Origin'] || row['origin'],
      destination: row['Destination'] || row['destination'],
      destinationState: this.extractState(row['Destination'] || ''),
      cost: parseFloat(row['Cost'] || row['cost'] || 0),
      transitDays: parseInt(row['Transit Days'] || row['transitDays'] || 0)
    }));

    const totalCost = shipments.reduce((sum, s) => sum + s.cost, 0);
    const totalPallets = shipments.reduce((sum, s) => sum + s.pallets, 0);
    const avgTransitDays = shipments.reduce((sum, s) => sum + s.transitDays, 0) / shipments.length;

    // Get active middle-mile rate
    const middleMileRate = await AmazonRateEnhanced.getActiveRate('middleMile');

    let proposedCost = 0;
    if (middleMileRate) {
      // Calculate for each destination
      for (const shipment of shipments) {
        try {
          const calc = middleMileRate.calculateMiddleMileCost({
            shipmentType: shipment.truckType,
            pallets: shipment.pallets,
            weight: shipment.weight,
            destinationState: shipment.destinationState
          });
          proposedCost += calc.totalCost;
        } catch (err) {
          console.warn(`Could not calculate for shipment ${shipment.shipmentId}:`, err.message);
        }
      }
    }

    return {
      shipments,
      currentTotal: totalCost,
      proposedTotal: proposedCost,
      savings: totalCost - proposedCost,
      avgTransitDays,
      totalPallets,
      rateType: 'middleMile'
    };
  }

  /**
   * Parse FBA parcel specific data
   */
  static async parseFBAParcelData(data) {
    console.log('Parsing as FBA parcel shipment data');

    const parcels = data.map(row => ({
      trackingNumber: row['Tracking Number'] || row['trackingNumber'],
      zone: parseInt(row['Zone'] || row['zone'] || 5),
      weight: parseFloat(row['Weight'] || row['weight'] || 0),
      serviceType: row['Service Type'] || row['serviceType'] || 'Ground',
      cost: parseFloat(row['Cost'] || row['cost'] || 0)
    }));

    const totalCost = parcels.reduce((sum, p) => sum + p.cost, 0);

    // Get active FBA shipment rate
    const fbaRate = await AmazonRateEnhanced.getActiveRate('fbaShipment');

    let proposedCost = 0;
    if (fbaRate) {
      for (const parcel of parcels) {
        try {
          const calc = fbaRate.calculateFBAShipmentCost(
            parcel.zone,
            parcel.weight,
            parcel.serviceType
          );
          proposedCost += calc.totalCost;
        } catch (err) {
          console.warn(`Could not calculate for parcel ${parcel.trackingNumber}:`, err.message);
        }
      }
    }

    return {
      parcels,
      currentTotal: totalCost,
      proposedTotal: proposedCost,
      savings: totalCost - proposedCost,
      rateType: 'fbaShipment'
    };
  }

  /**
   * Get active rates based on specified type
   */
  static async getActiveRates(rateType) {
    const rates = {};

    if (rateType === 'combined' || rateType === 'all') {
      rates.prep = await AmazonRateEnhanced.getActiveRate('prep');
      rates.middleMile = await AmazonRateEnhanced.getActiveRate('middleMile');
      rates.fbaShipment = await AmazonRateEnhanced.getActiveRate('fbaShipment');
      rates.combined = await AmazonRateEnhanced.getActiveRate('combined');
    } else {
      rates[rateType] = await AmazonRateEnhanced.getActiveRate(rateType);
    }

    return rates;
  }

  /**
   * Calculate costs using multiple rate types
   */
  static async calculateWithMultipleRates(shipments, totals, rates) {
    const calculations = {};

    // Prep calculation
    if (rates.prep) {
      try {
        calculations.prep = rates.prep.calculatePrepCost({
          units: totals.units,
          skus: 24, // You may need to extract actual SKU count
          pallets: totals.pallets,
          cubicFeet: totals.volume,
          weight: totals.weight
        });
      } catch (err) {
        console.warn('Prep calculation failed:', err.message);
      }
    }

    // Middle-mile calculation
    if (rates.middleMile) {
      let totalMiddleMileCost = 0;
      const breakdown = [];

      // Group by destination state
      const byState = {};
      shipments.forEach(s => {
        const state = s.destinationState || 'Unknown';
        if (!byState[state]) {
          byState[state] = { pallets: 0, weight: 0, shipments: 0 };
        }
        byState[state].pallets += s.pallets;
        byState[state].weight += s.weight;
        byState[state].shipments += 1;
      });

      for (const [state, data] of Object.entries(byState)) {
        try {
          const calc = rates.middleMile.calculateMiddleMileCost({
            shipmentType: data.pallets >= 26 ? 'FTL' : 'LTL',
            pallets: data.pallets,
            weight: data.weight,
            destinationState: state
          });
          totalMiddleMileCost += calc.totalCost;
          breakdown.push({ state, ...calc });
        } catch (err) {
          console.warn(`Middle-mile calc failed for ${state}:`, err.message);
        }
      }

      calculations.middleMile = {
        totalCost: totalMiddleMileCost,
        breakdown
      };
    }

    // Combined calculation
    if (rates.combined) {
      try {
        calculations.combined = rates.combined.calculateComprehensiveCost({
          units: totals.units,
          skus: 24,
          pallets: totals.pallets,
          cubicFeet: totals.volume,
          weight: totals.weight,
          shipmentType: totals.pallets >= 26 ? 'FTL' : 'LTL',
          shipments: shipments.length,
          isSplit: true
        });
      } catch (err) {
        console.warn('Combined calculation failed:', err.message);
      }
    }

    return calculations;
  }

  /**
   * Extract state abbreviation from address string
   */
  static extractState(address) {
    const stateMatch = address.match(/\b([A-Z]{2})\b/);
    return stateMatch ? stateMatch[1] : 'Unknown';
  }
}

export default MultiDatasetHandler;
