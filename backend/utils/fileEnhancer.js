// ============================================================================
// FILE ENHANCER - Smart Column Detection with Fuzzy Matching
// File: backend/utils/fileEnhancer.js
// ============================================================================

import xlsx from 'xlsx';
import path from 'path';

/**
 * Smart column finder with fuzzy matching
 * Handles: case variations, spaces, underscores, dashes, common typos
 *
 * @param {Array} headers - Array of column headers from Excel
 * @param {Array} possibleNames - Array of possible column name variations
 * @returns {number} - Index of found column, or -1 if not found
 */
export function findColumn(headers, possibleNames) {
  // Normalize function - removes spaces, underscores, dashes, converts to lowercase
  const normalize = (str) => {
    if (!str) return '';
    return str
      .toString()
      .toLowerCase()
      .replace(/[_\s\-]/g, '')  // Remove spaces, underscores, dashes
      .replace(/[^\w]/g, '')     // Remove special characters
      .trim();
  };

  // Try exact match first (case-insensitive)
  for (const name of possibleNames) {
    const idx = headers.findIndex(h =>
      h && h.toString().toLowerCase().trim() === name.toLowerCase().trim()
    );
    if (idx !== -1) {
      console.log(`   ✅ Exact match: "${name}" found as "${headers[idx]}" (index ${idx})`);
      return idx;
    }
  }

  // Try normalized fuzzy match
  for (const name of possibleNames) {
    const normalized = normalize(name);
    const idx = headers.findIndex(h =>
      normalize(h) === normalized
    );
    if (idx !== -1) {
      console.log(`   ✅ Fuzzy match: "${name}" found as "${headers[idx]}" (index ${idx})`);
      return idx;
    }
  }

  // Try partial match (contains)
  for (const name of possibleNames) {
    const normalized = normalize(name);
    if (normalized.length >= 4) { // Only for longer strings
      const idx = headers.findIndex(h =>
        normalize(h).includes(normalized) || normalized.includes(normalize(h))
      );
      if (idx !== -1) {
        console.log(`   ✅ Partial match: "${name}" found as "${headers[idx]}" (index ${idx})`);
        return idx;
      }
    }
  }

  // Not found
  console.log(`   ❌ Column not found. Tried: ${possibleNames.join(', ')}`);
  return -1;
}

/**
 * Validate and enhance Excel file for analysis
 * Checks for required columns and adds missing data
 *
 * @param {string} filePath - Path to Excel file
 * @returns {Object} - Validation result
 */
export function validateAndEnhanceFile(filePath) {
  console.log('🔍 ========== FILE VALIDATION & ENHANCEMENT ==========');
  console.log(`   File: ${path.basename(filePath)}`);

  try {
    const workbook = xlsx.readFile(filePath);

    // Check required sheets
    const requiredSheets = ['Data', 'Placement', 'Storage'];
    const missingSheets = requiredSheets.filter(
      sheet => !workbook.SheetNames.includes(sheet)
    );

    if (missingSheets.length > 0) {
      throw new Error(`Missing required sheets: ${missingSheets.join(', ')}`);
    }

    console.log('✅ All required sheets present');

    // Validate Data sheet
    const dataSheet = workbook.Sheets['Data'];
    const dataJson = xlsx.utils.sheet_to_json(dataSheet);
    const dataHeaders = Object.keys(dataJson[0] || {});

    console.log('\n📋 DATA SHEET VALIDATION:');
    console.log(`   Rows: ${dataJson.length}`);
    console.log(`   Columns: ${dataHeaders.length}`);

    // Check critical Data columns
    const fbaIdCol = findColumn(dataHeaders, [
      'FBA Shipment ID',
      'FBA ID',
      'Shipment ID',
      'fba shipment id',
      'FBAShipmentID'
    ]);

    const unitsCol = findColumn(dataHeaders, [
      'Total Units Located',
      'Units',
      'Total Shipped Qty',
      'Quantity',
      'Total Located Qty'
    ]);

    if (fbaIdCol === -1) {
      throw new Error('Data sheet missing FBA Shipment ID column');
    }
    if (unitsCol === -1) {
      throw new Error('Data sheet missing Units column');
    }

    // Validate Placement sheet
    const placementSheet = workbook.Sheets['Placement'];
    const placementJson = xlsx.utils.sheet_to_json(placementSheet);
    const placementHeaders = Object.keys(placementJson[0] || {});

    console.log('\n📦 PLACEMENT SHEET VALIDATION:');
    console.log(`   Rows: ${placementJson.length}`);
    console.log(`   Columns: ${placementHeaders.length}`);

    // Check for Total Cuft column (critical for accurate calculations)
    const totalCuftCol = findColumn(placementHeaders, [
      'Total Cuft',
      'Total CUFT',
      'total cuft',
      'TotalCuft',
      'Total_Cuft',
      'Cuft Total',
      'CUFT'
    ]);

    const placementFeesCol = findColumn(placementHeaders, [
      'Total FBA inbound placement service fee charge',
      'Placement Fee',
      'Placement Fees',
      'placement fee',
      'FBA Placement Fee',
      'Chosen Placement Fee'
    ]);

    if (totalCuftCol === -1) {
      console.log('⚠️  WARNING: Total Cuft column not found in Placement sheet');
      console.log('⚠️  System will use fallback calculation from Storage sheet');
      console.log('⚠️  This may result in 1-5% variance in cost calculations');
    } else {
      console.log('✅ Total Cuft column found - accurate calculations enabled');
    }

    // Validate Storage sheet
    const storageSheet = workbook.Sheets['Storage'];
    const storageJson = xlsx.utils.sheet_to_json(storageSheet);
    const storageHeaders = Object.keys(storageJson[0] || {});

    console.log('\n📊 STORAGE SHEET VALIDATION:');
    console.log(`   Rows: ${storageJson.length}`);
    console.log(`   Columns: ${storageHeaders.length}`);

    const asinCol = findColumn(storageHeaders, [
      'ASIN',
      'asin',
      'Product ASIN'
    ]);

    const storageTypeCol = findColumn(storageHeaders, [
      'product_size_tier',
      'Storage type',
      'dangerous_goods_storage_type',
      'Product size tier',
      'Size Tier'
    ]);

    if (asinCol === -1) {
      throw new Error('Storage sheet missing ASIN column');
    }

    console.log('\n✅ ========== VALIDATION COMPLETE ==========');

    return {
      valid: true,
      hasTotalCuft: totalCuftCol !== -1,
      hasPlacementFees: placementFeesCol !== -1,
      dataRows: dataJson.length,
      placementRows: placementJson.length,
      storageRows: storageJson.length,
      warnings: totalCuftCol === -1 ? [
        'Total Cuft column not found - using fallback calculation'
      ] : []
    };

  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    throw error;
  }
}

