// ============================================================================
// SMASH FOODS PARSER - COMPLETE FIX
// File: backend/utils/smashFoodsParser.js
//
// FIXES APPLIED:
// 1. Check-In column detection: Added "Shipment Status: CHECKED_IN"
// 2. Excel serial date parsing for Check-In dates
// 3. Cuft calculation from Placement sheet (handles both direct Cuft column
//    AND calculation from Storage item_volume × quantity)
// 4. 🆕 Transaction date fallback for Check-In:
//    - Primary: "Shipment Status: CHECKED_IN" from Data sheet
//    - Fallback: "Transaction date" from Placement sheet (when Check-In = "-")
//    This fixes the Get Welly issue: 77 → 110 shipments
// ============================================================================

import XLSX from 'xlsx';
import { parseISO } from 'date-fns';
import HazmatClassifier from './hazmatClassifier.js';
import { zipToState } from './zipToState.js';

/**
 * SmashFoodsParser - COMPLETE FIX VERSION
 */
class SmashFoodsParser {

  constructor() {
    this.hazmatClassifier = new HazmatClassifier();
    this.CUFT_PER_PALLET = 67;

    // State to region mapping
    this.STATE_REGIONS = {
      // West
      'CA': 'West', 'WA': 'West', 'OR': 'West', 'NV': 'West', 'AZ': 'West',
      'UT': 'West', 'CO': 'West', 'NM': 'West', 'ID': 'West', 'MT': 'West',
      'WY': 'West', 'AK': 'West', 'HI': 'West',
      // Northeast
      'NY': 'Northeast', 'NJ': 'Northeast', 'PA': 'Northeast', 'MA': 'Northeast',
      'CT': 'Northeast', 'RI': 'Northeast', 'VT': 'Northeast', 'NH': 'Northeast',
      'ME': 'Northeast', 'DE': 'Northeast', 'MD': 'Northeast', 'DC': 'Northeast',
      // Southeast
      'FL': 'Southeast', 'GA': 'Southeast', 'NC': 'Southeast', 'SC': 'Southeast',
      'VA': 'Southeast', 'WV': 'Southeast', 'AL': 'Southeast', 'MS': 'Southeast',
      'TN': 'Southeast', 'KY': 'Southeast',
      // South
      'TX': 'South', 'LA': 'South', 'OK': 'South', 'AR': 'South',
      // Midwest
      'OH': 'Midwest', 'IL': 'Midwest', 'IN': 'Midwest', 'MI': 'Midwest',
      'WI': 'Midwest', 'MN': 'Midwest', 'IA': 'Midwest', 'MO': 'Midwest',
      'ND': 'Midwest', 'SD': 'Midwest', 'NE': 'Midwest', 'KS': 'Midwest'
    };
  }

