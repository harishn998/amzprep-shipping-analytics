// ============================================================================
// DATA SHEET ENHANCER - With Intelligent Cuft Type Detection
// File: backend/utils/dataSheetEnhancer.js
//
// Handles BOTH Placement and Data sheets with intelligent detection:
//
// PLACEMENT SHEET:
// - Detects if Cuft column contains item-level or shipment-level values
// - Item-level: Cuft × Qty = Total Cuft (e.g., 0.01 × 10 = 0.1)
// - Shipment-level: Cuft = Total Cuft (e.g., 2.7 stays 2.7)
// - Fixes #REF! errors intelligently
//
// DATA SHEET:
// - Weight: Calculate from Placement if has errors
// - Carrier Cost: 32 × Weight if has errors
// ============================================================================

import xlsx from 'xlsx';

class DataSheetEnhancer {

  constructor() {
    this.COST_PER_POUND = 32;
    this.ITEM_LEVEL_THRESHOLD = 0.5; // Cuft values > 0.5 are likely shipment totals
  }

  /**
   * Enhance both Placement and Data sheets
   */
  enhanceDataSheet(workbook) {
    console.log('📊 Enhancing Data sheet with calculated fields...');

    // Convert sheets to JSON
    const dataSheet = xlsx.utils.sheet_to_json(workbook.Sheets['Data']);
    const storageSheet = xlsx.utils.sheet_to_json(workbook.Sheets['Storage']);
    const placementSheet = xlsx.utils.sheet_to_json(workbook.Sheets['Placement']);

    // Build lookups
    const storageLookup = this.buildStorageLookup(storageSheet);
    const placementWeightLookup = this.buildPlacementWeightLookup(placementSheet);

    console.log(`   Storage items: ${Object.keys(storageLookup).length}`);
    console.log(`   Placement weights: ${Object.keys(placementWeightLookup).length}`);

    // Step 1: Detect Cuft type and fix Placement sheet
    const cuftType = this.detectCuftType(placementSheet);
    console.log(`   Cuft Type: ${cuftType}`);
    const fixedPlacement = this.fixPlacementSheet(placementSheet, storageLookup, cuftType);

    // Step 2: Fix Data sheet
    const fixedData = this.fixDataSheet(dataSheet, placementWeightLookup);

    // Update workbook
    workbook.Sheets['Placement'] = xlsx.utils.json_to_sheet(fixedPlacement);
    workbook.Sheets['Data'] = xlsx.utils.json_to_sheet(fixedData);

    return workbook;
  }

  /**
   * Detect if Cuft column contains item-level or shipment-level values
   */
  detectCuftType(placementSheet) {
    console.log('\n🔍 Detecting Cuft type...');

    // Sample first 50 rows to detect pattern
    const sampleSize = Math.min(50, placementSheet.length);
    let itemLevelCount = 0;
    let shipmentLevelCount = 0;

    // Method 1: Check if multiple rows with same FBA ID have different Cuft values
    const fbaGroups = {};

    for (let i = 0; i < sampleSize; i++) {
      const row = placementSheet[i];
      const fbaId = row['FBA shipment ID'] || row['FBA Shipment ID'];
      const cuft = parseFloat(row['Cuft']) || 0;

      if (fbaId && cuft > 0) {
        if (!fbaGroups[fbaId]) {
          fbaGroups[fbaId] = [];
        }
        fbaGroups[fbaId].push(cuft);
      }
    }

    // Check for variation within same FBA ID
    for (const fbaId in fbaGroups) {
      const cufts = fbaGroups[fbaId];
      if (cufts.length > 1) {
        // Multiple rows for same FBA ID - check if they vary
        const uniqueCufts = [...new Set(cufts)];
        if (uniqueCufts.length > 1) {
          // Different Cuft values for same shipment = Item-level
          itemLevelCount++;
        } else {
          // Same Cuft value repeated = Shipment-level
          shipmentLevelCount++;
        }
      }
    }

    // Method 2: Check magnitude of values (backup method)
    let smallValues = 0;  // < 0.5 = likely item-level
    let largeValues = 0;  // > 0.5 = likely shipment-level

    for (let i = 0; i < sampleSize; i++) {
      const cuft = parseFloat(placementSheet[i]['Cuft']) || 0;
      if (cuft > 0) {
        if (cuft < this.ITEM_LEVEL_THRESHOLD) {
          smallValues++;
        } else {
          largeValues++;
        }
      }
    }

    // Decision logic
    let detectedType;

    if (itemLevelCount > 0) {
      detectedType = 'ITEM_LEVEL';
    } else if (shipmentLevelCount > 0) {
      detectedType = 'SHIPMENT_LEVEL';
    } else if (smallValues > largeValues * 2) {
      // Mostly small values
      detectedType = 'ITEM_LEVEL';
    } else if (largeValues > smallValues * 2) {
      // Mostly large values
      detectedType = 'SHIPMENT_LEVEL';
    } else {
      // Default to item-level (more common)
      detectedType = 'ITEM_LEVEL';
    }

    console.log(`   FBA ID variations: ${itemLevelCount} item-level, ${shipmentLevelCount} shipment-level`);
    console.log(`   Value magnitudes: ${smallValues} small (<0.5), ${largeValues} large (>0.5)`);
    console.log(`   ✅ Detected: ${detectedType}`);

    return detectedType;
  }

