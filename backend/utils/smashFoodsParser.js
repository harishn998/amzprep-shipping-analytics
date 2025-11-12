// ============================================================================
// SMASH FOODS PARSER - FIXED VERSION
// Correctly extracts Cuft from Placement sheet and merges with Data
// File: backend/utils/smashFoodsParser.js
// ============================================================================

import XLSX from 'xlsx';
import { parseISO, differenceInDays } from 'date-fns';

/**
 * SmashFoodsParser - Parses Smash Foods Excel files with 4 tabs:
 * 1. Data - Main shipment data
 * 2. Placement - Placement fee details (CONTAINS CUFT DATA!)
 * 3. Storage - Product dimensions
 * 4. FBA Zoning - Geographic zones
 *
 * CRITICAL FIX: The Data sheet's Cuft column is often empty/incorrect.
 * The ACTUAL cuft data is in the Placement sheet and must be aggregated
 * and merged back into the shipment data.
 */
class SmashFoodsParser {

  /**
   * Main parsing method - parses entire Excel file
   * @param {string} filePath - Path to Excel file
   * @returns {Object} - Parsed data from all tabs
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

    // CRITICAL: Enrich data with calculations AND merge placement cuft data
    parsedData.dataSheet = this.enrichDataWithCalculations(parsedData);

    // Log summary
    const totalCuft = parsedData.dataSheet.reduce((sum, s) => sum + s.cuft, 0);
    const totalPallets = parsedData.dataSheet.reduce((sum, s) => sum + s.calculatedPallets, 0);
    console.log(`   Total Cuft: ${totalCuft.toFixed(2)}`);
    console.log(`   Total Pallets: ${totalPallets.toFixed(2)}`);

    return parsedData;
  }

  /**
   * Parse Data sheet (main shipment data)
   */
   parseDataSheet(sheet) {
   const data = XLSX.utils.sheet_to_json(sheet);

   return data.map(row => {
     // 🆕 AUTO-DETECT FORMAT from columns
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

       // 🆕 HANDLE DIFFERENT COLUMN NAMES
       palletQuantity: isMuscleMac
         ? parseInt(row['Total Pallets'] || 0)
         : parseInt(row['Total Pallet Quantity'] || 0),

       weight: isMuscleMac
         ? parseFloat(row['Total Weight (lbs)'] || 0)
         : parseFloat(row['Total Weight'] || 0),

       cuftFromDataSheet: parseFloat(row['Cuft'] || 0),

       carrierCost: parseFloat(row['Amazon Partnered Carrier Cost'] || 0),

       // 🆕 CRITICAL: Handle different placement fee column names
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

       // 🆕 Store format for debugging
       format: format
     };
   });
 }

  /**
   * Parse Placement sheet (placement fee details)
   * CRITICAL: This sheet contains the REAL cuft data!
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

      // CRITICAL: These are the REAL cuft values
      cuft: parseFloat(row['Cuft'] || 0),
      totalCuft: parseFloat(row['Total Cuft'] || 0)
    }));
  }

  /**
   * Parse Storage sheet (product dimensions)
   */
  parseStorageSheet(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);

    return data.map(row => ({
      asin: row['asin'] || '',
      fnsku: row['fnsku'] || '',
      productName: row['product_name'] || '',
      itemVolume: parseFloat(row['item_volume'] || 0),
      weight: parseFloat(row['weight'] || 0),
      sizeTier: row['product_size_tier'] || ''
    }));
  }

  /**
   * Parse FBA Zoning sheet (geographic zones)
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
   * CRITICAL FIX: Merge cuft data from Placement sheet
   */
  enrichDataWithCalculations(parsedData) {
    const { dataSheet, fbaZoningSheet, placementSheet } = parsedData;

    // STEP 1: Aggregate cuft data from Placement sheet by FBA Shipment ID
    const placementCuftMap = {};
    const placementQtyMap = {};
    const placementFeesMap = {};

    placementSheet.forEach(item => {
      const shipmentID = item.fbaShipmentID;

      if (!placementCuftMap[shipmentID]) {
        placementCuftMap[shipmentID] = 0;
        placementQtyMap[shipmentID] = 0;
        placementFeesMap[shipmentID] = 0;
      }

      // Sum up total cuft for this shipment
      placementCuftMap[shipmentID] += item.totalCuft || 0;
      placementQtyMap[shipmentID] += item.receivedQty || 0;
      placementFeesMap[shipmentID] += item.placementFee || 0;
    });

    console.log(`   Found cuft data for ${Object.keys(placementCuftMap).length} shipments in Placement sheet`);

    // STEP 2: Enrich each shipment with merged data
    return dataSheet.map(shipment => {
      // CRITICAL: Use cuft from Placement sheet if available
      const cuftFromPlacement = placementCuftMap[shipment.fbaShipmentID] || 0;
      let actualCuft = cuftFromPlacement > 0 ? cuftFromPlacement : shipment.cuftFromDataSheet;

      // If still no cuft data, estimate from units (average 0.26 cuft per unit)
      if (!actualCuft || actualCuft === 0 || isNaN(actualCuft)) {
        actualCuft = shipment.units * 0.26;
        if (actualCuft > 0) {
          console.log(`   ⚠️  Estimated ${actualCuft.toFixed(2)} cuft for ${shipment.fbaShipmentID} (${shipment.units} units)`);
        }
      }

      // Update placement fees from Placement sheet if available
      const placementFeesFromSheet = placementFeesMap[shipment.fbaShipmentID];
      const actualPlacementFees = placementFeesFromSheet !== undefined && placementFeesFromSheet > 0
        ? placementFeesFromSheet
        : shipment.placementFees;

      // Calculate pallets (67 cuft per pallet)
      const calculatedPallets = actualCuft > 0 ? actualCuft / 67 : 0;

      // CRITICAL FIX: Calculate transit time correctly
      let transitDays = 0;
      if (shipment.checkedInDate && shipment.createdDate) {
        try {
          const checkedIn = new Date(shipment.checkedInDate);
          const created = new Date(shipment.createdDate);

          // Make sure both dates are valid
          if (!isNaN(checkedIn.getTime()) && !isNaN(created.getTime())) {
            transitDays = Math.round((checkedIn - created) / (1000 * 60 * 60 * 24));

            // Ensure positive value
            if (transitDays < 0) transitDays = 0;
          }
        } catch (error) {
          console.warn(`Failed to calculate transit for ${shipment.fbaShipmentID}:`, error.message);
        }
      }

      // Get state from ZIP using FBA Zoning data
      const stateInfo = fbaZoningSheet.find(zone => zone.zip === shipment.shipToZip);
      const destinationState = stateInfo ? stateInfo.province : 'Unknown';
      const destinationRegion = stateInfo ? stateInfo.region : 'Unknown';

      // Calculate current total cost
      const currentTotalCost = shipment.carrierCost + actualPlacementFees;

      // Build enriched shipment object
      const enrichedShipment = {
        ...shipment,

        // CRITICAL: Use the correct cuft value
        cuft: actualCuft,
        cuftSource: cuftFromPlacement > 0 ? 'placement' : (shipment.cuftFromDataSheet > 0 ? 'data' : 'estimated'),

        // Update placement fees if we have better data
        placementFees: actualPlacementFees,

        // Calculated fields
        calculatedPallets,
        transitDays,
        destinationState,
        destinationRegion,
        currentTotalCost
      };

      // Log merge success
      if (cuftFromPlacement > 0) {
        console.log(`   ✓ Merged ${cuftFromPlacement.toFixed(2)} cuft for ${shipment.fbaShipmentID} from Placement sheet`);
      }

      return enrichedShipment;
    });
  }

  /**
   * Parse date string into Date object
   */
  parseDate(dateString) {
    if (!dateString) return null;

    try {
      // Handle different date formats
      if (typeof dateString === 'number') {
        // Excel serial date
        return this.excelSerialToDate(dateString);
      }

      // Try parsing as ISO string
      return parseISO(dateString);
    } catch (error) {
      console.warn('Failed to parse date:', dateString);
      return null;
    }
  }

  /**
   * Convert Excel serial date to JavaScript Date
   */
  excelSerialToDate(serial) {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
  }

  /**
   * Get summary statistics from parsed data
   */
  getSummary(parsedData) {
    const { dataSheet } = parsedData;

    return {
      totalShipments: dataSheet.length,
      totalUnits: dataSheet.reduce((sum, s) => sum + s.units, 0),
      totalPallets: dataSheet.reduce((sum, s) => sum + s.calculatedPallets, 0),
      totalCuft: dataSheet.reduce((sum, s) => sum + s.cuft, 0),
      totalWeight: dataSheet.reduce((sum, s) => sum + s.weight, 0),
      totalCurrentCost: dataSheet.reduce((sum, s) => sum + s.currentTotalCost, 0),
      avgTransitDays: dataSheet.reduce((sum, s) => sum + s.transitDays, 0) / dataSheet.length
    };
  }
}

export default SmashFoodsParser;
