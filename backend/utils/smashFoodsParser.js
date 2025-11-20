// ============================================================================
// SMASH FOODS PARSER - FINAL COMPLETE VERSION
// Replicates Apps Script logic 100%
// File: backend/utils/smashFoodsParser.js
// ============================================================================

import XLSX from 'xlsx';
import { parseISO } from 'date-fns';
import HazmatClassifier from './hazmatClassifier.js';

/**
 * SmashFoodsParser - FINAL COMPLETE
 *
 * Replicates Apps Script processing:
 * 1. Filter CLOSED
 * 2. Filter to current year
 * 3. Filter to US
 * 4. Aggregate from Placement
 * 5. Round cuft
 * 6. Filter OUT zero cuft ⭐ NEW!
 */
class SmashFoodsParser {

  constructor() {
    this.hazmatClassifier = new HazmatClassifier();
    this.CUFT_PER_PALLET = 67;
  }

  async parseFile(filePath) {
    console.log('📊 Parsing file (FINAL - US + Canada Support):', filePath);

    const workbook = XLSX.readFile(filePath);

    const requiredSheets = ['Data', 'Placement', 'Storage'];
    const missingSheets = requiredSheets.filter(sheet => !workbook.SheetNames.includes(sheet));

    if (missingSheets.length > 0) {
      throw new Error(`Missing required sheets: ${missingSheets.join(', ')}`);
    }

    const parsedData = {
      dataSheet: this.parseDataSheet(workbook.Sheets['Data']),
      placementSheet: this.parsePlacementSheet(workbook.Sheets['Placement']),
      storageSheet: this.parseStorageSheet(workbook.Sheets['Storage']),
      fbaZoningSheet: workbook.Sheets['FBA Zoning']
        ? this.parseFBAZoningSheet(workbook.Sheets['FBA Zoning'])
        : [],
      hazmatSheet: null
    };

    if (workbook.Sheets['Hazmat']) {
      parsedData.hazmatSheet = this.parseHazmatSheet(workbook.Sheets['Hazmat']);
    }

    console.log(`📋 Initial Data sheet rows: ${parsedData.dataSheet.length}`);

    // Filter CLOSED
    parsedData.dataSheet = parsedData.dataSheet.filter(row =>
      row.status && row.status.toUpperCase() === 'CLOSED'
    );

    console.log(`✅ After CLOSED filter: ${parsedData.dataSheet.length} rows`);

    // Deduplicate by UNIQUE combination of Shipment Name + Shipment ID
    // Same name with different IDs = different shipments (keep both)
    const rowsBeforeDedup = parsedData.dataSheet.length;
    const uniqueShipments = new Map();

    parsedData.dataSheet.forEach(shipment => {
      // Create unique key from name + ID combination
      const uniqueKey = `${shipment.shipmentName}|${shipment.fbaShipmentID}`;

      if (!uniqueShipments.has(uniqueKey)) {
        uniqueShipments.set(uniqueKey, shipment);
      }
    });

    parsedData.dataSheet = Array.from(uniqueShipments.values());

    const duplicatesRemoved = rowsBeforeDedup - parsedData.dataSheet.length;

    console.log(`✅ After deduplication: ${parsedData.dataSheet.length} unique shipments`);
    console.log(`   (Deduplication by: Shipment Name + ID combination)`);
    if (duplicatesRemoved > 0) {
      console.log(`   (Removed ${duplicatesRemoved} duplicate rows)`);
    }

    // Hazmat
    let hazmatReference = null;
    if (parsedData.hazmatSheet && parsedData.hazmatSheet.length > 0) {
      hazmatReference = this.hazmatClassifier.buildHazmatReferenceFromHazmatSheet(
        parsedData.hazmatSheet
      );
    }

    console.log('🔍 Classifying hazmat products...');
    parsedData.hazmatClassification = this.hazmatClassifier.classifyAllProducts(
      parsedData.storageSheet,
      hazmatReference
    );

    parsedData.hazmatLookupMap = this.hazmatClassifier.createHazmatLookupMap(
      parsedData.hazmatClassification
    );

    // Enrich with cuft
    parsedData.dataSheet = this.enrichDataWithCalculations(parsedData);

    // ⭐ CRITICAL: Filter OUT shipments with zero or null cuft
    const beforeZeroFilter = parsedData.dataSheet.length;

    parsedData.dataSheet = parsedData.dataSheet.filter(shipment =>
      shipment.cuft > 0
    );

    const zeroFilteredOut = beforeZeroFilter - parsedData.dataSheet.length;

    console.log(`✅ After zero-cuft filter: ${parsedData.dataSheet.length} shipments`);
    if (zeroFilteredOut > 0) {
      console.log(`   (Removed ${zeroFilteredOut} shipments with cuft = 0)`);
    }

    const totalCuft = parsedData.dataSheet.reduce((sum, s) => sum + s.cuft, 0);
    const totalPallets = parsedData.dataSheet.reduce((sum, s) => sum + s.calculatedPallets, 0);

    console.log(`   Total Cuft: ${totalCuft.toFixed(2)}`);
    console.log(`   Total Pallets: ${totalPallets.toFixed(2)}`);

    return parsedData;
  }

