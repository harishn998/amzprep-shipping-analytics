// ============================================================================
// IMPROVED UNIFIED FORMAT DETECTOR WITH BETTER DEBUGGING
// File: backend/utils/formatDetector.js
// ============================================================================

/**
 * Detect file format based on column headers
 */
export function detectFileFormat(firstRow) {
  if (!firstRow || typeof firstRow !== 'object' || Object.keys(firstRow).length === 0) {
    return {
      format: 'unknown',
      confidence: 0,
      indicators: [],
      description: 'Empty or invalid data'
    };
  }

  // Get all headers
  const originalHeaders = Object.keys(firstRow);
  const headers = originalHeaders.map(h => h.toLowerCase());

  // Debug: Show first 15 headers
  console.log('🔍 Detecting format from headers:', headers.slice(0, 15).join(', '));

  // Debug: Show total column count
  console.log(`📊 Total columns: ${headers.length}`);

  // ============================================================================
  // PRIORITY 1: SMASH FOODS FORMAT
  // ============================================================================

  const hasPlacementFees = headers.includes('placement fees');
  const hasCuft = headers.includes('cuft');
  const hasTotalPalletQuantity = headers.includes('total pallet quantity');
  const hasShipmentName = headers.includes('shipment name');
  const hasFBAShipmentID = headers.includes('fba shipment id');

  // Debug logging for Smash Foods detection
  console.log('🔍 Smash Foods check:', {
    hasPlacementFees,
    hasCuft,
    hasTotalPalletQuantity,
    hasShipmentName,
    hasFBAShipmentID
  });

  // PRIMARY CHECK: All 3 unique columns present
  if (hasPlacementFees && hasCuft && hasTotalPalletQuantity) {
    console.log('✅ SMASH FOODS detected (primary check)');
    return {
      format: 'smash_foods',
      confidence: 100,
      indicators: ['Placement Fees', 'Cuft', 'Total Pallet Quantity'],
      description: 'Smash Foods Amazon FBA Analysis Format'
    };
  }

  // SECONDARY CHECK: 2 out of 3 unique columns + base FBA columns
  const uniqueColumnCount = [hasPlacementFees, hasCuft, hasTotalPalletQuantity].filter(Boolean).length;
  if (uniqueColumnCount >= 2 && hasShipmentName && hasFBAShipmentID) {
    console.log('✅ SMASH FOODS detected (secondary check - 2/3 unique columns)');
    return {
      format: 'smash_foods',
      confidence: 95,
      indicators: [
        hasPlacementFees ? 'Placement Fees' : null,
        hasCuft ? 'Cuft' : null,
        hasTotalPalletQuantity ? 'Total Pallet Quantity' : null
      ].filter(Boolean),
      description: 'Smash Foods Amazon FBA Analysis Format (variant)'
    };
  }

  // ============================================================================
  // PRIORITY 2: MUSCLE MAC FORMAT
  // ============================================================================

  const hasDaysSinceCreated = headers.includes('days since created');
  const hasTotalPallets = headers.includes('total pallets');
  const hasChosenPlacementFee = headers.includes('chosen placement fee');
  const hasTotalWeightLbs = headers.includes('total weight (lbs)');

  console.log('🔍 Muscle Mac check:', {
    hasDaysSinceCreated,
    hasTotalPallets,
    hasChosenPlacementFee
  });

  // PRIMARY CHECK: Unique "Days Since Created" column
  if (hasDaysSinceCreated) {
    console.log('✅ MUSCLE MAC detected (has Days Since Created)');
    return {
      format: 'muscle_mac',
      confidence: 100,
      indicators: ['Days Since Created'],
      description: 'Muscle Mac Amazon FBA Format'
    };
  }

  // SECONDARY CHECK: Has Muscle Mac specific columns
  if (hasTotalPallets && hasChosenPlacementFee && hasShipmentName) {
    console.log('✅ MUSCLE MAC detected (has specific columns)');
    return {
      format: 'muscle_mac',
      confidence: 95,
      indicators: ['Total Pallets', 'Chosen Placement Fee'],
      description: 'Muscle Mac Amazon FBA Format (variant)'
    };
  }

  // ============================================================================
  // PRIORITY 3: SHOPIFY FORMAT
  // ============================================================================

  const hasShippingZip = headers.includes('shipping zip');
  const hasLineitemWeight = headers.includes('lineitem weight');
  const hasName = headers.includes('name');
  const hasShippingMethod = headers.includes('shipping method');
  const hasLineitemName = headers.includes('lineitem name');

  if (hasShippingZip || hasLineitemWeight) {
    console.log('✅ SHOPIFY detected');
    return {
      format: 'shopify',
      confidence: 100,
      indicators: hasShippingZip ? ['Shipping Zip'] : ['Lineitem weight'],
      description: 'Shopify E-commerce Orders Format'
    };
  }

  if (hasName && hasShippingMethod && hasLineitemName) {
    console.log('✅ SHOPIFY detected (combination)');
    return {
      format: 'shopify',
      confidence: 90,
      indicators: ['Name', 'Shipping Method', 'Lineitem name'],
      description: 'Shopify E-commerce Orders Format (variant)'
    };
  }

  // ============================================================================
  // PRIORITY 4: GENERIC AMAZON FBA (Fallback for FBA data)
  // ============================================================================

  // If it has basic FBA structure but doesn't match specific formats
  const hasAmazonPartnerCost = headers.includes('amazon partnered carrier cost');
  const hasShipToPostalCode = headers.includes('ship to postal code');

  if (hasShipmentName && hasFBAShipmentID && (hasAmazonPartnerCost || hasShipToPostalCode)) {
    console.log('⚠️  GENERIC AMAZON FBA detected (fallback)');
    return {
      format: 'generic_amazon_fba',
      confidence: 60,
      indicators: ['Shipment Name', 'FBA Shipment ID'],
      description: 'Generic Amazon FBA Format (use with caution)'
    };
  }

  // ============================================================================
  // PRIORITY 5: SIMPLE FORMAT
  // ============================================================================

  const hasState = headers.includes('state');
  const hasWeight = headers.includes('weight');
  const hasCost = headers.includes('cost') ||
                  headers.includes('shipping_cost') ||
                  headers.includes('shipping cost');

  if ((hasState || hasWeight) && hasCost) {
    console.log('✅ SIMPLE format detected');
    return {
      format: 'simple',
      confidence: 70,
      indicators: ['State', 'Weight', 'Cost'].filter(col =>
        headers.includes(col.toLowerCase())
      ),
      description: 'Simple Shipping Data Format'
    };
  }

  // ============================================================================
  // UNKNOWN FORMAT
  // ============================================================================

  console.warn('⚠️  Could not detect format!');
  console.warn('📋 All headers:', originalHeaders.join(', '));

  // Try to give helpful hints
  let hint = '';
  if (hasShipmentName && hasFBAShipmentID) {
    hint = ' (Looks like Amazon FBA data, but missing key columns for specific format detection)';
  }

  return {
    format: 'unknown',
    confidence: 0,
    indicators: [],
    description: `Unknown Format${hint}`,
    suggestedHeaders: originalHeaders.slice(0, 20),
    missingColumns: {
      forSmashFoods: [
        !hasPlacementFees ? 'Placement Fees' : null,
        !hasCuft ? 'Cuft' : null,
        !hasTotalPalletQuantity ? 'Total Pallet Quantity' : null
      ].filter(Boolean),
      forMuscleMac: [
        !hasDaysSinceCreated ? 'Days Since Created' : null,
        !hasTotalPallets ? 'Total Pallets' : null
      ].filter(Boolean)
    }
  };
}

