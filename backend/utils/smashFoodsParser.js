// ============================================================================
// SMASH FOODS PARSER - COMPLETE FIX + ZERO CUFT PATCH APPLIED
// File: backend/utils/smashFoodsParser.js
//
// FIXES APPLIED:
// 1. Check-In column detection: Added "Shipment Status: CHECKED_IN"
// 2. Excel serial date parsing for Check-In dates
// 3. Transaction date fallback for Check-In:
//    - Primary: "Shipment Status: CHECKED_IN" from Data sheet
//    - Fallback: "Transaction date" from Placement sheet (when Check-In = "-")
// 4. 🆕 CUFT/PALLET FIX: Use "Total Cuft" column from Placement sheet
//    - Priority 1: Placement "Total Cuft" (line total, matches manual SUMIF)
//    - Priority 2: Placement "Cuft" × Qty (per-unit × quantity)
//    - Priority 3: Storage item_volume × Qty (last resort fallback)
// 5. ✅ FBA ID NORMALIZATION: Normalize FBA Shipment IDs for consistent matching
//    - Handles case sensitivity (FBA123 vs fba123)
//    - Removes whitespace
//    - Prevents zero-cuft mismatch errors
// 6. ✅ DIAGNOSTIC LOGGING: Added extensive logging to debug ID mismatches
// 7. ✅ BETTER ERROR MESSAGES: Clear errors when all shipments filtered out
// ============================================================================

import XLSX from 'xlsx';
import { parseISO } from 'date-fns';
import HazmatClassifier from './hazmatClassifier.js';
import { zipToState } from './zipToState.js';
import { findColumn } from './fileEnhancer.js';