  /**
   * Fix Placement sheet with intelligent Cuft type handling
   */
  fixPlacementSheet(placementSheet, storageLookup, cuftType) {
    console.log('\n📦 Fixing Placement sheet...');

    let cuftFixed = 0;
    let totalCuftFixed = 0;

    const fixed = placementSheet.map(row => {
      const fixedRow = { ...row };
      const fnsku = row['FNSKU'] || row['fnsku'];
      const qty = parseFloat(row['Actual received quantity']) || 0;

      // Fix Cuft if missing, error, or null
      if (this.needsCalculation(row['Cuft'])) {
        const storageItem = storageLookup[fnsku];
        if (storageItem && storageItem.itemVolume > 0) {
          fixedRow['Cuft'] = storageItem.itemVolume;
          cuftFixed++;
        } else {
          fixedRow['Cuft'] = 0;
        }
      }

      // Fix Total Cuft based on detected type
      const cuft = parseFloat(fixedRow['Cuft']) || 0;
      if (this.needsCalculation(row['Total Cuft'])) {
        if (cuft > 0 && qty > 0) {
          if (cuftType === 'SHIPMENT_LEVEL') {
            // Cuft is already a shipment total - don't multiply
            fixedRow['Total Cuft'] = cuft;
          } else {
            // Item-level: multiply by quantity
            fixedRow['Total Cuft'] = cuft * qty;
          }
          totalCuftFixed++;
        } else {
          fixedRow['Total Cuft'] = 0;
        }
      }

      return fixedRow;
    });

    console.log(`   ✅ Cuft fixed: ${cuftFixed} rows`);
    console.log(`   ✅ Total Cuft fixed: ${totalCuftFixed} rows (${cuftType} logic)`);

    return fixed;
  }

  /**
   * Fix Data sheet: Weight and Amazon Partnered Carrier Cost
   */
  fixDataSheet(dataSheet, placementWeightLookup) {
    console.log('\n📊 Fixing Data sheet...');

    let weightFixed = 0;
    let carrierCostFixed = 0;

    const fixed = dataSheet.map(row => {
      const fixedRow = { ...row };
      const fbaId = row['FBA Shipment ID'];

      // Fix Weight if it has errors or is missing
      if (this.needsCalculation(row['Weight'])) {
        const weight = placementWeightLookup[fbaId] || 0;
        fixedRow['Weight'] = weight;
        if (weight > 0) weightFixed++;
      }

      // Fix Amazon Partnered Carrier Cost if it has errors
      const weight = parseFloat(fixedRow['Weight']) || 0;
      if (this.needsCalculation(row['Amazon Partnered Carrier Cost'])) {
        if (weight > 0) {
          fixedRow['Amazon Partnered Carrier Cost'] = this.COST_PER_POUND * weight;
          carrierCostFixed++;
        } else {
          fixedRow['Amazon Partnered Carrier Cost'] = 0;
        }
      }

      return fixedRow;
    });

    console.log(`   ✅ Weight fixed: ${weightFixed} rows`);
    console.log(`   ✅ Carrier Cost fixed: ${carrierCostFixed} rows`);

    console.log('\n✅ Data sheet enhancement complete:');
    console.log(`   Cuft calculated: 0 rows (in Placement sheet)`);
    console.log(`   Total Cuft calculated: 0 rows (in Placement sheet)`);
    console.log(`   Weight calculated: ${weightFixed} rows`);
    console.log(`   Carrier Cost calculated: ${carrierCostFixed} rows`);

    return fixed;
  }

  /**
   * Build Storage lookup: FNSKU → item volume
   */
  buildStorageLookup(storageSheet) {
    const lookup = {};

    storageSheet.forEach(row => {
      const fnsku = row.fnsku || row.FNSKU;
      const itemVolume = parseFloat(row.item_volume || row['Item Volume']);

      if (fnsku && itemVolume > 0) {
        lookup[fnsku] = {
          itemVolume,
          asin: row.asin || row.ASIN
        };
      }
    });

    return lookup;
  }

  /**
   * Build Placement weight lookup: FBA ID → total weight
   */
  buildPlacementWeightLookup(placementSheet) {
    const lookup = {};

    placementSheet.forEach(row => {
      const fbaId = row['FBA shipment ID'] || row['FBA Shipment ID'];
      const weight = parseFloat(
        row['Shipping weight'] ||
        row['Weight'] ||
        row.weight ||
        0
      );

      if (fbaId && weight > 0) {
        lookup[fbaId] = (lookup[fbaId] || 0) + weight;
      }
    });

    return lookup;
  }

  /**
   * Check if a value needs calculation
   * Returns true for: null, undefined, empty string, #REF!, #VALUE!, #N/A, etc.
   */
  needsCalculation(value) {
    // Null, undefined, or empty
    if (value === null || value === undefined || value === '') return true;

    // Excel error values (#REF!, #VALUE!, #N/A, #DIV/0!, etc.)
    if (typeof value === 'string') {
      const errorPatterns = ['#REF!', '#VALUE!', '#N/A', '#DIV/0!', '#NUM!', '#NAME?', '#NULL!'];
      if (errorPatterns.some(pattern => value.includes(pattern))) return true;
    }

    // 0 is a valid value, don't recalculate
    if (typeof value === 'number' && value === 0) return false;

    // Has a valid value
    return false;
  }
}

export default DataSheetEnhancer;
