// ============================================================================
// TAB VALIDATOR - Validate uploaded tab formats (OPTIMIZED FOR YOUR FILES)
// File: backend/utils/tabValidator.js
//
// REPLACE your existing tabValidator.js with this file
// ============================================================================

import xlsx from 'xlsx';

/**
 * Column mapping - accepts multiple variations of column names
 * Maps standardized names to possible column names in uploaded files
 */
const COLUMN_MAPPINGS = {
  data: {
    'FBA ID': [
      'FBA ID',
      'FBA Shipment ID',
      'FBA shipment ID',
      'Shipment ID'
    ],
    'Ship date': [
      'Ship date',
      'Created Date',
      'Created date',
      'Shipment Date',
      'Transaction date'
    ],
    'Units': [
      'Units',
      'Total Units Located',
      'Total Shipped Qty',
      'Total Located Qty',
      'Units Located',
      'Quantity'
    ]
  },
  placement: {
    'FBA ID': [
      'FBA ID',
      'FBA shipment ID',
      'FBA Shipment ID',
      'Shipment ID',
      'Shipping plan ID'
    ],
    'Placement Fees': [
      'Placement Fees',
      'Total FBA inbound placement service fee charge',
      'Total charges',
      'Chosen Placement Fee',
      'Placement Fee',
      'FBA inbound placement service fee'
    ]
  },
  storage: {
    'ASIN': [
      'ASIN',
      'asin'
    ],
    'Storage type': [
      'Storage type',
      'dangerous_goods_storage_type',
      'product_size_tier',
      'Storage Type',
      'Product size tier'
    ]
  }
};

/**
 * Schema definitions for each tab type
 */
const TAB_SCHEMAS = {
  data: {
    requiredColumns: ['FBA ID', 'Ship date', 'Units'],
    optionalColumns: [
      'Created date',
      'Checked in date',
      'From ZIP',
      'Destination',
      'Carrier Cost',
      'Carrier',
      'State',
      'Destination FC'
    ]
  },
  placement: {
    requiredColumns: ['FBA ID', 'Placement Fees'],
    optionalColumns: [
      'Transaction date',
      'Country',
      'FNSKU',
      'ASIN'
    ]
  },
  storage: {
    requiredColumns: ['ASIN', 'Storage type'],
    optionalColumns: [
      'UN Number',
      'DG Code',
      'Packing Group',
      'fnsku',
      'product_name'
    ]
  }
};

/**
 * Find if a column exists in the file with any of its possible names
 */
function findColumn(columns, possibleNames) {
  for (const colName of columns) {
    const normalizedColName = colName.trim().toLowerCase();
    for (const possibleName of possibleNames) {
      if (normalizedColName === possibleName.toLowerCase()) {
        return colName; // Return actual column name from file
      }
    }
  }
  return null;
}

/**
 * Validate a tab file with flexible column matching
 */
export function validateTabFile(tabType, filePath) {
  console.log(`🔍 Validating ${tabType} tab...`);

  try {
    // Read Excel file
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      throw new Error(`${tabType} tab has no sheets`);
    }

    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

    if (data.length === 0) {
      throw new Error(`${tabType} tab is empty`);
    }

    // Get column names from first row
    const columns = Object.keys(data[0]);
    console.log(`   Total columns: ${columns.length}`);
    console.log(`   Sample columns: ${columns.slice(0, 5).join(', ')}...`);

    // Check required columns using flexible mapping
    const schema = TAB_SCHEMAS[tabType];
    const mappings = COLUMN_MAPPINGS[tabType];
    const missingColumns = [];
    const foundColumns = {};

    for (const requiredCol of schema.requiredColumns) {
      const possibleNames = mappings[requiredCol] || [requiredCol];
      const foundCol = findColumn(columns, possibleNames);

      if (foundCol) {
        foundColumns[requiredCol] = foundCol;
        console.log(`   ✓ Found "${requiredCol}" as "${foundCol}"`);
      } else {
        missingColumns.push(requiredCol);
        console.log(`   ✗ Missing "${requiredCol}" (tried: ${possibleNames.join(', ')})`);
      }
    }

    if (missingColumns.length > 0) {
      const helpText = missingColumns.map(col => {
        const possibles = mappings[col] || [col];
        return `"${col}" (accepts: ${possibles.join(' OR ')})`;
      }).join(', ');

      throw new Error(
        `${tabType} tab is missing required columns: ${missingColumns.join(', ')}. ` +
        `Please ensure your file contains: ${helpText}`
      );
    }

    console.log(`✅ ${tabType} tab validation passed`);
    console.log(`   Rows: ${data.length}`);

    return {
      valid: true,
      rowCount: data.length,
      columns,
      columnMappings: foundColumns // Return the actual column names found
    };

  } catch (error) {
    console.error(`❌ ${tabType} tab validation failed:`, error.message);
    throw new Error(`Invalid ${tabType} tab: ${error.message}`);
  }
}

/**
 * Validate Data tab specifically
 */
export function validateDataTab(filePath) {
  return validateTabFile('data', filePath);
}

/**
 * Validate Placement tab specifically
 */
export function validatePlacementTab(filePath) {
  return validateTabFile('placement', filePath);
}

/**
 * Validate Storage tab specifically
 */
export function validateStorageTab(filePath) {
  return validateTabFile('storage', filePath);
}

/**
 * Get tab schema (for documentation)
 */
export function getTabSchema(tabType) {
  return TAB_SCHEMAS[tabType] || null;
}

/**
 * Get column mappings (for documentation)
 */
export function getColumnMappings(tabType) {
  return COLUMN_MAPPINGS[tabType] || null;
}