/**
 * SmashFoodsParser - COMPLETE FIX VERSION WITH ZERO CUFT PATCH
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
   * ✅ NEW: Normalize FBA Shipment ID for consistent matching
   * Handles case differences, whitespace, and special characters
   */
  normalizeFBAID(id) {
    if (!id) return null;
    return String(id).trim().toUpperCase().replace(/\s+/g, '');
  }

  /**
   * Parse file with optional filters
   */
  async parseFile(filePath, options = {}) {
    console.log('📊 Parsing file (COMPLETE FIX VERSION + ZERO CUFT PATCH):', filePath);

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

    // 🆕 FIX: First, try filtering with the requested year
    let filteredByDate = parsedData.dataSheet.filter(row => {
      if (!row.createdDate) return false;

      const created = new Date(row.createdDate);
      if (isNaN(created.getTime())) return false;

      const rowYear = created.getFullYear();
      const rowMonth = created.getMonth() + 1;

      if (rowYear !== year) return false;
      if (rowMonth < startMonth || rowMonth > endMonth) return false;

      return true;
    });

    // 🆕 ENHANCED FIX: If no results found, auto-detect year prioritizing Placement data matches
    if (filteredByDate.length === 0 && beforeDateFilter > 0) {
      console.log(`⚠️ No shipments found for year ${year}. Auto-detecting year from data...`);

      // Build a set of shipment IDs that have Placement data (for cuft lookup)
      const placementShipmentIDs = new Set();
      if (parsedData.placementSheet && parsedData.placementSheet.length > 0) {
        parsedData.placementSheet.forEach(item => {
          if (item.fbaShipmentID) {
            // ✅ NORMALIZE when building the set
            placementShipmentIDs.add(this.normalizeFBAID(item.fbaShipmentID));
          }
        });
      }
      console.log(`   📦 Placement sheet has ${placementShipmentIDs.size} unique shipment IDs`);

      // Find all years present in the data WITH match counts
      const yearsInData = new Map();
      parsedData.dataSheet.forEach(row => {
        if (row.createdDate) {
          const created = new Date(row.createdDate);
          if (!isNaN(created.getTime())) {
            const rowYear = created.getFullYear();
            if (!yearsInData.has(rowYear)) {
              yearsInData.set(rowYear, { total: 0, withPlacement: 0 });
            }
            const yearData = yearsInData.get(rowYear);
            yearData.total += 1;

            // ✅ NORMALIZE when checking for match
            // Check if this shipment has Placement data (which means it has Cuft)
            if (row.fbaShipmentID && placementShipmentIDs.has(this.normalizeFBAID(row.fbaShipmentID))) {
              yearData.withPlacement += 1;
            }
          }
        }
      });

      if (yearsInData.size > 0) {
        // Log all years with their match counts
        console.log(`📅 Years found in data:`);
        const sortedYears = Array.from(yearsInData.entries()).sort((a, b) => b[0] - a[0]);
        sortedYears.forEach(([yr, data]) => {
          const matchPercent = data.total > 0 ? Math.round((data.withPlacement / data.total) * 100) : 0;
          console.log(`      ${yr}: ${data.total} total, ${data.withPlacement} with Placement data (${matchPercent}%)`);
        });

        // 🆕 SMART SELECTION: Prioritize years with Placement data matches
        // Strategy: Pick the year with MOST shipments that have Placement data
        // If tie, prefer the most recent year
        let detectedYear = year;
        let maxPlacementMatches = 0;

        sortedYears.forEach(([yr, data]) => {
          if (data.withPlacement > maxPlacementMatches) {
            maxPlacementMatches = data.withPlacement;
            detectedYear = yr;
          } else if (data.withPlacement === maxPlacementMatches && data.withPlacement > 0 && yr > detectedYear) {
            // Tie-breaker: prefer more recent year
            detectedYear = yr;
          }
        });

        // Fallback: If no year has Placement matches, use the most recent year with most data
        if (maxPlacementMatches === 0) {
          console.log(`   ⚠️ No years have Placement data matches, falling back to most recent year`);
          let maxTotal = 0;
          sortedYears.forEach(([yr, data]) => {
            if (data.total > maxTotal) {
              maxTotal = data.total;
              detectedYear = yr;
            }
          });
        }

        const selectedYearData = yearsInData.get(detectedYear);
        console.log(`✅ Auto-selected year ${detectedYear} (${selectedYearData?.withPlacement || 0} shipments with Placement data, ${selectedYearData?.total || 0} total)`);

        // Re-filter with detected year
        filteredByDate = parsedData.dataSheet.filter(row => {
          if (!row.createdDate) return false;

          const created = new Date(row.createdDate);
          if (isNaN(created.getTime())) return false;

          const rowYear = created.getFullYear();

          if (rowYear !== detectedYear) return false;
          // When auto-detecting, include all months (1-12) to get maximum data

          return true;
        });

        console.log(`✅ After auto-detected date filter (${detectedYear} all months): ${filteredByDate.length} rows`);
      }
    }
    // ✅ NEW: Additional check - if filtered results have zero Placement matches, retry with auto-detection
    else if (filteredByDate.length > 0) {
      console.log(`\n🔍 Checking if filtered shipments have Placement data...`);

      const placementShipmentIDs = new Set();
      if (parsedData.placementSheet && parsedData.placementSheet.length > 0) {
        parsedData.placementSheet.forEach(item => {
          if (item.fbaShipmentID) {
            placementShipmentIDs.add(this.normalizeFBAID(item.fbaShipmentID));
          }
        });
      }

      // Count how many of our filtered shipments have Placement data
      const matchedCount = filteredByDate.filter(row =>
        placementShipmentIDs.has(this.normalizeFBAID(row.fbaShipmentID))
      ).length;

      const matchRate = (matchedCount / filteredByDate.length) * 100;
      console.log(`   Match rate: ${matchedCount}/${filteredByDate.length} (${matchRate.toFixed(1)}%)`);

      // ✅ KEY FIX: If less than 10% match, we have the wrong date range
      if (matchRate < 10) {
        console.warn(`\n⚠️  WARNING: Only ${matchRate.toFixed(1)}% of filtered shipments have Placement data!`);
        console.warn(`   The requested date range (${year} ${startMonth}-${endMonth}) likely doesn't match Placement sheet dates.`);
        console.warn(`   Auto-detecting optimal date range...\n`);

        // Find years in data WITH Placement matches
        const yearsInData = new Map();
        parsedData.dataSheet.forEach(row => {
          if (row.createdDate) {
            const created = new Date(row.createdDate);
            if (!isNaN(created.getTime())) {
              const rowYear = created.getFullYear();
              if (!yearsInData.has(rowYear)) {
                yearsInData.set(rowYear, { total: 0, withPlacement: 0 });
              }
              const yearData = yearsInData.get(rowYear);
              yearData.total += 1;

              if (row.fbaShipmentID && placementShipmentIDs.has(this.normalizeFBAID(row.fbaShipmentID))) {
                yearData.withPlacement += 1;
              }
            }
          }
        });

        // Find year with most Placement matches
        let bestYear = year;
        let maxMatches = 0;

        Array.from(yearsInData.entries()).forEach(([yr, data]) => {
          if (data.withPlacement > maxMatches) {
            maxMatches = data.withPlacement;
            bestYear = yr;
          }
        });

        if (maxMatches > 0) {
          console.log(`✅ Found better year: ${bestYear} with ${maxMatches} Placement matches`);
          console.log(`   Switching from ${year} to ${bestYear}...\n`);

          // Re-filter with the better year
          filteredByDate = parsedData.dataSheet.filter(row => {
            if (!row.createdDate) return false;
            const created = new Date(row.createdDate);
            if (isNaN(created.getTime())) return false;
            return created.getFullYear() === bestYear;
          });

          console.log(`✅ After auto-correction: ${filteredByDate.length} shipments from ${bestYear}`);
        }
      }
    }

    parsedData.dataSheet = filteredByDate;

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
    // ✅ PATCHED: CRITICAL FILTER #1 - Remove shipments with Cuft = 0
    // NOW WITH BETTER ERROR HANDLING AND DIAGNOSTICS
    // =========================================================================
    const beforeCuftFilter = parsedData.dataSheet.length;

    // Track zero-cuft shipments for diagnostics
    const zeroCuftShipments = parsedData.dataSheet.filter(s => s.cuft === 0);
    if (zeroCuftShipments.length > 0) {
      console.warn(`\n⚠️  WARNING: ${zeroCuftShipments.length} shipments have zero Cuft!`);
      console.warn(`   Sample zero-cuft shipments (first 5):`);
      zeroCuftShipments.slice(0, 5).forEach(s => {
        console.warn(`   - ${s.fbaShipmentID} (${s.shipmentName}) - Source: ${s.cuftSource || 'unknown'}`);
      });
      console.warn(`   This likely indicates missing Placement data for these shipments.\n`);
    }

    // Filter out zero-cuft shipments
    parsedData.dataSheet = parsedData.dataSheet.filter(shipment => {
      return shipment.cuft > 0;
    });

    const filteredByCuft = beforeCuftFilter - parsedData.dataSheet.length;
    console.log(`✅ After Cuft > 0 filter: ${parsedData.dataSheet.length} shipments`);
    if (filteredByCuft > 0) {
      console.log(`   (Removed ${filteredByCuft} shipments with zero cubic feet)`);
    }

    // ✅ PATCHED: Add error prevention with helpful message
    if (parsedData.dataSheet.length === 0 && beforeCuftFilter > 0) {
      throw new Error(
        `All ${beforeCuftFilter} shipments were filtered out due to zero Cuft. ` +
        `This indicates a data mismatch between Data and Placement sheets. ` +
        `Please ensure:\n` +
        `1. Placement sheet contains cuft data for the same FBA Shipment IDs as the Data sheet\n` +
        `2. The FBA Shipment ID column names match between sheets (case-sensitive)\n` +
        `3. The date range filter hasn't excluded all Placement data\n` +
        `Sample zero-cuft IDs: ${zeroCuftShipments.slice(0, 3).map(s => s.fbaShipmentID).join(', ')}`
      );
    }

    // =========================================================================
    // CRITICAL FILTER #2: Remove shipments without Check-In date
    // =========================================================================
    const beforeCheckInFilter = parsedData.dataSheet.length;
    parsedData.dataSheet = parsedData.dataSheet.filter(shipment => {
      return shipment.checkedInDate && shipment.checkedInDate !== '-';
    });
    const filteredByCheckIn = beforeCheckInFilter - parsedData.dataSheet.length;

    console.log(`✅ After Check-In filter: ${parsedData.dataSheet.length} shipments`);
    if (filteredByCheckIn > 0) {
      console.log(`   (Removed ${filteredByCheckIn} shipments without Check-In date)`);
    }

    // Final summary
    console.log(`\n📊 FILTERING SUMMARY:`);
    console.log(`   Original shipments (after CLOSED filter): ${beforeDateFilter}`);
    console.log(`   Removed (zero Cuft): ${filteredByCuft}`);
    console.log(`   Removed (invalid Check-In): ${filteredByCheckIn}`);
    console.log(`   Final shipments for analysis: ${parsedData.dataSheet.length}`);
    console.log(`   Total Cuft: ${parsedData.dataSheet.reduce((sum, s) => sum + s.cuft, 0).toFixed(2)}`);
    console.log(`   Total Pallets: ${parsedData.dataSheet.reduce((sum, s) => sum + s.calculatedPallets, 0).toFixed(2)}`);

    // Geographic distribution
    const stateBreakdown = {};
    parsedData.dataSheet.forEach(s => {
      const state = s.destinationState || 'Unknown';
      stateBreakdown[state] = (stateBreakdown[state] || 0) + 1;
    });

    console.log(`\n📍 Geographic Distribution:`);
    Object.entries(stateBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([state, count]) => {
        const pct = ((count / parsedData.dataSheet.length) * 100).toFixed(1);
        console.log(`   ${state}: ${count} shipments (${pct}%)`);
      });

    // Check-In source summary
    const checkInSources = {};
    parsedData.dataSheet.forEach(s => {
      const source = s.checkedInSource || 'unknown';
      checkInSources[source] = (checkInSources[source] || 0) + 1;
    });
    console.log(`\n📅 Check-In sources:`);
    Object.entries(checkInSources).forEach(([source, count]) => {
      console.log(`   ${source}: ${count} shipments`);
    });

    // Cuft source summary
    const cuftSources = {};
    parsedData.dataSheet.forEach(s => {
      const source = s.cuftSource || 'unknown';
      cuftSources[source] = (cuftSources[source] || 0) + 1;
    });
    console.log(`\n📏 Final Cuft sources:`);
    Object.entries(cuftSources).forEach(([source, count]) => {
      console.log(`   ${source}: ${count} shipments`);
    });

    return parsedData;
  }

  /**
   * Parse Data sheet
   */
  parseDataSheet(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

    if (data.length === 0) {
      return [];
    }

    // Get all column headers
    const headers = Object.keys(data[0]);

    // Find critical columns using flexible matching
    const shipmentNameCol = findColumn(headers, [
      'Shipment Name',
      'Shipment name',
      'shipment name',
      'Name'
    ]);

    const fbaIdCol = findColumn(headers, [
      'FBA Shipment ID',
      'FBA ID',
      'Shipment ID',
      'fba shipment id',
      'FBA shipment ID'
    ]);

    const statusCol = findColumn(headers, [
      'Status',
      'status',
      'Shipment Status'
    ]);

    const createdDateCol = findColumn(headers, [
      'Created Date',
      'Created date',
      'created date',
      'Ship date',
      'Transaction date'
    ]);

    // 🆕 FIX: Enhanced Check-In column detection
    const checkedInDateCol = findColumn(headers, [
      'Shipment Status: CHECKED_IN',  // ✅ NEW: Primary column to check
      'Checked-In Date',
      'Checked In Date',
      'CheckedIn Date',
      'Check-In Date',
      'Shipment Status CHECKED_IN',
      'CHECKED_IN'
    ]);

    const unitsCol = findColumn(headers, [
      'Total Units Located',
      'Units',
      'Total Shipped Qty',
      'Total Located Qty'
    ]);

    const carrierCostCol = findColumn(headers, [
      'Amazon Partnered Carrier Cost',
      'Carrier Cost',
      'Freight Cost'
    ]);

    const placementFeesCol = findColumn(headers, [
      'Chosen Placement Fee',
      'Placement Fees',
      'Placement Fee'
    ]);

    const cuftCol = findColumn(headers, [
      'Cuft',
      'CUFT',
      'Cubic Feet',
      'Volume'
    ]);

    const palletQtyCol = findColumn(headers, [
      'Total Pallet Quantity',
      'Total Pallets',
      'Pallets',
      'Pallet Quantity'
    ]);

    const shipToZipCol = findColumn(headers, [
      'Ship To Postal Code',
      'Ship to ZIP',
      'Ship to Postal Code',
      'Destination ZIP'
    ]);

    const shipFromZipCol = findColumn(headers, [
      'Ship From ZIP',
      'From ZIP',
      'Origin ZIP',
      'Warehouse ZIP'
    ]);

    const destinationCol = findColumn(headers, [
      'Destination FC',
      'Destination Fulfillment Center ID',
      'Destination',
      'FC'
    ]);

    const carrierCol = findColumn(headers, [
      'Carrier',
      'carrier',
      'Shipping Carrier'
    ]);

    const weightCol = findColumn(headers, [
      'Weight',
      'Total Weight',
      'Total Weight (lbs)'
    ]);

    // Parse rows
    const parsedRows = data.map(row => {
      const shipmentName = shipmentNameCol !== -1 ? row[headers[shipmentNameCol]] : null;
      const fbaShipmentID = fbaIdCol !== -1 ? row[headers[fbaIdCol]] : null;
      const status = statusCol !== -1 ? row[headers[statusCol]] : null;

      // 🆕 FIX: Parse Check-In with Excel serial date support
      const checkedInRaw = checkedInDateCol !== -1 ? row[headers[checkedInDateCol]] : null;
      const checkedInDate = this.parseDate(checkedInRaw);

      const createdDateRaw = createdDateCol !== -1 ? row[headers[createdDateCol]] : null;
      const createdDate = this.parseDate(createdDateRaw);

      const units = unitsCol !== -1 ? parseFloat(row[headers[unitsCol]]) || 0 : 0;
      const carrierCost = carrierCostCol !== -1 ? parseFloat(row[headers[carrierCostCol]]) || 0 : 0;
      const placementFees = placementFeesCol !== -1 ? parseFloat(row[headers[placementFeesCol]]) || 0 : 0;

      // Cuft from Data sheet (if available)
      const cuftFromDataSheet = cuftCol !== -1 ? parseFloat(row[headers[cuftCol]]) || 0 : 0;
      const hasDataTabCuft = cuftCol !== -1 && cuftFromDataSheet > 0;

      const palletQuantity = palletQtyCol !== -1 ? parseFloat(row[headers[palletQtyCol]]) || 0 : 0;

      const shipToZip = shipToZipCol !== -1 ? String(row[headers[shipToZipCol]] || '').trim() : null;
      const shipFromZip = shipFromZipCol !== -1 ? String(row[headers[shipFromZipCol]] || '').trim() : null;

      const destinationFC = destinationCol !== -1 ? row[headers[destinationCol]] : null;
      const carrier = carrierCol !== -1 ? row[headers[carrierCol]] : null;
      const weight = weightCol !== -1 ? parseFloat(row[headers[weightCol]]) || 0 : 0;

      return {
        shipmentName,
        fbaShipmentID,
        status,
        createdDate,
        checkedInDate,
        units,
        carrierCost,
        placementFees,
        cuftFromDataSheet,
        hasDataTabCuft,
        palletQuantity,
        shipToZip,
        shipFromZip,
        destinationFC,
        carrier,
        weight
      };
    });

    // Log tab format detection
    console.log(`📝 Data tab format detected:`);
    console.log(`   Has "Days Since Created": ${headers.some(h => h.toLowerCase().includes('days since created'))}`);
    console.log(`   Has "Cuft" column: ${cuftCol !== -1}`);
    console.log(`   Has "Total Pallet Quantity": ${palletQtyCol !== -1}`);
    console.log(`   Has "Total Pallets": ${headers.some(h => h.toLowerCase() === 'total pallets')}`);
    console.log(`   Check-In column found: ${checkedInDateCol !== -1 ? `"${headers[checkedInDateCol]}"` : 'NO'}`);

    return parsedRows;
  }

  /**
   * Parse Placement sheet with CORRECT Total Cuft handling
   */
  parsePlacementSheet(sheet, storageSheet) {
    const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

    if (data.length === 0) {
      return [];
    }

    const headers = Object.keys(data[0]);

    // Find columns
    const fbaIdCol = findColumn(headers, [
      'FBA shipment ID',
      'FBA Shipment ID',
      'Shipping plan ID',
      'FBA ID'
    ]);

    const fnskuCol = findColumn(headers, [
      'FNSKU',
      'fnsku'
    ]);

    const asinCol = findColumn(headers, [
      'ASIN',
      'asin'
    ]);

    const receivedQtyCol = findColumn(headers, [
      'Actual received quantity',
      'Received Quantity',
      'Quantity'
    ]);

    // 🆕 FIX: Find BOTH "Cuft" and "Total Cuft" columns
    const cuftCol = findColumn(headers, [
      'Cuft',
      'CUFT',
      'Cubic Feet'
    ]);

    const totalCuftCol = findColumn(headers, [
      'Total Cuft',
      'Total CUFT',
      'TotalCuft',
      'Total Cubic Feet'
    ]);

    console.log(`🔍 Searching for Cuft columns in Placement sheet...`);
    if (cuftCol !== -1) {
      console.log(`   Found cuft column at index ${cuftCol}: "${headers[cuftCol]}"`);
    }
    if (totalCuftCol !== -1) {
      console.log(`   Found cuft column at index ${totalCuftCol}: "${headers[totalCuftCol]}"`);
    }

    // Determine which column to prioritize
    const hasTotalCuftColumn = totalCuftCol !== -1;
    const hasCuftColumn = cuftCol !== -1;

    console.log(`📦 Placement sheet columns:`);
    console.log(`   "Total Cuft" column: ${hasTotalCuftColumn ? `YES ✓ (${headers[totalCuftCol]})` : 'NO'}`);
    console.log(`   "Cuft" column: ${hasCuftColumn ? `YES (${headers[cuftCol]})` : 'NO'}`);

    // 🆕 Diagnostic: Show first row to understand data
    if (data.length > 0) {
      const firstRow = data[0];
      console.log(`🔍 First row diagnostic:`);
      if (hasTotalCuftColumn) {
        console.log(`   Total Cuft: ${firstRow[headers[totalCuftCol]]}`);
      }
      if (hasCuftColumn) {
        console.log(`   Cuft: ${firstRow[headers[cuftCol]]}`);
      }
      if (receivedQtyCol !== -1) {
        console.log(`   Actual received quantity: ${firstRow[headers[receivedQtyCol]]}`);
      }
    }

    const placementFeeCol = findColumn(headers, [
      'Total FBA inbound placement service fee charge',
      'Placement Fee',
      'Total fee',
      'Fee per unit'
    ]);

    const transactionDateCol = findColumn(headers, [
      'Transaction date',
      'Date',
      'Created Date'
    ]);

    // Build storage lookup for fallback
    const storageLookup = {};
    storageSheet.forEach(item => {
      const fnsku = item.fnsku;
      if (fnsku) {
        storageLookup[fnsku] = item;
      }
    });

    // Parse rows with intelligent Cuft handling
    const parsedRows = data.map(row => {
      const fbaShipmentID = fbaIdCol !== -1 ? row[headers[fbaIdCol]] : null;
      const fnsku = fnskuCol !== -1 ? row[headers[fnskuCol]] : null;
      const asin = asinCol !== -1 ? row[headers[asinCol]] : null;
      const receivedQty = receivedQtyCol !== -1 ? parseFloat(row[headers[receivedQtyCol]]) || 0 : 0;

      // 🆕 FIX: Smart Cuft calculation with correct priority
      let cuft = 0;
      let cuftSource = 'none';

      // ✅ Priority 1: Use "Total Cuft" column directly (if it exists)
      // This is the CORRECT value - it's already the line total
      if (hasTotalCuftColumn) {
        const totalCuftVal = row[headers[totalCuftCol]];
        if (totalCuftVal !== undefined && totalCuftVal !== null && totalCuftVal !== '') {
          cuft = parseFloat(totalCuftVal) || 0;
          if (cuft > 0) {
            cuftSource = 'placement_total_cuft';
          }
        }
      }

      // ✅ Priority 2: Calculate from "Cuft" (per-unit) × Quantity
      if (cuft === 0 && hasCuftColumn && receivedQty > 0) {
        const perUnitCuft = parseFloat(row[headers[cuftCol]]) || 0;
        if (perUnitCuft > 0) {
          cuft = perUnitCuft * receivedQty;
          cuftSource = 'placement_cuft_times_qty';
        }
      }

      // Priority 3: Calculate from Storage (LAST RESORT)
      if (cuft === 0 && fnsku && receivedQty > 0) {
        const storageInfo = storageLookup[fnsku];
        if (storageInfo && storageInfo.itemVolume > 0) {
          cuft = storageInfo.itemVolume * receivedQty;
          cuftSource = 'storage_fallback';
        }
      }

      const placementFee = placementFeeCol !== -1 ? parseFloat(row[headers[placementFeeCol]]) || 0 : 0;
      const transactionDate = transactionDateCol !== -1 ? row[headers[transactionDateCol]] : null;

      return {
        fbaShipmentID,
        fnsku,
        asin,
        receivedQty,
        cuft,
        cuftSource,
        placementFee,
        transactionDate
      };
    });

    // Log Cuft source distribution
    const cuftSourceCounts = {};
    parsedRows.forEach(row => {
      cuftSourceCounts[row.cuftSource] = (cuftSourceCounts[row.cuftSource] || 0) + 1;
    });

    console.log(`   Placement Cuft sources:`);
    Object.entries(cuftSourceCounts).forEach(([source, count]) => {
      console.log(`      ${source}: ${count} rows`);
    });

    return parsedRows;
  }

  /**
   * Parse Storage sheet
   */
  parseStorageSheet(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

    if (data.length === 0) {
      return [];
    }

    const headers = Object.keys(data[0]);

    const fnskuCol = findColumn(headers, ['fnsku', 'FNSKU']);
    const asinCol = findColumn(headers, ['asin', 'ASIN']);
    const productNameCol = findColumn(headers, ['product_name', 'Product Name']);
    const itemVolumeCol = findColumn(headers, ['item_volume', 'Item Volume']);
    const longestSideCol = findColumn(headers, ['longest_side', 'Longest Side']);
    const medianSideCol = findColumn(headers, ['median_side', 'Median Side']);
    const shortestSideCol = findColumn(headers, ['shortest_side', 'Shortest Side']);
    const weightCol = findColumn(headers, ['weight', 'Weight']);
    const sizeTierCol = findColumn(headers, ['product_size_tier', 'Size Tier']);
    const storageTypeCol = findColumn(headers, ['dangerous_goods_storage_type', 'Storage Type']);

    return data.map(row => {
      const fnsku = fnskuCol !== -1 ? row[headers[fnskuCol]] : null;
      const asin = asinCol !== -1 ? row[headers[asinCol]] : null;
      const productName = productNameCol !== -1 ? row[headers[productNameCol]] : null;

      let itemVolume = itemVolumeCol !== -1 ? parseFloat(row[headers[itemVolumeCol]]) || 0 : 0;

      // Calculate from dimensions if item_volume not available
      if (itemVolume === 0 && longestSideCol !== -1 && medianSideCol !== -1 && shortestSideCol !== -1) {
        const longest = parseFloat(row[headers[longestSideCol]]) || 0;
        const median = parseFloat(row[headers[medianSideCol]]) || 0;
        const shortest = parseFloat(row[headers[shortestSideCol]]) || 0;

        if (longest > 0 && median > 0 && shortest > 0) {
          const cubicInches = longest * median * shortest;
          itemVolume = cubicInches / 1728; // Convert to cubic feet
        }
      }

      const weight = weightCol !== -1 ? parseFloat(row[headers[weightCol]]) || 0 : 0;
      const sizeTier = sizeTierCol !== -1 ? row[headers[sizeTierCol]] : null;
      const storageType = storageTypeCol !== -1 ? row[headers[storageTypeCol]] : null;

      return {
        fnsku,
        asin,
        productName,
        itemVolume,
        weight,
        sizeTier,
        storageType
      };
    });
  }

  /**
   * Parse FBA Zoning sheet
   */
  parseFBAZoningSheet(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

    if (data.length === 0) {
      return [];
    }

    const headers = Object.keys(data[0]);

    const destinationCol = findColumn(headers, ['Destination', 'FC', 'Fulfillment Center']);
    const zoneCol = findColumn(headers, ['Zone', 'zone']);
    const stateCol = findColumn(headers, ['State', 'state']);
    const regionCol = findColumn(headers, ['Region', 'region']);

    return data.map(row => ({
      destination: destinationCol !== -1 ? row[headers[destinationCol]] : null,
      zone: zoneCol !== -1 ? row[headers[zoneCol]] : null,
      state: stateCol !== -1 ? row[headers[stateCol]] : null,
      region: regionCol !== -1 ? row[headers[regionCol]] : null
    }));
  }

  /**
   * Parse Hazmat sheet
   */
  parseHazmatSheet(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

    if (data.length === 0) {
      return [];
    }

    const headers = Object.keys(data[0]);

    const asinCol = findColumn(headers, ['ASIN', 'asin']);
    const hazmatCol = findColumn(headers, ['Hazmat', 'hazmat', 'Dangerous Goods']);
    const unNumberCol = findColumn(headers, ['UN Number', 'UN #']);
    const dgCodeCol = findColumn(headers, ['DG Code', 'Dangerous Goods Code']);
    const packingGroupCol = findColumn(headers, ['Packing Group', 'Pack Group']);

    return data.map(row => ({
      asin: asinCol !== -1 ? row[headers[asinCol]] : null,
      hazmat: hazmatCol !== -1 ? row[headers[hazmatCol]] : null,
      unNumber: unNumberCol !== -1 ? row[headers[unNumberCol]] : null,
      dgCode: dgCodeCol !== -1 ? row[headers[dgCodeCol]] : null,
      packingGroup: packingGroupCol !== -1 ? row[headers[packingGroupCol]] : null
    }));
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
   * ✅ PATCHED: Enrich data with calculations including Cuft from Placement
   * NOW WITH FBA ID NORMALIZATION AND DIAGNOSTICS
   */
  enrichDataWithCalculations(parsedData) {
    const { dataSheet, placementSheet, storageSheet, fbaZoningSheet, hazmatLookupMap } = parsedData;

    // Build Cuft aggregation from Placement by Shipment ID
    const placementCuftMap = {};
    const placementQtyMap = {};
    const placementFeesMap = {};
    const placementAsinMap = {};

    placementSheet.forEach(item => {
      // ✅ PATCHED: Normalize FBA ID before using as map key
      const shipmentID = this.normalizeFBAID(item.fbaShipmentID);
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

    // ✅ PATCHED: Add diagnostic logging
    console.log(`\n🔍 DIAGNOSTIC: Sample Placement IDs (first 10):`);
    Object.keys(placementCuftMap).slice(0, 10).forEach(id => {
      console.log(`   ${id}: ${placementCuftMap[id].toFixed(2)} cuft`);
    });

    // ✅ PATCHED: Build Transaction date lookup (latest date per shipment) for Check-In fallback
    const transactionDateMap = {};
    placementSheet.forEach(item => {
      // ✅ PATCHED: Normalize FBA ID
      const shipmentID = this.normalizeFBAID(item.fbaShipmentID);
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

    // ✅ PATCHED: Add validation before enrichment loop
    console.log(`\n🔍 Validating FBA ID matches between Data and Placement sheets...`);
    let matchCount = 0;
    let mismatchCount = 0;
    const sampleSize = Math.min(10, dataSheet.length);

    dataSheet.slice(0, sampleSize).forEach(shipment => {
      const normalizedID = this.normalizeFBAID(shipment.fbaShipmentID);
      const hasCuft = placementCuftMap[normalizedID] > 0;

      if (hasCuft) {
        matchCount++;
        console.log(`   ✅ ${shipment.fbaShipmentID} → ${placementCuftMap[normalizedID].toFixed(2)} cuft`);
      } else {
        mismatchCount++;
        console.log(`   ❌ ${shipment.fbaShipmentID} → NO MATCH (cuft = 0)`);
      }
    });

    console.log(`   Sample results: ${matchCount}/${sampleSize} matched, ${mismatchCount}/${sampleSize} missing`);

    // Calculate total match rate
    const totalMatches = dataSheet.filter(s => {
      const normalizedID = this.normalizeFBAID(s.fbaShipmentID);
      return placementCuftMap[normalizedID] > 0;
    }).length;

    const matchRate = ((totalMatches / dataSheet.length) * 100).toFixed(1);
    console.log(`   Overall match rate: ${totalMatches}/${dataSheet.length} (${matchRate}%)\n`);

    if (totalMatches === 0) {
      console.error(`\n❌ CRITICAL: Zero FBA ID matches between Data and Placement sheets!`);
      console.error(`   This will cause all shipments to have zero Cuft.`);
      console.error(`   Please verify that:`);
      console.error(`   1. Placement sheet contains data for these shipments`);
      console.error(`   2. FBA Shipment ID column names match between sheets`);
      console.error(`   3. The date range filter hasn't excluded all Placement data\n`);
    }

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
        // ✅ PATCHED: Normalize before lookup
        const normalizedID = this.normalizeFBAID(shipment.fbaShipmentID);
        const placementCuft = placementCuftMap[normalizedID] || 0;

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

      // ✅ PATCHED: Handle placement fees with normalization
      const normalizedID = this.normalizeFBAID(shipment.fbaShipmentID);
      const placementFeesFromSheet = placementFeesMap[normalizedID];
      const actualPlacementFees = placementFeesFromSheet !== undefined && placementFeesFromSheet > 0
        ? placementFeesFromSheet
        : shipment.placementFees;

      // ✅ PATCHED: Check-In date with Transaction date fallback and normalization
      let actualCheckedInDate = shipment.checkedInDate;
      let checkedInSource = 'data_sheet';

      // If Check-In is missing or "-", use Transaction date from Placement as fallback
      if (!actualCheckedInDate || actualCheckedInDate === '-') {
        const txDate = transactionDateMap[normalizedID];
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

      // Hazmat detection - check if shipment contains any hazmat ASINs
      const asinSet = placementAsinMap[normalizedID] || new Set();
      const asins = Array.from(asinSet);

      let containsHazmat = false;
      const hazmatTypes = new Set();
      const hazmatDetails = [];

      asins.forEach(asin => {
        if (hazmatLookupMap && hazmatLookupMap[asin]) {
          const hazmatInfo = hazmatLookupMap[asin];
          if (hazmatInfo.isHazmat) {
            containsHazmat = true;
            if (hazmatInfo.hazmatType) {
              hazmatTypes.add(hazmatInfo.hazmatType);
            }
            hazmatDetails.push({
              asin,
              type: hazmatInfo.hazmatType,
              dgClass: hazmatInfo.dgClass,
              confidence: hazmatInfo.confidence
            });
          }
        }
      });

      return {
        ...shipment,
        cuft: roundedCuft,
        cuftSource,
        calculatedPallets: roundedPallets,
        placementFees: actualPlacementFees,
        checkedInDate: actualCheckedInDate,
        checkedInSource,
        transitDays,
        destinationState,
        destinationRegion,
        currentTotalCost,
        containsHazmat,
        hazmatTypes: Array.from(hazmatTypes),
        hazmatDetails,
        asins
      };
    });

    return enrichedShipments;
  }

  /**
   * Get state and region from ZIP code
   */
  getStateFromZip(zipCode, fbaZoningSheet) {
    if (!zipCode) {
      return { state: 'Unknown', region: 'Unknown' };
    }

    // Try FBA Zoning lookup first (if available)
    if (fbaZoningSheet && fbaZoningSheet.length > 0) {
      // Match by state from ZIP
      const stateInfo = zipToState(zipCode);
      if (stateInfo) {
        const stateCode = stateInfo.code;
        const zoning = fbaZoningSheet.find(z => z.state === stateCode);

        if (zoning) {
          return {
            state: stateCode,
            region: zoning.region || this.STATE_REGIONS[stateCode] || 'Unknown'
          };
        }

        // Fallback to STATE_REGIONS if not in FBA Zoning
        return {
          state: stateCode,
          region: this.STATE_REGIONS[stateCode] || 'Unknown'
        };
      }
    }

    // Fallback to zipToState utility
    const stateInfo = zipToState(zipCode);
    if (stateInfo) {
      return {
        state: stateInfo.code,
        region: this.STATE_REGIONS[stateInfo.code] || 'Unknown'
      };
    }

    return { state: 'Unknown', region: 'Unknown' };
  }

  /**
   * ✅ NEW: Generate summary statistics from parsed data
   * Required by SmashFoodsIntegration.analyzeSmashFoodsFile()
   *
   * @param {Object} parsedData - The complete parsed data object from parseFile()
   * @returns {Object} Summary statistics
   */
  getSummary(parsedData) {
    const shipments = parsedData?.dataSheet || parsedData;

    if (!shipments || shipments.length === 0) {
      return {
        totalShipments: 0,
        totalUnits: 0,
        totalPallets: 0,
        totalCuft: 0,
        totalWeight: 0,
        totalPlacementFees: 0,
        totalCarrierCost: 0,
        avgTransitDays: 0
      };
    }

    const summary = {
      totalShipments: shipments.length,
      totalUnits: shipments.reduce((sum, s) => sum + (s.units || 0), 0),
      totalPallets: shipments.reduce((sum, s) => sum + (s.calculatedPallets || 0), 0),
      totalCuft: shipments.reduce((sum, s) => sum + (s.cuft || 0), 0),
      totalWeight: shipments.reduce((sum, s) => sum + (s.weight || 0), 0),
      totalPlacementFees: shipments.reduce((sum, s) => sum + (s.placementFees || 0), 0),
      totalCarrierCost: shipments.reduce((sum, s) => sum + (s.carrierCost || 0), 0),
      avgTransitDays: 0
    };

    // Calculate average transit days (excluding zero values)
    const shipmentsWithTransit = shipments.filter(s => s.transitDays > 0);
    if (shipmentsWithTransit.length > 0) {
      summary.avgTransitDays = Math.round(
        shipmentsWithTransit.reduce((sum, s) => sum + s.transitDays, 0) / shipmentsWithTransit.length
      );
    }

    return summary;
  }
}

export default SmashFoodsParser;
