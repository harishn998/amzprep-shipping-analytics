// ============================================================================
// AMAZON ENHANCEMENT LAYER - COMPLETE FIX
// File: backend/utils/amazonEnhancementLayer.js
//
// FIXES APPLIED:
// 1. 🆕 Use "Total Cuft" column from Placement (line total, not per-unit)
//    - Priority 1: Placement "Total Cuft" (pre-calculated line total)
//    - Priority 2: Placement "Cuft" × Qty (per-unit × quantity)
//    - Priority 3: Storage item_volume × Qty (last resort fallback)
// 2. Improved dimension calculation from Storage (if needed)
// 3. Better handling of missing data
//
// This fixes: 7816 cuft → 6396 cuft, 117 pallets → 95 pallets
// ============================================================================

import xlsx from 'xlsx';
import path from 'path';

/**
 * AmazonEnhancementLayer - COMPLETE FIX VERSION
 */
class AmazonEnhancementLayer {

  constructor() {
    this.CUFT_PER_PALLET = 67;
  }

  /**
   * Main entry point - enhance file if needed
   */
  async enhanceIfNeeded(filePath) {
    console.log('🔍 Checking if file needs enhancement...');

    const workbook = xlsx.readFile(filePath);

    if (!workbook.Sheets['Data']) {
      console.log('❌ No Data sheet found - cannot enhance');
      return filePath;
    }

    const dataSheet = workbook.Sheets['Data'];
    const headers = this.getHeadersFromSheet(dataSheet);

    // Check which columns are missing
    const needsEnhancement = this.checkIfEnhancementNeeded(headers);

    if (!needsEnhancement.required) {
      console.log('✅ File already has required columns - no enhancement needed');
      return filePath;
    }

    console.log('🔧 Enhancement required:', needsEnhancement.missingColumns.join(', '));

    // Perform enhancement
    const enhancedFilePath = await this.enhanceFile(workbook, filePath, needsEnhancement);

    console.log('✅ Enhancement complete:', enhancedFilePath);
    return enhancedFilePath;
  }

  /**
   * Get headers from a sheet
   */
  getHeadersFromSheet(sheet) {
    const range = xlsx.utils.decode_range(sheet['!ref']);
    const headers = [];

    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = xlsx.utils.encode_cell({ r: range.s.r, c: col });
      const cell = sheet[cellAddress];
      if (cell && cell.v) {
        headers.push(cell.v);
      }
    }

