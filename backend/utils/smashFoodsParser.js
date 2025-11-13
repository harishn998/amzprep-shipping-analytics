// ============================================================================
// SMASH FOODS PARSER - WITH HAZMAT INTEGRATION
// File: backend/utils/smashFoodsParser.js
// ============================================================================

import XLSX from 'xlsx';
import { parseISO, differenceInDays } from 'date-fns';
import HazmatClassifier from './hazmatClassifier.js'; // 🆕 ADD THIS IMPORT

/**
 * SmashFoodsParser - Parses Smash Foods Excel files with 4 tabs
 * NOW WITH HAZMAT CLASSIFICATION SUPPORT
 */
class SmashFoodsParser {

  constructor() {
    this.hazmatClassifier = new HazmatClassifier(); // 🆕 ADD THIS
  }

  /**
   * Main parsing method - parses entire Excel file
   * 🆕 NOW INCLUDES HAZMAT CLASSIFICATION
   */
  async parseFile(filePath) {
    console.log('📊 Parsing Smash Foods file:', filePath);

    const workbook = XLSX.readFile(filePath);

    // Check if all required sheets exist
    const requiredSheets = ['Data', 'Placement', 'Storage', 'FBA Zoning'];
    const missingSheets = requiredSheets.filter(sheet => !workbook.SheetNames.includes(sheet));

    if (missingSheets.length > 0) {
      throw new Error(`Missing required sheets: ${missingSheets.join(', ')}`);
    }

    // Parse each sheet
    const parsedData = {
      dataSheet: this.parseDataSheet(workbook.Sheets['Data']),
      placementSheet: this.parsePlacementSheet(workbook.Sheets['Placement']),
      storageSheet: this.parseStorageSheet(workbook.Sheets['Storage']),
      fbaZoningSheet: this.parseFBAZoningSheet(workbook.Sheets['FBA Zoning'])
    };

    // Filter to CLOSED shipments only
    parsedData.dataSheet = parsedData.dataSheet.filter(row =>
      row.status && row.status.toUpperCase() === 'CLOSED'
    );

    console.log(`✅ Parsed ${parsedData.dataSheet.length} CLOSED shipments`);

    // 🆕 PERFORM HAZMAT CLASSIFICATION
    console.log('🔍 Classifying hazmat products...');
    parsedData.hazmatClassification = this.hazmatClassifier.classifyAllProducts(
      parsedData.storageSheet
    );

    // 🆕 CREATE ASIN LOOKUP MAP
    parsedData.hazmatLookupMap = this.hazmatClassifier.createHazmatLookupMap(
      parsedData.hazmatClassification
    );

    // Enrich data with calculations AND hazmat info
    parsedData.dataSheet = this.enrichDataWithCalculations(parsedData);

    // Log summary
    const totalCuft = parsedData.dataSheet.reduce((sum, s) => sum + s.cuft, 0);
    const totalPallets = parsedData.dataSheet.reduce((sum, s) => sum + s.calculatedPallets, 0);
    console.log(`   Total Cuft: ${totalCuft.toFixed(2)}`);
    console.log(`   Total Pallets: ${totalPallets.toFixed(2)}`);

    return parsedData;
  }

  /**
   * Parse Data sheet - NO CHANGES NEEDED TO THIS METHOD
   * (keeping your existing code intact)
   */
  parseDataSheet(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);

