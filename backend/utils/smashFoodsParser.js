// ============================================================================
// SMASH FOODS PARSER - FIXED VERSION
// Fixes:
// 1. Added date range filtering (to match pivot table)
// 2. Added Ship From filter option
// 3. Fixed state lookup to use zipToState.js as fallback
// 4. Handle Canadian postal codes
// File: backend/utils/smashFoodsParser.js
// ============================================================================

import XLSX from 'xlsx';
import { parseISO } from 'date-fns';
import HazmatClassifier from './hazmatClassifier.js';
import { zipToState } from './zipToState.js';  // 🆕 Import zipToState utility

/**
 * SmashFoodsParser - FIXED VERSION
 *
 * Changes from original:
 * 1. Filter to current year by default
 * 2. Optional month range filter
 * 3. Optional Ship From filter (warehouse)
 * 4. Fallback to zipToState.js for geographic lookup
 */
class SmashFoodsParser {

  constructor() {
    this.hazmatClassifier = new HazmatClassifier();
    this.CUFT_PER_PALLET = 67;

    // 🆕 State to region mapping
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
   * @param {string} filePath - Path to Excel file
   * @param {Object} options - Optional filters
   * @param {number} options.year - Filter to specific year (default: current year)
   * @param {number} options.startMonth - Start month (1-12, inclusive)
   * @param {number} options.endMonth - End month (1-12, inclusive)
   * @param {Array<string>} options.shipFromZips - Filter by Ship From ZIP codes
   */
  async parseFile(filePath, options = {}) {
    console.log('📊 Parsing file (FIXED VERSION):', filePath);

    const {
      year = new Date().getFullYear(),
      startMonth = 1,
      endMonth = 12,
      shipFromZips = []  // Empty = all, or ['91761', '215124'] for specific warehouses
    } = options;

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

    // 🆕 FIX #1: Filter by year and month range
    const beforeDateFilter = parsedData.dataSheet.length;
    parsedData.dataSheet = parsedData.dataSheet.filter(row => {
      if (!row.createdDate) return false;

      const created = new Date(row.createdDate);
      if (isNaN(created.getTime())) return false;

      const rowYear = created.getFullYear();
      const rowMonth = created.getMonth() + 1; // 1-12

      // Check year
      if (rowYear !== year) return false;

      // Check month range
      if (rowMonth < startMonth || rowMonth > endMonth) return false;

      return true;
    });

    console.log(`✅ After date filter (${year} ${startMonth}-${endMonth}): ${parsedData.dataSheet.length} rows`);
    console.log(`   (Filtered out ${beforeDateFilter - parsedData.dataSheet.length} rows outside date range)`);

    // 🆕 FIX #2: Filter by Ship From ZIP (optional)
    if (shipFromZips && shipFromZips.length > 0) {
      const beforeShipFromFilter = parsedData.dataSheet.length;
      parsedData.dataSheet = parsedData.dataSheet.filter(row => {
        const shipFromZip = String(row.shipFromZip || '').trim();
        return shipFromZips.includes(shipFromZip);
      });
      console.log(`✅ After Ship From filter (${shipFromZips.join(', ')}): ${parsedData.dataSheet.length} rows`);
      console.log(`   (Filtered out ${beforeShipFromFilter - parsedData.dataSheet.length} rows from other origins)`);
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

    const shipmentsWithCuft = parsedData.dataSheet.filter(s => s.cuft > 0).length;
    const shipmentsWithoutCuft = parsedData.dataSheet.filter(s => s.cuft === 0).length;

    console.log(`✅ Total shipments: ${parsedData.dataSheet.length}`);
    console.log(`   ✓ With cuft > 0: ${shipmentsWithCuft}`);
    console.log(`   ✓ With cuft = 0: ${shipmentsWithoutCuft}`);

    const totalCuft = parsedData.dataSheet.reduce((sum, s) => sum + s.cuft, 0);
    const totalPallets = parsedData.dataSheet.reduce((sum, s) => sum + s.calculatedPallets, 0);

    console.log(`   Total Cuft: ${totalCuft.toFixed(2)}`);
    console.log(`   Total Pallets: ${totalPallets.toFixed(2)}`);

    // 🆕 Log geographic distribution
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
        shipToZip: String(row['Ship To Postal Code'] || '').split('-')[0].replace('.0', '').trim(),
        shipToCountry: row['Ship To Country Code'] || '',
        shipFromName: row['Ship From Owner Name'] || '',
        shipFromZip: String(row['Ship From Postal Code'] || '').split('-')[0].replace('.0', '').trim(),  // 🆕 Added for filtering
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
      zip: String(row['Zip'] || '').trim(),
      province: row['Province'] || '',
      fba: row['FBA'] || '',
      region: row['2 Region'] || ''
    }));
  }

  /**
   * 🆕 Get state from ZIP code using multiple sources
   */
  getStateFromZip(zipCode, fbaZoningSheet) {
    if (!zipCode) {
      return { state: 'Unknown', region: 'Unknown' };
    }

    const cleanZip = String(zipCode).split('-')[0].replace('.0', '').trim();

    // Check if it's a Canadian postal code (e.g., "L0R 1W1", "K2J 7C7")
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
        state: stateFromZip.code,  // e.g., "CA", "NY"
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
   * Enrich data with cuft calculations - FIXED VERSION
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

      // Round cuft to match Apps Script
      const roundedCuft = Math.round(actualCuft * 100) / 100;
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

      // 🆕 FIX #3: Use improved state lookup with fallback
      const { state: destinationState, region: destinationRegion } =
        this.getStateFromZip(shipment.shipToZip, fbaZoningSheet);

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

  /**
   * Parse date string
   */
  parseDate(dateValue) {
    if (!dateValue) return null;

    try {
      if (dateValue instanceof Date) {
        return dateValue.toISOString();
      }

      if (typeof dateValue === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        const jsDate = new Date(excelEpoch.getTime() + dateValue * 86400000);
        return jsDate.toISOString();
      }

      const parsed = new Date(dateValue);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    } catch (error) {
      // Silent
    }

    return null;
  }

  /**
   * 🆕 Generate summary statistics from parsed data
   * Required by SmashFoodsIntegration.analyzeSmashFoodsFile()
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