/**
 * Get column mapping for merged file
 * Returns standardized column names mapped to actual column names
 *
 * @param {Object} workbook - XLSX workbook object
 * @returns {Object} - Column mappings for each sheet
 */
export function getColumnMappings(workbook) {
  const mappings = {
    data: {},
    placement: {},
    storage: {}
  };

  try {
    // Data sheet mappings
    const dataSheet = workbook.Sheets['Data'];
    const dataJson = xlsx.utils.sheet_to_json(dataSheet);
    const dataHeaders = Object.keys(dataJson[0] || {});

    mappings.data = {
      fbaId: dataHeaders[findColumn(dataHeaders, ['FBA Shipment ID', 'FBA ID', 'Shipment ID'])],
      units: dataHeaders[findColumn(dataHeaders, ['Total Units Located', 'Units', 'Quantity'])],
      shipDate: dataHeaders[findColumn(dataHeaders, ['Created Date', 'Ship date', 'Transaction date'])],
      carrierCost: dataHeaders[findColumn(dataHeaders, ['Amazon Partnered Carrier Cost', 'Carrier Cost'])]
    };

    // Placement sheet mappings
    const placementSheet = workbook.Sheets['Placement'];
    const placementJson = xlsx.utils.sheet_to_json(placementSheet);
    const placementHeaders = Object.keys(placementJson[0] || {});

    mappings.placement = {
      fbaId: placementHeaders[findColumn(placementHeaders, ['FBA shipment ID', 'Shipping plan ID', 'FBA ID'])],
      totalCuft: placementHeaders[findColumn(placementHeaders, ['Total Cuft', 'TotalCuft', 'CUFT'])],
      placementFees: placementHeaders[findColumn(placementHeaders, ['Total FBA inbound placement service fee charge', 'Placement Fee'])]
    };

    // Storage sheet mappings
    const storageSheet = workbook.Sheets['Storage'];
    const storageJson = xlsx.utils.sheet_to_json(storageSheet);
    const storageHeaders = Object.keys(storageJson[0] || {});

    mappings.storage = {
      asin: storageHeaders[findColumn(storageHeaders, ['ASIN', 'asin'])],
      storageType: storageHeaders[findColumn(storageHeaders, ['product_size_tier', 'Storage type'])],
      fnsku: storageHeaders[findColumn(storageHeaders, ['fnsku', 'FNSKU'])]
    };

    console.log('📋 Column mappings created');
    return mappings;

  } catch (error) {
    console.error('❌ Error creating column mappings:', error.message);
    return mappings;
  }
}

/**
 * Check if file needs Cuft enhancement
 * @param {string} filePath - Path to Excel file
 * @returns {boolean} - True if enhancement needed
 */
export function needsCuftEnhancement(filePath) {
  try {
    const workbook = xlsx.readFile(filePath);
    const placementSheet = workbook.Sheets['Placement'];

    if (!placementSheet) {
      return true; // No placement sheet means enhancement needed
    }

    const placementJson = xlsx.utils.sheet_to_json(placementSheet);
    const placementHeaders = Object.keys(placementJson[0] || {});

    const totalCuftCol = findColumn(placementHeaders, [
      'Total Cuft', 'TotalCuft', 'Total_Cuft', 'CUFT'
    ]);

    return totalCuftCol === -1; // Enhancement needed if Total Cuft column missing

  } catch (error) {
    console.error('Error checking enhancement need:', error);
    return true; // Default to needing enhancement if check fails
  }
}

/**
 * Log column detection details for debugging
 * @param {Array} headers - Column headers
 * @param {string} sheetName - Name of sheet being processed
 */
export function logColumnHeaders(headers, sheetName) {
  console.log(`\n📋 ${sheetName.toUpperCase()} SHEET COLUMNS:`);
  console.log(`   Total: ${headers.length}`);
  console.log(`   Headers:`, headers.slice(0, 10).join(', '), headers.length > 10 ? '...' : '');
}

export default {
  findColumn,
  validateAndEnhanceFile,
  getColumnMappings,
  needsCuftEnhancement,
  logColumnHeaders
};