    return data.map(row => {
      const isMuscleMac = 'Days Since Created' in row;
      const format = isMuscleMac ? 'muscle_mac' : 'smash_foods';

      if (isMuscleMac) {
        console.log('   Detected Muscle Mac format in Data sheet');
      }

      return {
        shipmentName: row['Shipment Name'] || '',
        fbaShipmentID: row['FBA Shipment ID'] || '',
        status: row['Status'] || '',
        createdDate: this.parseDate(row['Created Date']),
        lastUpdatedDate: this.parseDate(row['Last Updated Date']),
        units: parseInt(row['Total Shipped Qty'] || 0),
        totalSKUs: parseInt(row['Total SKUs'] || 0),

        palletQuantity: isMuscleMac
          ? parseInt(row['Total Pallets'] || 0)
          : parseInt(row['Total Pallet Quantity'] || 0),

        weight: isMuscleMac
          ? parseFloat(row['Total Weight (lbs)'] || 0)
          : parseFloat(row['Total Weight'] || 0),

        cuftFromDataSheet: parseFloat(row['Cuft'] || 0),
        carrierCost: parseFloat(row['Amazon Partnered Carrier Cost'] || 0),

        placementFees: isMuscleMac
          ? parseFloat(row['Chosen Placement Fee'] || 0)
          : parseFloat(row['Placement Fees'] || 0),

        destinationFC: row['Destination FC'] || '',
        shipToZip: String(row['Ship To Postal Code'] || '').split('-')[0],
        shipFromName: row['Ship From Owner Name'] || '',
        shipFromZip: String(row['Ship From Postal Code'] || '').split('-')[0],
        shipMethod: row['Ship Method'] || '',
        carrier: row['Carrier'] || '',
        checkedInDate: this.parseDate(row['Shipment Status: CHECKED_IN']),
        format: format
      };
    });
  }

  /**
   * Parse Placement sheet - NO CHANGES
   */
  parsePlacementSheet(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);

    return data.map(row => ({
      fbaShipmentID: row['FBA shipment ID'] || '',
      fnsku: row['FNSKU'] || '',
      asin: row['ASIN'] || '',
      receivedQty: parseInt(row['Actual received quantity'] || 0),
      sizeTier: row['Product size tier'] || '',
      shippingWeight: parseFloat(row['Shipping weight'] || 0),
      placementFee: parseFloat(row['Total FBA inbound placement service fee charge'] || 0),
      cuft: parseFloat(row['Cuft'] || 0),
      totalCuft: parseFloat(row['Total Cuft'] || 0)
    }));
  }

  /**
   * Parse Storage sheet - NO CHANGES
   */
  parseStorageSheet(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);

    return data.map(row => ({
      asin: row['asin'] || '',
      fnsku: row['fnsku'] || '',
      product_name: row['product_name'] || '',
      itemVolume: parseFloat(row['item_volume'] || 0),
      weight: parseFloat(row['weight'] || 0),
      sizeTier: row['product_size_tier'] || '',
      // 🆕 HAZMAT FIELDS (these already exist in your data)
      Hazmat: row['Hazmat'] || '',
      dangerous_goods_storage_type: row['dangerous_goods_storage_type'] || ''
    }));
  }

  /**
   * Parse FBA Zoning sheet - NO CHANGES
   */
  parseFBAZoningSheet(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);

    return data.map(row => ({
      shipTo: row['Ship to'] || '',
      zip: String(row['Zip'] || '').split('-')[0],
      province: row['Province'] || '',
      fba: row['FBA'] || '',
      region: row['2 Region'] || ''
    }));
  }

  /**
   * Enrich data with calculated metrics
   * 🆕 NOW INCLUDES HAZMAT ENRICHMENT
   */
  enrichDataWithCalculations(parsedData) {
    const { dataSheet, fbaZoningSheet, placementSheet, hazmatLookupMap } = parsedData;

    // STEP 1: Aggregate cuft data from Placement sheet
    const placementCuftMap = {};
    const placementQtyMap = {};
    const placementFeesMap = {};
    const placementAsinMap = {}; // 🆕 Track ASINs per shipment

    placementSheet.forEach(item => {
      const shipmentID = item.fbaShipmentID;
      const asin = item.asin;

      if (!placementCuftMap[shipmentID]) {
        placementCuftMap[shipmentID] = 0;
        placementQtyMap[shipmentID] = 0;
        placementFeesMap[shipmentID] = 0;
        placementAsinMap[shipmentID] = new Set(); // 🆕 Track unique ASINs
      }

      placementCuftMap[shipmentID] += item.totalCuft || 0;
      placementQtyMap[shipmentID] += item.receivedQty || 0;
      placementFeesMap[shipmentID] += item.placementFee || 0;

      // 🆕 ADD ASIN TO SHIPMENT
      if (asin) {
        placementAsinMap[shipmentID].add(asin);
      }
    });

    console.log(`   Found cuft data for ${Object.keys(placementCuftMap).length} shipments in Placement sheet`);

    // STEP 2: Enrich each shipment with merged data + HAZMAT INFO
    return dataSheet.map(shipment => {
      const cuftFromPlacement = placementCuftMap[shipment.fbaShipmentID] || 0;
      let actualCuft = cuftFromPlacement > 0 ? cuftFromPlacement : shipment.cuftFromDataSheet;

      if (!actualCuft || actualCuft === 0 || isNaN(actualCuft)) {
        actualCuft = shipment.units * 0.26;
        if (actualCuft > 0) {
          console.log(`   ⚠️ Estimated ${actualCuft.toFixed(2)} cuft for ${shipment.fbaShipmentID} (${shipment.units} units)`);
        }
      }

      const placementFeesFromSheet = placementFeesMap[shipment.fbaShipmentID];
      const actualPlacementFees = placementFeesFromSheet !== undefined && placementFeesFromSheet > 0
        ? placementFeesFromSheet
        : shipment.placementFees;

      const calculatedPallets = actualCuft > 0 ? actualCuft / 67 : 0;

      // Calculate transit time
      let transitDays = 0;
      if (shipment.checkedInDate && shipment.createdDate) {
        try {
          const checkedIn = new Date(shipment.checkedInDate);
          const created = new Date(shipment.createdDate);

          if (!isNaN(checkedIn.getTime()) && !isNaN(created.getTime())) {
            transitDays = Math.round((checkedIn - created) / (1000 * 60 * 60 * 24));
            if (transitDays < 0) transitDays = 0;
          }
        } catch (error) {
          console.warn(`Failed to calculate transit for ${shipment.fbaShipmentID}:`, error.message);
        }
      }

      // Get state from ZIP
      const stateInfo = fbaZoningSheet.find(zone => zone.zip === shipment.shipToZip);
      const destinationState = stateInfo ? stateInfo.province : 'Unknown';
      const destinationRegion = stateInfo ? stateInfo.region : 'Unknown';
      const currentTotalCost = shipment.carrierCost + actualPlacementFees;

      // 🆕 DETERMINE HAZMAT STATUS FOR THIS SHIPMENT
      const shipmentAsins = placementAsinMap[shipment.fbaShipmentID] || new Set();
      let containsHazmat = false;
      let hazmatTypes = new Set();
      let hazmatCount = 0;

      shipmentAsins.forEach(asin => {
        const hazmatInfo = hazmatLookupMap.get(asin);
        if (hazmatInfo && hazmatInfo.isHazmat) {
          containsHazmat = true;
          hazmatCount++;
          if (hazmatInfo.type) {
            hazmatTypes.add(hazmatInfo.type);
          }
        }
      });

      // Build enriched shipment object
      return {
        ...shipment,
        cuft: actualCuft,
        cuftSource: cuftFromPlacement > 0 ? 'placement' : (shipment.cuftFromDataSheet > 0 ? 'data' : 'estimated'),
        placementFees: actualPlacementFees,
        calculatedPallets,
        transitDays,
        destinationState,
        destinationRegion,
        currentTotalCost,

        // 🆕 HAZMAT FIELDS
        containsHazmat,
        hazmatProductCount: hazmatCount,
        hazmatTypes: Array.from(hazmatTypes),
        totalAsins: shipmentAsins.size
      };
    });
  }

  /**
   * Parse date - NO CHANGES
   */
  parseDate(dateString) {
    if (!dateString) return null;

    try {
      if (typeof dateString === 'number') {
        return this.excelSerialToDate(dateString);
      }
      return parseISO(dateString);
    } catch (error) {
      console.warn('Failed to parse date:', dateString);
      return null;
    }
  }

  /**
   * Convert Excel serial date - NO CHANGES
   */
  excelSerialToDate(serial) {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
  }

  /**
   * Get summary statistics - 🆕 NOW INCLUDES HAZMAT STATS
   */
  getSummary(parsedData) {
    const { dataSheet, hazmatClassification } = parsedData;

    const hazmatShipments = dataSheet.filter(s => s.containsHazmat);
    const nonHazmatShipments = dataSheet.filter(s => !s.containsHazmat);

    return {
      totalShipments: dataSheet.length,
      totalUnits: dataSheet.reduce((sum, s) => sum + s.units, 0),
      totalPallets: dataSheet.reduce((sum, s) => sum + s.calculatedPallets, 0),
      totalCuft: dataSheet.reduce((sum, s) => sum + s.cuft, 0),
      totalWeight: dataSheet.reduce((sum, s) => sum + s.weight, 0),
      totalCurrentCost: dataSheet.reduce((sum, s) => sum + s.currentTotalCost, 0),
      avgTransitDays: dataSheet.reduce((sum, s) => sum + s.transitDays, 0) / dataSheet.length,

      // 🆕 HAZMAT SUMMARY
      hazmat: {
        products: {
          total: hazmatClassification.summary.hazmatCount,
          percentage: ((hazmatClassification.summary.hazmatCount / hazmatClassification.total) * 100).toFixed(2)
        },
        shipments: {
          total: hazmatShipments.length,
          percentage: ((hazmatShipments.length / dataSheet.length) * 100).toFixed(2),
          units: hazmatShipments.reduce((sum, s) => sum + s.units, 0),
          cuft: hazmatShipments.reduce((sum, s) => sum + s.cuft, 0),
          cost: hazmatShipments.reduce((sum, s) => sum + s.currentTotalCost, 0)
        },
        types: hazmatClassification.summary.byType
      }
    };
  }
}

export default SmashFoodsParser;