    return headers;
  }

  /**
   * Check if enhancement is needed
   */
  checkIfEnhancementNeeded(headers) {
    const headersLower = headers.map(h => String(h).toLowerCase());

    const hasCuft = headersLower.includes('cuft');
    const hasPlacementFees = headersLower.includes('placement fees') ||
                             headersLower.includes('chosen placement fee');
    const hasTotalPalletQty = headersLower.includes('total pallet quantity') ||
                              headersLower.includes('total pallets');

    const missingColumns = [];
    if (!hasCuft) missingColumns.push('Cuft');
    if (!hasPlacementFees) missingColumns.push('Placement Fees');
    if (!hasTotalPalletQty) missingColumns.push('Total Pallet Quantity');

    return {
      required: missingColumns.length > 0,
      missingColumns,
      hasCuft,
      hasPlacementFees,
      hasTotalPalletQty
    };
  }

  /**
   * Enhance the file with missing columns
   */
  async enhanceFile(workbook, originalFilePath, needsEnhancement) {
    console.log('📊 Starting file enhancement...');

    const dataRows = xlsx.utils.sheet_to_json(workbook.Sheets['Data']);
    const storageRows = workbook.Sheets['Storage']
      ? xlsx.utils.sheet_to_json(workbook.Sheets['Storage'])
      : [];
    const placementRows = workbook.Sheets['Placement']
      ? xlsx.utils.sheet_to_json(workbook.Sheets['Placement'])
      : [];

    console.log(`📋 Data rows: ${dataRows.length}`);
    console.log(`📦 Storage rows: ${storageRows.length}`);
    console.log(`💰 Placement rows: ${placementRows.length}`);

    // Build lookups
    const storageLookup = this.buildStorageLookup(storageRows);
    const placementByShipmentID = this.buildPlacementLookup(placementRows);

    // 🆕 FIX: Build Cuft lookup - check for existing column first
    const cuftByShipmentID = this.buildCuftLookupFromPlacement(placementRows, storageLookup);

    console.log(`🔍 Storage lookup map: ${Object.keys(storageLookup).length} unique FNSKUs`);
    console.log(`🔍 Placement lookup map: ${Object.keys(placementByShipmentID).length} unique shipment IDs`);
    console.log(`🔍 Cuft lookup map: ${Object.keys(cuftByShipmentID).length} unique shipment IDs with Cuft`);

    // Enhance each data row
    const enhancedData = dataRows.map((row, index) => {
      const enhanced = { ...row };
      const shipmentID = row['FBA Shipment ID'];

      if (needsEnhancement.missingColumns.includes('Cuft')) {
        enhanced['Cuft'] = cuftByShipmentID[shipmentID] || 0;
      }

      if (needsEnhancement.missingColumns.includes('Placement Fees')) {
        enhanced['Placement Fees'] = placementByShipmentID[shipmentID]?.totalFee || 0;
      }

      if (needsEnhancement.missingColumns.includes('Total Pallet Quantity')) {
        const cuft = enhanced['Cuft'] || 0;
        enhanced['Total Pallet Quantity'] = cuft / this.CUFT_PER_PALLET;
      }

      if (index < 3) {
        console.log(`Row ${index + 1} enhanced:`, {
          shipmentID: row['FBA Shipment ID'],
          cuft: enhanced['Cuft'],
          placementFees: enhanced['Placement Fees'],
          pallets: enhanced['Total Pallet Quantity']
        });
      }

      return enhanced;
    });

    // Calculate totals for logging
    const totalCuft = enhancedData.reduce((sum, row) => sum + (row['Cuft'] || 0), 0);
    const totalPlacementFees = enhancedData.reduce((sum, row) => sum + (row['Placement Fees'] || 0), 0);
    const totalPallets = enhancedData.reduce((sum, row) => sum + (row['Total Pallet Quantity'] || 0), 0);
    const shipmentsWithCuft = enhancedData.filter(row => (row['Cuft'] || 0) > 0).length;

    console.log('📊 Enhancement Summary:');
    console.log(`   Total Cuft: ${totalCuft.toFixed(2)}`);
    console.log(`   Total Placement Fees: $${totalPlacementFees.toFixed(2)}`);
    console.log(`   Total Pallets: ${totalPallets.toFixed(2)}`);
    console.log(`   Shipments with Cuft > 0: ${shipmentsWithCuft}`);

    // Write enhanced file
    workbook.Sheets['Data'] = xlsx.utils.json_to_sheet(enhancedData);

    const enhancedFilePath = originalFilePath.replace('.xlsx', '_enhanced.xlsx');
    xlsx.writeFile(workbook, enhancedFilePath);

    console.log('💾 Enhanced file saved:', enhancedFilePath);

    return enhancedFilePath;
  }

  /**
   * Build Storage lookup by FNSKU
   */
  buildStorageLookup(storageRows) {
    const lookup = {};

    storageRows.forEach(row => {
      const fnsku = row['fnsku'] || row['FNSKU'];
      if (!fnsku) return;

      let itemVolume = 0;

      // Try to get item_volume directly
      if (row['item_volume']) {
        itemVolume = parseFloat(row['item_volume']) || 0;
      }

      // 🆕 FIX: Calculate from dimensions if item_volume not available
      if (itemVolume === 0 && row['longest_side'] && row['median_side'] && row['shortest_side']) {
        const longest = parseFloat(row['longest_side']) || 0;
        const median = parseFloat(row['median_side']) || 0;
        const shortest = parseFloat(row['shortest_side']) || 0;

        if (longest > 0 && median > 0 && shortest > 0) {
          const cubicInches = longest * median * shortest;
          itemVolume = cubicInches / 1728; // Convert to cubic feet
        }
      }

      lookup[fnsku] = {
        fnsku,
        itemVolume,
        weight: parseFloat(row['weight']) || 0,
        productName: row['product_name'] || '',
        hazmat: row['Hazmat'] || row['hazmat'] || row['dangerous_goods_storage_type'] || null
      };
    });

    return lookup;
  }

  /**
   * 🆕 FIX: Build Cuft lookup from Placement - use "Total Cuft" column (line total)
   *
   * CRITICAL: The Placement sheet has TWO Cuft columns:
   *   - "Cuft" = Per-unit cubic feet (e.g., 0.0404)
   *   - "Total Cuft" = Line total (Cuft × Qty, e.g., 3.232)
   *
   * Manual analysis uses SUMIF on "Total Cuft" column, so we must use that!
   */
  buildCuftLookupFromPlacement(placementRows, storageLookup) {
    const cuftByShipment = {};

    // Check available Cuft columns
    const headers = Object.keys(placementRows[0] || {});
    const hasTotalCuftColumn = headers.some(h => h.toLowerCase() === 'total cuft');
    const hasCuftColumn = headers.some(h => h.toLowerCase() === 'cuft');

    console.log(`📦 Placement sheet columns:`);
    console.log(`   "Total Cuft" column: ${hasTotalCuftColumn ? 'YES ✓' : 'NO'}`);
    console.log(`   "Cuft" column: ${hasCuftColumn ? 'YES' : 'NO'}`);

    let cuftFromTotalColumn = 0;
    let cuftFromPerUnit = 0;
    let cuftFromStorage = 0;

    placementRows.forEach(row => {
      const shipmentID = row['FBA shipment ID'] || row['FBA Shipment ID'];
      if (!shipmentID) return;

      let lineCuft = 0;
      const quantity = parseFloat(row['Actual received quantity']) || 0;

      // 🆕 Priority 1: Use "Total Cuft" column directly (pre-calculated line total)
      if (hasTotalCuftColumn) {
        const totalCuftVal = row['Total Cuft'];
        if (totalCuftVal !== undefined && totalCuftVal !== null && totalCuftVal !== '') {
          lineCuft = parseFloat(totalCuftVal) || 0;
          if (lineCuft > 0) {
            cuftFromTotalColumn++;
          }
        }
      }

      // 🆕 Priority 2: Calculate from "Cuft" (per-unit) × Quantity
      if (lineCuft === 0 && hasCuftColumn && quantity > 0) {
        const perUnitCuft = parseFloat(row['Cuft']) || 0;
        if (perUnitCuft > 0) {
          lineCuft = perUnitCuft * quantity;
          cuftFromPerUnit++;
        }
      }

      // Priority 3: Calculate from Storage (LAST RESORT)
      if (lineCuft === 0 && quantity > 0) {
        const fnsku = row['FNSKU'];
        if (fnsku) {
          const storageInfo = storageLookup[fnsku];
          if (storageInfo && storageInfo.itemVolume > 0) {
            lineCuft = storageInfo.itemVolume * quantity;
            cuftFromStorage++;
          }
        }
      }

      // Aggregate by shipment ID
      if (lineCuft > 0) {
        if (!cuftByShipment[shipmentID]) {
          cuftByShipment[shipmentID] = 0;
        }
        cuftByShipment[shipmentID] += lineCuft;
      }
    });

    console.log(`   Cuft from "Total Cuft" column: ${cuftFromTotalColumn} rows`);
    console.log(`   Cuft from "Cuft" × Qty: ${cuftFromPerUnit} rows`);
    console.log(`   Cuft from Storage (fallback): ${cuftFromStorage} rows`);
    console.log(`   Shipments with Cuft: ${Object.keys(cuftByShipment).length}`);

    return cuftByShipment;
  }

  /**
   * Build Placement lookup for fees
   */
  buildPlacementLookup(placementRows) {
    const lookup = {};

    placementRows.forEach(row => {
      const shipmentID = row['FBA shipment ID'] || row['FBA Shipment ID'];
      if (!shipmentID) return;

      let fee = 0;

      // Try various fee column names
      if (row['Total fee']) {
        fee = parseFloat(row['Total fee']) || 0;
      } else if (row['Fee per unit']) {
        const feePerUnit = parseFloat(row['Fee per unit']) || 0;
        const quantity = parseFloat(row['Actual received quantity']) || 1;
        fee = feePerUnit * quantity;
      } else if (row['FBA inbound placement service fee rate (per unit)']) {
        const feePerUnit = parseFloat(row['FBA inbound placement service fee rate (per unit)']) || 0;
        const quantity = parseFloat(row['Actual received quantity']) || 1;
        fee = feePerUnit * quantity;
      } else if (row['Total FBA inbound placement service fee charge']) {
        fee = parseFloat(row['Total FBA inbound placement service fee charge']) || 0;
      }

      if (!lookup[shipmentID]) {
        lookup[shipmentID] = {
          totalFee: 0,
          itemCount: 0
        };
      }

      lookup[shipmentID].totalFee += fee;
      lookup[shipmentID].itemCount += 1;
    });

    return lookup;
  }
}

export default AmazonEnhancementLayer;