/**
 * Get format-specific column mappings
 */
export function getColumnMapping(format) {
  const mappings = {
    smash_foods: {
      shipmentName: 'Shipment Name',
      fbaShipmentId: 'FBA Shipment ID',
      units: 'Total Shipped Qty',
      pallets: 'Total Pallet Quantity',
      weight: 'Total Weight',
      volume: 'Cuft',
      zipCode: 'Ship To Postal Code',
      destinationFC: 'Destination FC',
      carrier: 'Carrier',
      shippingMethod: 'Ship Method',
      placementFee: 'Placement Fees',
      freight: 'Amazon Partnered Carrier Cost',
      createdDate: 'Created Date',
      status: 'Status'
    },

    muscle_mac: {
      shipmentName: 'Shipment Name',
      fbaShipmentId: 'FBA Shipment ID',
      units: 'Total Shipped Qty',
      pallets: 'Total Pallets',
      weight: 'Total Weight (lbs)',
      volume: 'Cuft',
      zipCode: 'Ship To Postal Code',
      destinationFC: 'Destination FC',
      carrier: 'Carrier',
      shippingMethod: 'Ship Method',
      placementFee: 'Chosen Placement Fee',
      freight: 'Amazon Partnered Carrier Cost',
      createdDate: 'Created Date',
      status: 'Status',
      daysSinceCreated: 'Days Since Created'
    },

    shopify: {
      orderName: 'Name',
      shippingZip: 'Shipping Zip',
      shippingCost: 'Shipping',
      shippingMethod: 'Shipping Method',
      shippingCountry: 'Shipping Country',
      shippingState: 'Shipping Province',
      createdAt: 'Created at',
      lineitemWeight: 'Lineitem weight',
      lineitemGrams: 'Lineitem grams',
      lineitemWeightUnit: 'Lineitem weight unit',
      lineitemName: 'Lineitem name'
    },

    simple: {
      state: 'State',
      weight: 'Weight',
      cost: 'Cost',
      shippingMethod: 'Shipping_Method',
      zone: 'Zone',
      transitTime: 'Transit_Time',
      zipCode: 'Zip_Code',
      date: 'Date',
      country: 'Country'
    },

    generic_amazon_fba: {
      shipmentName: 'Shipment Name',
      fbaShipmentId: 'FBA Shipment ID',
      zipCode: 'Ship To Postal Code',
      freight: 'Amazon Partnered Carrier Cost'
    }
  };

  return mappings[format] || {};
}

/**
 * Get human-readable format name
 */
export function getFormatDisplayName(format) {
  const names = {
    smash_foods: 'Smash Foods (Amazon FBA Analysis)',
    muscle_mac: 'Muscle Mac (Amazon FBA)',
    shopify: 'Shopify (E-commerce Orders)',
    simple: 'Simple Shipping Data',
    generic_amazon_fba: 'Generic Amazon FBA',
    unknown: 'Unknown Format'
  };

  return names[format] || 'Unknown Format';
}

/**
 * Validate format
 */
export function validateFormat(firstRow, format) {
  const requiredColumns = {
    smash_foods: ['Shipment Name', 'Placement Fees', 'Cuft', 'Total Pallet Quantity'],
    muscle_mac: ['Shipment Name', 'FBA Shipment ID'],
    shopify: ['Name', 'Shipping Zip'],
    simple: ['State', 'Weight', 'Cost']
  };

  const required = requiredColumns[format] || [];
  const headers = Object.keys(firstRow);
  const missing = required.filter(col => !headers.includes(col));

  return {
    valid: missing.length === 0,
    missing,
    format,
    message: missing.length === 0
      ? `✅ Format validated: ${getFormatDisplayName(format)}`
      : `❌ Missing required columns: ${missing.join(', ')}`
  };
}

export default {
  detectFileFormat,
  getColumnMapping,
  getFormatDisplayName,
  validateFormat
};
