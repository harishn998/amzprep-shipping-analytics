// ============================================================================
// SMASH FOODS PARSER - FIXED VERSION WITH ACCURATE HAZMAT INTEGRATION
// File: backend/utils/smashFoodsParser.js
// ============================================================================

import XLSX from 'xlsx';
import { parseISO } from 'date-fns';
import HazmatClassifier from './hazmatClassifier.js';

/**
 * SmashFoodsParser - FIXED VERSION
 *
 * KEY IMPROVEMENTS:
 * 1. Parses dedicated Hazmat sheet (if available)
 * 2. Uses Hazmat sheet as reference for classification
 * 3. Better ASIN-to-shipment mapping from Placement sheet
 * 4. More accurate hazmat enrichment logic
 */
class SmashFoodsParser {

  constructor() {
    this.hazmatClassifier = new HazmatClassifier();
  }

  /**
   * Main parsing method - parses entire Excel file
   * NOW WITH ENHANCED HAZMAT DETECTION
   */
  async parseFile(filePath) {
    console.log('📊 Parsing Smash Foods file:', filePath);

    const workbook = XLSX.readFile(filePath);

    // Check required sheets
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
      fbaZoningSheet: this.parseFBAZoningSheet(workbook.Sheets['FBA Zoning']),
      hazmatSheet: null // Will be populated if available
    };

    // 🆕 PARSE HAZMAT SHEET IF AVAILABLE
    if (workbook.SheetNames.includes('Hazmat')) {
      console.log('🔬 Found dedicated Hazmat sheet - parsing...');
      parsedData.hazmatSheet = this.parseHazmatSheet(workbook.Sheets['Hazmat']);
      console.log(`   ✓ Parsed ${parsedData.hazmatSheet.length} hazmat products from Hazmat sheet`);
    } else {
      console.log('⚠️  No Hazmat sheet found - will rely on Storage sheet detection');
    }

    // Filter to CLOSED shipments only
    parsedData.dataSheet = parsedData.dataSheet.filter(row =>
      row.status && row.status.toUpperCase() === 'CLOSED'
    );

    console.log(`✅ Parsed ${parsedData.dataSheet.length} CLOSED shipments`);

    // 🆕 BUILD HAZMAT REFERENCE (if Hazmat sheet exists)
    let hazmatReference = null;
    if (parsedData.hazmatSheet && parsedData.hazmatSheet.length > 0) {
      hazmatReference = this.hazmatClassifier.buildHazmatReferenceFromHazmatSheet(
        parsedData.hazmatSheet
      );
    }

    // 🆕 PERFORM HAZMAT CLASSIFICATION WITH REFERENCE
    console.log('🔍 Classifying hazmat products...');
    parsedData.hazmatClassification = this.hazmatClassifier.classifyAllProducts(
      parsedData.storageSheet,
      hazmatReference
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
    const hazmatShipments = parsedData.dataSheet.filter(s => s.containsHazmat).length;

    console.log(`   Total Cuft: ${totalCuft.toFixed(2)}`);
    console.log(`   Total Pallets: ${totalPallets.toFixed(2)}`);
    console.log(`   Hazmat Shipments: ${hazmatShipments} (${((hazmatShipments/parsedData.dataSheet.length)*100).toFixed(1)}%)`);

    return parsedData;
  }

  /**
   * 🆕 NEW: Parse dedicated Hazmat sheet
   */
  parseHazmatSheet(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);