  /**
   * Parse file with optional filters
   */
  async parseFile(filePath, options = {}) {
    console.log('📊 Parsing file (COMPLETE FIX VERSION):', filePath);

    const {
      year = new Date().getFullYear(),
      startMonth = 1,
      endMonth = 12,
      shipFromZips = []
    } = options;

    const workbook = XLSX.readFile(filePath);

    const requiredSheets = ['Data', 'Placement', 'Storage'];
    const missingSheets = requiredSheets.filter(sheet => !workbook.SheetNames.includes(sheet));

    if (missingSheets.length > 0) {
      throw new Error(`Missing required sheets: ${missingSheets.join(', ')}`);
    }

    // Parse all sheets
    const storageSheet = this.parseStorageSheet(workbook.Sheets['Storage']);
    const placementSheet = this.parsePlacementSheet(workbook.Sheets['Placement'], storageSheet);

    const parsedData = {
      dataSheet: this.parseDataSheet(workbook.Sheets['Data']),
      placementSheet: placementSheet,
      storageSheet: storageSheet,
      fbaZoningSheet: workbook.Sheets['FBA Zoning']
        ? this.parseFBAZoningSheet(workbook.Sheets['FBA Zoning'])
        : [],
      hazmatSheet: null
    };

    if (workbook.Sheets['Hazmat']) {
      parsedData.hazmatSheet = this.parseHazmatSheet(workbook.Sheets['Hazmat']);
    }

    console.log(`📋 Initial Data sheet rows: ${parsedData.dataSheet.length}`);

    // Filter CLOSED status
    parsedData.dataSheet = parsedData.dataSheet.filter(row =>
      row.status && row.status.toUpperCase() === 'CLOSED'
    );
    console.log(`✅ After CLOSED filter: ${parsedData.dataSheet.length} rows`);

    // Filter by year and month range
    const beforeDateFilter = parsedData.dataSheet.length;
    parsedData.dataSheet = parsedData.dataSheet.filter(row => {
      if (!row.createdDate) return false;

      const created = new Date(row.createdDate);
      if (isNaN(created.getTime())) return false;

      const rowYear = created.getFullYear();
      const rowMonth = created.getMonth() + 1;

      if (rowYear !== year) return false;
      if (rowMonth < startMonth || rowMonth > endMonth) return false;

      return true;
    });

    console.log(`✅ After date filter (${year} ${startMonth}-${endMonth}): ${parsedData.dataSheet.length} rows`);
    console.log(`   (Filtered out ${beforeDateFilter - parsedData.dataSheet.length} rows outside date range)`);

    // Filter by Ship From ZIP (optional)
    if (shipFromZips && shipFromZips.length > 0) {
      const beforeShipFromFilter = parsedData.dataSheet.length;
      parsedData.dataSheet = parsedData.dataSheet.filter(row => {
        const shipFromZip = String(row.shipFromZip || '').trim();
        return shipFromZips.includes(shipFromZip);
      });
      console.log(`✅ After Ship From filter (${shipFromZips.join(', ')}): ${parsedData.dataSheet.length} rows`);
    }

    // Deduplicate by UNIQUE combination of Shipment Name + Shipment ID
    const rowsBeforeDedup = parsedData.dataSheet.length;
    const uniqueShipments = new Map();

    parsedData.dataSheet.forEach(shipment => {
      const uniqueKey = `${shipment.shipmentName}|${shipment.fbaShipmentID}`;
      if (!uniqueShipments.has(uniqueKey)) {
        uniqueShipments.set(uniqueKey, shipment);
      }
    });

    parsedData.dataSheet = Array.from(uniqueShipments.values());
    const duplicatesRemoved = rowsBeforeDedup - parsedData.dataSheet.length;

    console.log(`✅ After deduplication: ${parsedData.dataSheet.length} unique shipments`);
    if (duplicatesRemoved > 0) {
      console.log(`   (Removed ${duplicatesRemoved} duplicate rows)`);
    }

    // Hazmat classification
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

    // Enrich with cuft from Placement
    parsedData.dataSheet = this.enrichDataWithCalculations(parsedData);

    // =========================================================================
    // CRITICAL FILTER #1: Remove shipments with Cuft = 0
    // =========================================================================
    const beforeCuftFilter = parsedData.dataSheet.length;
    parsedData.dataSheet = parsedData.dataSheet.filter(shipment => {
      return shipment.cuft > 0;
    });
    const filteredByCuft = beforeCuftFilter - parsedData.dataSheet.length;
    console.log(`✅ After Cuft > 0 filter: ${parsedData.dataSheet.length} shipments`);
    if (filteredByCuft > 0) {
      console.log(`   (Removed ${filteredByCuft} shipments with zero cubic feet)`);
    }

    // =========================================================================
    // CRITICAL FILTER #2: Valid Check-In date
    // 🆕 FIX: Now includes Transaction date from Placement as fallback!
    //
    // Check-In sources:
    //   1. Primary: "Shipment Status: CHECKED_IN" column in Data sheet
    //   2. Fallback: "Transaction date" column in Placement sheet
    //
    // The enrichDataWithCalculations() method now populates checkedInDate
    // using Transaction date when the primary source is "-" or missing
    // =========================================================================
    const beforeCheckInFilter = parsedData.dataSheet.length;
    parsedData.dataSheet = parsedData.dataSheet.filter(shipment => {
      const checkIn = shipment.checkedInDate;

      if (!checkIn) return false;
      if (checkIn === '-') return false;
      if (String(checkIn).trim() === '') return false;

      // Validate it's a real date
      const checkInDate = new Date(checkIn);
      if (isNaN(checkInDate.getTime())) return false;

      return true;
    });
    const filteredByCheckIn = beforeCheckInFilter - parsedData.dataSheet.length;
    console.log(`✅ After Check-In filter: ${parsedData.dataSheet.length} shipments`);
    if (filteredByCheckIn > 0) {
      console.log(`   (Removed ${filteredByCheckIn} shipments without valid Check-In date)`);
    }

    // Log final filtering summary
    console.log(`\n📊 FILTERING SUMMARY:`);
    console.log(`   Original shipments (after CLOSED filter): ${beforeCuftFilter}`);
    console.log(`   Removed (zero Cuft): ${filteredByCuft}`);
    console.log(`   Removed (invalid Check-In): ${filteredByCheckIn}`);
    console.log(`   Final shipments for analysis: ${parsedData.dataSheet.length}`);

    const totalCuft = parsedData.dataSheet.reduce((sum, s) => sum + s.cuft, 0);
    const totalPallets = parsedData.dataSheet.reduce((sum, s) => sum + s.calculatedPallets, 0);

    console.log(`   Total Cuft: ${totalCuft.toFixed(2)}`);
    console.log(`   Total Pallets: ${totalPallets.toFixed(2)}`);

    // Log geographic distribution
    const stateDistribution = {};
    parsedData.dataSheet.forEach(s => {
      const state = s.destinationState || 'Unknown';
      stateDistribution[state] = (stateDistribution[state] || 0) + 1;
    });
    console.log(`\n📍 Geographic Distribution:`);
    Object.entries(stateDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([state, count]) => {
        const pct = ((count / parsedData.dataSheet.length) * 100).toFixed(1);
        console.log(`   ${state}: ${count} (${pct}%)`);
      });

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

  /**
   * 🆕 FIX: Enhanced parseDataSheet with better Check-In column detection
   */
  parseDataSheet(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);

    const headers = Object.keys(data[0] || {});
    const hasDaysSinceCreated = headers.some(h => h.toLowerCase() === 'days since created');
    const hasTotalPalletQty = headers.some(h => h.toLowerCase() === 'total pallet quantity');
    const hasCuftColumn = headers.some(h => h.toLowerCase() === 'cuft');
    const hasTotalPallets = headers.some(h => h.toLowerCase() === 'total pallets');

    // 🆕 FIX: Better Check-In column detection
    const checkedInColumn = headers.find(h => {
      const lower = h.toLowerCase();
      return lower === 'shipment status: checked_in' ||
             lower === 'checked in date' ||
             lower === 'check in' ||
             lower === 'checkin' ||
             lower === 'check-in';
    });

    console.log(`📝 Data tab format detected:`);
    console.log(`   Has "Days Since Created": ${hasDaysSinceCreated}`);
    console.log(`   Has "Cuft" column: ${hasCuftColumn}`);
    console.log(`   Has "Total Pallet Quantity": ${hasTotalPalletQty}`);
    console.log(`   Has "Total Pallets": ${hasTotalPallets}`);
    console.log(`   Check-In column found: "${checkedInColumn || 'NOT FOUND'}"`);

    const format = hasDaysSinceCreated ? 'muscle_mac' : 'smash_foods';

    return data.map(row => {
      // 🆕 FIX: Get Check-In value from the detected column
      let checkedInValue = null;
      if (checkedInColumn) {
        checkedInValue = row[checkedInColumn];
      } else {
        // Fallback to trying multiple column names
        checkedInValue = row['Shipment Status: CHECKED_IN'] ||
                        row['Checked In Date'] ||
                        row['Check In'] ||
                        row['CheckIn'] ||
                        row['Check-In'];
      }

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
        shipToZip: String(row['Ship To Postal Code'] || '').split('-')[0].replace('.0', '').trim(),
        shipToCountry: row['Ship To Country Code'] || '',
        shipFromName: row['Ship From Owner Name'] || '',
        shipFromZip: String(row['Ship From Postal Code'] || '').split('-')[0].replace('.0', '').trim(),
        shipMethod: row['Ship Method'] || '',
        carrier: row['Carrier'] || '',

        // 🆕 FIX: Parse Check-In date with Excel serial date support
        checkedInDate: this.parseDate(checkedInValue),

        format: format,
        hasDataTabCuft: hasCuftColumn
      };
    });
  }

  /**
   * 🆕 FIX: Enhanced parsePlacementSheet - calculates Cuft from Storage if not present
   */
  parsePlacementSheet(sheet, storageSheet) {
    const data = XLSX.utils.sheet_to_json(sheet);

    // Build Storage lookup by FNSKU
    const storageLookup = {};
    storageSheet.forEach(item => {
      if (item.fnsku) {
        storageLookup[item.fnsku] = item;
      }
    });

    // Check if Placement sheet has Cuft column
    const headers = Object.keys(data[0] || {});
    const hasCuftColumn = headers.some(h => h.toLowerCase() === 'cuft');
    console.log(`📦 Placement sheet has direct Cuft column: ${hasCuftColumn}`);

    return data.map(row => {
      const fnsku = row['FNSKU'] || '';
      const receivedQty = parseInt(row['Actual received quantity'] || 0);

      // 🆕 FIX: Get Cuft from column OR calculate from Storage
      let cuftValue = 0;
      let cuftSource = 'none';

      // Priority 1: Direct Cuft column in Placement
      if (hasCuftColumn && row['Cuft']) {
        cuftValue = parseFloat(row['Cuft'] || 0);
        if (cuftValue > 0) {
          cuftSource = 'placement_direct';
        }
      }

      // Priority 2: Calculate from Storage item_volume × quantity
      if (cuftValue === 0 && fnsku && receivedQty > 0) {
        const storageInfo = storageLookup[fnsku];
        if (storageInfo && storageInfo.itemVolume > 0) {
          cuftValue = storageInfo.itemVolume * receivedQty;
          cuftSource = 'calculated_from_storage';
        }
      }

      return {
        fbaShipmentID: row['FBA shipment ID'] || row['FBA Shipment ID'] || '',
        fnsku: fnsku,
        asin: row['ASIN'] || '',
        hazmatFlag: row['Hazmat'] || '',
        receivedQty: receivedQty,
        sizeTier: row['Product size tier'] || '',
        shippingWeight: parseFloat(row['Shipping weight'] || 0),
        placementFee: parseFloat(row['Total FBA inbound placement service fee charge'] || 0),
        cuft: cuftValue,
        cuftSource: cuftSource,
        totalCuft: cuftValue,  // For backward compatibility

        // 🆕 FIX: Transaction date for Check-In fallback
        transactionDate: row['Transaction date'] || null
      };
    });
  }

  parseStorageSheet(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);

    return data.map(row => {
      // Calculate item volume from dimensions if not directly provided
      let itemVolume = parseFloat(row['item_volume'] || 0);

      if (itemVolume === 0) {
        const longest = parseFloat(row['longest_side'] || 0);
        const median = parseFloat(row['median_side'] || 0);
        const shortest = parseFloat(row['shortest_side'] || 0);

        if (longest > 0 && median > 0 && shortest > 0) {
          // Dimensions are in inches, convert cubic inches to cubic feet
          const cubicInches = longest * median * shortest;
          itemVolume = cubicInches / 1728;
        }
      }

      return {
        asin: row['asin'] || '',
        fnsku: row['fnsku'] || '',
        product_name: row['product_name'] || '',
        itemVolume: itemVolume,
        weight: parseFloat(row['weight'] || 0),
        sizeTier: row['product_size_tier'] || '',
        Hazmat: row['Hazmat'] || '',
        dangerous_goods_storage_type: row['dangerous_goods_storage_type'] || ''
      };
    });
  }

  parseFBAZoningSheet(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);

    return data.map(row => ({
      zip: String(row['Zip'] || '').trim(),
      province: row['Province'] || '',
      fba: row['FBA'] || '',
      region: row['2 Region'] || ''
    }));
  }

  /**
   * Get state from ZIP code using multiple sources
   */
  getStateFromZip(zipCode, fbaZoningSheet) {
    if (!zipCode) {
      return { state: 'Unknown', region: 'Unknown' };
    }

    const cleanZip = String(zipCode).split('-')[0].replace('.0', '').trim();

    // Check if it's a Canadian postal code
    if (/^[A-Z]\d[A-Z]/i.test(cleanZip)) {
      return { state: 'Canada', region: 'International' };
    }

    // Priority 1: Try FBA Zoning sheet
    const stateInfo = fbaZoningSheet.find(zone => zone.zip === cleanZip);
    if (stateInfo && stateInfo.province) {
      return {
        state: stateInfo.province,
        region: stateInfo.region || this.STATE_REGIONS[stateInfo.province] || 'Other'
      };
    }

    // Priority 2: Use zipToState utility as fallback
    const stateFromZip = zipToState(cleanZip);
    if (stateFromZip) {
      return {
        state: stateFromZip.code,
        region: this.STATE_REGIONS[stateFromZip.code] || 'Other'
      };
    }

    // If ZIP is too short, try padding with zeros
    if (cleanZip.length < 5 && /^\d+$/.test(cleanZip)) {
      const paddedZip = cleanZip.padStart(5, '0');
      const stateFromPadded = zipToState(paddedZip);
      if (stateFromPadded) {
        return {
          state: stateFromPadded.code,
          region: this.STATE_REGIONS[stateFromPadded.code] || 'Other'
        };
      }
    }

    return { state: 'Unknown', region: 'Unknown' };
  }

  /**
   * 🆕 FIX: Enhanced parseDate with Excel serial date support
   */
  parseDate(dateValue) {
    if (!dateValue) return null;
    if (dateValue === '-' || dateValue === '') return null;

    try {
      // Already a Date object
      if (dateValue instanceof Date) {
        if (!isNaN(dateValue.getTime())) {
          return dateValue.toISOString();
        }
        return null;
      }

      // 🆕 FIX: Excel serial date (number like 45940)
      if (typeof dateValue === 'number') {
        // Excel dates are days since 1899-12-30
        // 25569 is the number of days between 1899-12-30 and 1970-01-01
        const jsDate = new Date((dateValue - 25569) * 86400 * 1000);
        if (!isNaN(jsDate.getTime())) {
          return jsDate.toISOString();
        }
        return null;
      }

      // String date - try parsing
      if (typeof dateValue === 'string') {
        const trimmed = dateValue.trim();
        if (trimmed === '' || trimmed === '-') return null;

        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString();
        }
      }
    } catch (error) {
      // Silent fail
    }

    return null;
  }

  /**
   * Enrich data with calculations including Cuft from Placement
   */
  enrichDataWithCalculations(parsedData) {
    const { dataSheet, placementSheet, storageSheet, fbaZoningSheet, hazmatLookupMap } = parsedData;

    // Build Cuft aggregation from Placement by Shipment ID
    const placementCuftMap = {};
    const placementQtyMap = {};
    const placementFeesMap = {};
    const placementAsinMap = {};

    placementSheet.forEach(item => {
      const shipmentID = item.fbaShipmentID;
      if (!shipmentID) return;

      if (!placementCuftMap[shipmentID]) {
        placementCuftMap[shipmentID] = 0;
        placementQtyMap[shipmentID] = 0;
        placementFeesMap[shipmentID] = 0;
        placementAsinMap[shipmentID] = new Set();
      }

      // 🆕 FIX: Use the cuft calculated in parsePlacementSheet
      placementCuftMap[shipmentID] += item.cuft || 0;
      placementQtyMap[shipmentID] += item.receivedQty || 0;
      placementFeesMap[shipmentID] += item.placementFee || 0;

      if (item.asin) {
        placementAsinMap[shipmentID].add(item.asin);
      }
    });

    console.log(`   Placement data for ${Object.keys(placementCuftMap).length} unique shipment IDs`);

    // 🆕 FIX: Build Transaction date lookup (latest date per shipment) for Check-In fallback
    const transactionDateMap = {};
    placementSheet.forEach(item => {
      const shipmentID = item.fbaShipmentID;
      const txDate = this.parseDate(item.transactionDate);

      if (shipmentID && txDate) {
        // Keep the latest transaction date per shipment
        if (!transactionDateMap[shipmentID] || new Date(txDate) > new Date(transactionDateMap[shipmentID])) {
          transactionDateMap[shipmentID] = txDate;
        }
      }
    });
    console.log(`   Transaction dates for ${Object.keys(transactionDateMap).length} shipments (for Check-In fallback)`);

    // Log Cuft sources from Placement
    const cuftSourceCounts = {};
    placementSheet.forEach(item => {
      const source = item.cuftSource || 'unknown';
      cuftSourceCounts[source] = (cuftSourceCounts[source] || 0) + 1;
    });
    console.log(`   Placement Cuft sources:`);
    Object.entries(cuftSourceCounts).forEach(([source, count]) => {
      console.log(`      ${source}: ${count} rows`);
    });

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
      // Priority 2: Placement aggregation (now includes calculated values)
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

      // Round cuft
      const roundedCuft = Math.round(actualCuft * 100) / 100;
      const roundedPallets = roundedCuft > 0 ? roundedCuft / this.CUFT_PER_PALLET : 0;

      // Handle placement fees
      const placementFeesFromSheet = placementFeesMap[shipment.fbaShipmentID];
      const actualPlacementFees = placementFeesFromSheet !== undefined && placementFeesFromSheet > 0
        ? placementFeesFromSheet
        : shipment.placementFees;

      // 🆕 FIX: Check-In date with Transaction date fallback
      let actualCheckedInDate = shipment.checkedInDate;
      let checkedInSource = 'data_sheet';

      // If Check-In is missing or "-", use Transaction date from Placement as fallback
      if (!actualCheckedInDate || actualCheckedInDate === '-') {
        const txDate = transactionDateMap[shipment.fbaShipmentID];
        if (txDate) {
          actualCheckedInDate = txDate;
          checkedInSource = 'transaction_date';
        }
      }

      // Transit time calculation (using resolved Check-In date)
      let transitDays = 0;
      if (actualCheckedInDate && shipment.createdDate) {
        try {
          const checkedIn = new Date(actualCheckedInDate);
          const created = new Date(shipment.createdDate);

          if (!isNaN(checkedIn.getTime()) && !isNaN(created.getTime())) {
            transitDays = Math.round((checkedIn - created) / (1000 * 60 * 60 * 24));
            if (transitDays < 0) transitDays = 0;
          }
        } catch (error) {
          // Silent
        }
      }

      // State lookup
      const { state: destinationState, region: destinationRegion } =
        this.getStateFromZip(shipment.shipToZip, fbaZoningSheet);

      const currentTotalCost = shipment.carrierCost + actualPlacementFees;

      // Hazmat detection
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
        checkedInDate: actualCheckedInDate,  // 🆕 FIX: Updated with Transaction date fallback
        checkedInSource,                      // 🆕 FIX: Track source of Check-In date
        cuft: roundedCuft,
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

    // Log cuft sources summary
    const cuftSources = {};
    enrichedShipments.forEach(s => {
      cuftSources[s.cuftSource] = (cuftSources[s.cuftSource] || 0) + 1;
    });

    console.log(`   Final Cuft sources:`);
    Object.entries(cuftSources).forEach(([source, count]) => {
      console.log(`      ${source}: ${count} shipments`);
    });

    // 🆕 FIX: Log Check-In sources summary
    const checkinSources = {};
    enrichedShipments.forEach(s => {
      checkinSources[s.checkedInSource] = (checkinSources[s.checkedInSource] || 0) + 1;
    });

    console.log(`   Check-In sources:`);
    Object.entries(checkinSources).forEach(([source, count]) => {
      console.log(`      ${source}: ${count} shipments`);
    });

    return enrichedShipments;
  }

  /**
   * Generate summary statistics from parsed data
   */
  getSummary(parsedData) {
    const { dataSheet, hazmatClassification } = parsedData;

    const shipments = dataSheet || [];

    // Calculate totals
    const totalShipments = shipments.length;
    const totalUnits = shipments.reduce((sum, s) => sum + (s.units || 0), 0);
    const totalPallets = shipments.reduce((sum, s) => sum + (s.calculatedPallets || 0), 0);
    const totalCuft = shipments.reduce((sum, s) => sum + (s.cuft || 0), 0);
    const totalWeight = shipments.reduce((sum, s) => sum + (s.weight || 0), 0);

    // Calculate averages
    const avgTransitDays = totalShipments > 0
      ? shipments.reduce((sum, s) => sum + (s.transitDays || 0), 0) / totalShipments
      : 0;

    // Date range
    const dates = shipments
      .map(s => s.createdDate)
      .filter(d => d)
      .map(d => new Date(d))
      .filter(d => !isNaN(d.getTime()));

    const startDate = dates.length > 0 ? new Date(Math.min(...dates)) : null;
    const endDate = dates.length > 0 ? new Date(Math.max(...dates)) : null;

    return {
      totalShipments,
      totalUnits,
      totalPallets: parseFloat(totalPallets.toFixed(2)),
      totalCuft: parseFloat(totalCuft.toFixed(2)),
      totalWeight: parseFloat(totalWeight.toFixed(2)),
      avgTransitDays: parseFloat(avgTransitDays.toFixed(1)),

      // Hazmat summary
      hazmatProducts: hazmatClassification?.summary?.hazmatCount || 0,
      nonHazmatProducts: hazmatClassification?.summary?.nonHazmatCount || 0,

      // Date range
      dateRange: {
        start: startDate ? startDate.toISOString().split('T')[0] : null,
        end: endDate ? endDate.toISOString().split('T')[0] : null
      }
    };
  }
}

export default SmashFoodsParser;