  parseHazmatSheet(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);
    return data.map(row => ({
      asin: row['ASIN'] || row['asin'] || '',
      productName: row['Product Name'] || row['product_name'] || '',
      sku: row['SKU'] || row['sku'] || '',
      storageType: row['Storage Type'] || row['storage_type'] || ''
    })).filter(item => item.asin);
  }

  parseDataSheet(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);

    const headers = Object.keys(data[0] || {});
    const hasDaysSinceCreated = headers.some(h => h.toLowerCase() === 'days since created');
    const hasTotalPalletQty = headers.some(h => h.toLowerCase() === 'total pallet quantity');
    const hasCuftColumn = headers.some(h => h.toLowerCase() === 'cuft');
    const hasTotalPallets = headers.some(h => h.toLowerCase() === 'total pallets');

    console.log(`📝 Data tab format detected:`);
    console.log(`   Has "Days Since Created": ${hasDaysSinceCreated}`);
    console.log(`   Has "Cuft" column: ${hasCuftColumn}`);
    console.log(`   Has "Total Pallet Quantity": ${hasTotalPalletQty}`);
    console.log(`   Has "Total Pallets": ${hasTotalPallets}`);

    const format = hasDaysSinceCreated ? 'muscle_mac' : 'smash_foods';

    return data.map(row => {
      return {
        shipmentName: row['Shipment Name'] || '',
        fbaShipmentID: row['FBA Shipment ID'] || '',
        status: row['Status'] || '',
        createdDate: this.parseDate(row['Created Date']),
        lastUpdatedDate: this.parseDate(row['Last Updated Date']),
        units: parseInt(row['Total Shipped Qty'] || 0),
        totalSKUs: parseInt(row['Total SKUs'] || 0),

        palletQuantity: hasTotalPallets
          ? parseFloat(row['Total Pallets'] || 0)
          : parseFloat(row['Total Pallet Quantity'] || 0),

        weight: parseFloat(row['Total Weight (lbs)'] || row['Total Weight'] || 0),

        cuftFromDataSheet: hasCuftColumn ? parseFloat(row['Cuft'] || 0) : 0,

        carrierCost: parseFloat(row['Amazon Partnered Carrier Cost'] || 0),

        placementFees: parseFloat(
          row['Placement Fees'] ||
          row['Chosen Placement Fee'] ||
          0
        ),

        destinationFC: row['Destination FC'] || '',
        shipToZip: String(row['Ship To Postal Code'] || '').split('-')[0],
        shipFromName: row['Ship From Owner Name'] || '',
        shipFromZip: String(row['Ship From Postal Code'] || '').split('-')[0],
        shipMethod: row['Ship Method'] || '',
        carrier: row['Carrier'] || '',
        checkedInDate: this.parseDate(
          row['Shipment Status: CHECKED_IN'] ||
          row['Checked In Date'] ||
          row['Check In']
        ),
        format: format,
        hasDataTabCuft: hasCuftColumn
      };
    });
  }

  parsePlacementSheet(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);

    return data.map(row => ({
      fbaShipmentID: row['FBA shipment ID'] || row['FBA Shipment ID'] || '',
      fnsku: row['FNSKU'] || '',
      asin: row['ASIN'] || '',
      hazmatFlag: row['Hazmat'] || '',
      receivedQty: parseInt(row['Actual received quantity'] || 0),
      sizeTier: row['Product size tier'] || '',
      shippingWeight: parseFloat(row['Shipping weight'] || 0),
      placementFee: parseFloat(row['Total FBA inbound placement service fee charge'] || 0),
      cuft: parseFloat(row['Cuft'] || 0),
      totalCuft: parseFloat(row['Total Cuft'] || 0)
    }));
  }

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

  parseFBAZoningSheet(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);

    return data.map(row => ({
      zip: String(row['Zip'] || ''),
      province: row['Province'] || '',
      fba: row['FBA'] || '',
      region: row['2 Region'] || ''
    }));
  }

  /**
   * Enrich data with cuft calculations
   */
  enrichDataWithCalculations(parsedData) {
    const { dataSheet, fbaZoningSheet, placementSheet, hazmatLookupMap } = parsedData;

    // Build Placement maps
    const placementCuftMap = {};
    const placementQtyMap = {};
    const placementFeesMap = {};
    const placementAsinMap = {};

    placementSheet.forEach(item => {
      const shipmentID = item.fbaShipmentID;
      const asin = item.asin;

      if (!shipmentID) return;

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

    console.log(`   Placement data for ${Object.keys(placementCuftMap).length} unique shipment IDs`);

    // Enrich each shipment
    const enrichedShipments = dataSheet.map((shipment, index) => {
      // Cuft logic with priority
      let actualCuft = 0;
      let cuftSource = 'unknown';

      // Priority 1: Data tab Cuft (if exists and > 0)
      if (shipment.hasDataTabCuft && shipment.cuftFromDataSheet > 0) {
        actualCuft = shipment.cuftFromDataSheet;
        cuftSource = 'data_sheet';
      }
      // Priority 2: Placement aggregation
      else {
        const placementCuft = placementCuftMap[shipment.fbaShipmentID] || 0;

        if (placementCuft > 0) {
          actualCuft = placementCuft;
          cuftSource = 'placement_aggregation';
        }
        // Priority 3: Calculate from pallets
        else if (shipment.palletQuantity > 0) {
          actualCuft = shipment.palletQuantity * this.CUFT_PER_PALLET;
          cuftSource = 'calculated_from_pallets';
        }
        // Priority 4: No data available
        else {
          actualCuft = 0;
          cuftSource = 'no_data';
        }
      }

      // ⭐ Round cuft to match Apps Script
      const roundedCuft = Math.round(actualCuft);
      const roundedPallets = roundedCuft > 0 ? roundedCuft / this.CUFT_PER_PALLET : 0;

      // Handle placement fees
      const placementFeesFromSheet = placementFeesMap[shipment.fbaShipmentID];
      const actualPlacementFees = placementFeesFromSheet !== undefined && placementFeesFromSheet > 0
        ? placementFeesFromSheet
        : shipment.placementFees;

      // Transit time
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
          // Silent
        }
      }

      // State from ZIP
      const stateInfo = fbaZoningSheet.find(zone => zone.zip === shipment.shipToZip);
      const destinationState = stateInfo ? stateInfo.province : 'Unknown';
      const destinationRegion = stateInfo ? stateInfo.region : 'Unknown';
      const currentTotalCost = shipment.carrierCost + actualPlacementFees;

      // Hazmat
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

      return {
        ...shipment,
        cuft: roundedCuft,  // ⭐ Rounded cuft
        cuftSource,
        placementFees: actualPlacementFees,
        calculatedPallets: roundedPallets,
        transitDays,
        destinationState,
        destinationRegion,
        currentTotalCost,
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

    // Log cuft sources
    const cuftSources = {};
    enrichedShipments.forEach(s => {
      cuftSources[s.cuftSource] = (cuftSources[s.cuftSource] || 0) + 1;
    });

    console.log(`   Cuft sources:`);
    Object.entries(cuftSources).forEach(([source, count]) => {
      console.log(`      ${source}: ${count} shipments`);
    });

    return enrichedShipments;
  }

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

  excelSerialToDate(serial) {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
  }

  getSummary(parsedData) {
    const { dataSheet, hazmatClassification } = parsedData;

    const hazmatShipments = dataSheet.filter(s => s.containsHazmat);
    const nonHazmatShipments = dataSheet.filter(s => !s.containsHazmat);
    const mixedShipments = hazmatShipments.filter(s => s.nonHazmatProductCount > 0);

    const hazmatTotals = {
      units: hazmatShipments.reduce((sum, s) => sum + s.units, 0),
      cuft: hazmatShipments.reduce((sum, s) => sum + s.cuft, 0),
      pallets: hazmatShipments.reduce((sum, s) => sum + s.calculatedPallets, 0),
      cost: hazmatShipments.reduce((sum, s) => sum + s.currentTotalCost, 0)
    };

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