    return data.map(row => ({
      asin: row['ASIN'] || row['asin'] || '',
      productName: row['Product Name'] || row['product_name'] || '',
      sku: row['SKU'] || row['sku'] || '',
      storageType: row['Storage Type'] || row['storage_type'] || ''
    })).filter(item => item.asin); // Only include rows with ASIN
  }

  /**
   * Parse Data sheet
   */
  parseDataSheet(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);

    return data.map(row => {
      const isMuscleMac = 'Days Since Created' in row;
      const format = isMuscleMac ? 'muscle_mac' : 'smash_foods';

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
   * Parse Placement sheet - ENHANCED to capture Hazmat column
   */
  parsePlacementSheet(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);

    return data.map(row => ({
      fbaShipmentID: row['FBA shipment ID'] || row['FBA Shipment ID'] || '',
      fnsku: row['FNSKU'] || '',
      asin: row['ASIN'] || '',
      hazmatFlag: row['Hazmat'] || '', // 🆕 CAPTURE HAZMAT COLUMN
      receivedQty: parseInt(row['Actual received quantity'] || 0),
      sizeTier: row['Product size tier'] || '',
      shippingWeight: parseFloat(row['Shipping weight'] || 0),
      placementFee: parseFloat(row['Total FBA inbound placement service fee charge'] || 0),
      cuft: parseFloat(row['Cuft'] || 0),
      totalCuft: parseFloat(row['Total Cuft'] || 0)
    }));
  }

  /**
   * Parse Storage sheet
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
      Hazmat: row['Hazmat'] || '',
      dangerous_goods_storage_type: row['dangerous_goods_storage_type'] || ''
    }));
  }

  /**
   * Parse FBA Zoning sheet
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
   * IMPROVED: Enrich data with calculated metrics AND accurate hazmat info
   */
  enrichDataWithCalculations(parsedData) {
    const { dataSheet, fbaZoningSheet, placementSheet, hazmatLookupMap } = parsedData;

    // STEP 1: Aggregate cuft data from Placement sheet
    const placementCuftMap = {};
    const placementQtyMap = {};
    const placementFeesMap = {};
    const placementAsinMap = {};

    placementSheet.forEach(item => {
      const shipmentID = item.fbaShipmentID;
      const asin = item.asin;

      if (!placementCuftMap[shipmentID]) {
        placementCuftMap[shipmentID] = 0;
        placementQtyMap[shipmentID] = 0;
        placementFeesMap[shipmentID] = 0;
        placementAsinMap[shipmentID] = new Set();
      }

      placementCuftMap[shipmentID] += item.totalCuft || 0;
      placementQtyMap[shipmentID] += item.receivedQty || 0;
      placementFeesMap[shipmentID] += item.placementFee || 0;

      if (asin) {
        placementAsinMap[shipmentID].add(asin);
      }
    });

    console.log(`   Found cuft data for ${Object.keys(placementCuftMap).length} shipments in Placement sheet`);

    // STEP 2: Enrich each shipment with merged data + ACCURATE HAZMAT INFO
    const enrichedShipments = dataSheet.map(shipment => {
      const cuftFromPlacement = placementCuftMap[shipment.fbaShipmentID] || 0;
      let actualCuft = cuftFromPlacement > 0 ? cuftFromPlacement : shipment.cuftFromDataSheet;

      if (!actualCuft || actualCuft === 0 || isNaN(actualCuft)) {
        actualCuft = shipment.units * 0.26;
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
          // Silently handle date errors
        }
      }

      // Get state from ZIP
      const stateInfo = fbaZoningSheet.find(zone => zone.zip === shipment.shipToZip);
      const destinationState = stateInfo ? stateInfo.province : 'Unknown';
      const destinationRegion = stateInfo ? stateInfo.region : 'Unknown';
      const currentTotalCost = shipment.carrierCost + actualPlacementFees;

      // 🆕 DETERMINE HAZMAT STATUS FOR THIS SHIPMENT (ACCURATE METHOD)
      const shipmentAsins = placementAsinMap[shipment.fbaShipmentID] || new Set();
      let containsHazmat = false;
      let hazmatTypes = new Set();
      let hazmatCount = 0;
      let nonHazmatCount = 0;
      let unknownCount = 0;

      shipmentAsins.forEach(asin => {
        const hazmatInfo = hazmatLookupMap.get(asin);
        if (hazmatInfo) {
          if (hazmatInfo.isHazmat) {
            containsHazmat = true;
            hazmatCount++;
            if (hazmatInfo.type) {
              hazmatTypes.add(hazmatInfo.type);
            }
          } else {
            nonHazmatCount++;
          }
        } else {
          unknownCount++;
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

        // 🆕 ACCURATE HAZMAT FIELDS
        containsHazmat,
        hazmatProductCount: hazmatCount,
        nonHazmatProductCount: nonHazmatCount,
        unknownProductCount: unknownCount,
        hazmatTypes: Array.from(hazmatTypes),
        totalAsins: shipmentAsins.size,
        hazmatPercentage: shipmentAsins.size > 0
          ? Math.round((hazmatCount / shipmentAsins.size) * 100)
          : 0
      };
    });

    return enrichedShipments;
  }

  /**
   * Parse date
   */
  parseDate(dateString) {
    if (!dateString) return null;

    try {
      if (typeof dateString === 'number') {
        return this.excelSerialToDate(dateString);
      }
      return parseISO(dateString);
    } catch (error) {
      return null;
    }
  }

  /**
   * Convert Excel serial date
   */
  excelSerialToDate(serial) {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
  }

  /**
   * Get summary statistics - WITH ACCURATE HAZMAT STATS
   */
  getSummary(parsedData) {
    const { dataSheet, hazmatClassification } = parsedData;

    const hazmatShipments = dataSheet.filter(s => s.containsHazmat);
    const nonHazmatShipments = dataSheet.filter(s => !s.containsHazmat);
    const mixedShipments = hazmatShipments.filter(s => s.nonHazmatProductCount > 0);

    // Calculate totals for hazmat shipments
    const hazmatTotals = {
      units: hazmatShipments.reduce((sum, s) => sum + s.units, 0),
      cuft: hazmatShipments.reduce((sum, s) => sum + s.cuft, 0),
      pallets: hazmatShipments.reduce((sum, s) => sum + s.calculatedPallets, 0),
      cost: hazmatShipments.reduce((sum, s) => sum + s.currentTotalCost, 0)
    };

    // Calculate totals for non-hazmat shipments
    const nonHazmatTotals = {
      units: nonHazmatShipments.reduce((sum, s) => sum + s.units, 0),
      cuft: nonHazmatShipments.reduce((sum, s) => sum + s.cuft, 0),
      pallets: nonHazmatShipments.reduce((sum, s) => sum + s.calculatedPallets, 0),
      cost: nonHazmatShipments.reduce((sum, s) => sum + s.currentTotalCost, 0)
    };

    return {
      totalShipments: dataSheet.length,
      totalUnits: dataSheet.reduce((sum, s) => sum + s.units, 0),
      totalPallets: dataSheet.reduce((sum, s) => sum + s.calculatedPallets, 0),
      totalCuft: dataSheet.reduce((sum, s) => sum + s.cuft, 0),
      totalWeight: dataSheet.reduce((sum, s) => sum + s.weight, 0),
      totalCurrentCost: dataSheet.reduce((sum, s) => sum + s.currentTotalCost, 0),
      avgTransitDays: dataSheet.reduce((sum, s) => sum + s.transitDays, 0) / dataSheet.length,

      // 🆕 ENHANCED HAZMAT SUMMARY
      hazmat: {
        products: {
          total: hazmatClassification.summary.hazmatCount,
          percentage: ((hazmatClassification.summary.hazmatCount / hazmatClassification.total) * 100).toFixed(2),
          byType: hazmatClassification.summary.byType,
          byConfidence: hazmatClassification.summary.byConfidence
        },
        shipments: {
          total: hazmatShipments.length,
          mixed: mixedShipments.length,
          pureHazmat: hazmatShipments.length - mixedShipments.length,
          percentage: ((hazmatShipments.length / dataSheet.length) * 100).toFixed(2),
          ...hazmatTotals
        },
        nonHazmat: {
          shipments: nonHazmatShipments.length,
          percentage: ((nonHazmatShipments.length / dataSheet.length) * 100).toFixed(2),
          ...nonHazmatTotals
        }
      }
    };
  }
}

export default SmashFoodsParser;
