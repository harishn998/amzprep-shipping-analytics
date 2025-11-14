// ============================================================================
// AMAZON MULTI-SHEET ENHANCEMENT LAYER - FIXED V2
// File: backend/utils/amazonEnhancementLayer.js
//
// CRITICAL FIX: Calculate cuft from Placement sheet (FNSKU + quantity per item)
// instead of trying to guess from Data sheet
// ============================================================================

import xlsx from 'xlsx';
import path from 'path';

/**
 * AmazonEnhancementLayer - FIXED VERSION 2
 *
 * KEY FIX:
 * - Calculate cuft by joining Placement sheet (FNSKU + quantity) with Storage (item_volume)
 * - Aggregate cuft per shipment ID from Placement sheet
 * - This gives accurate per-shipment cuft values
 */
class AmazonEnhancementLayer {

  constructor() {
    this.CUFT_PER_PALLET = 67; // Standard pallet size
  }

  /**
   * Main entry point - enhance file if needed
   */
  async enhanceIfNeeded(filePath) {
    console.log('🔍 Checking if file needs enhancement...');

    const workbook = xlsx.readFile(filePath);

    // Check if Data sheet exists
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
    const hasPlacementFees = headersLower.includes('placement fees');
    const hasTotalPalletQty = headersLower.includes('total pallet quantity');

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
   * Enhance the file by adding missing columns
   * 🔧 FIXED: Use Placement sheet to calculate cuft
   */
  async enhanceFile(workbook, originalFilePath, needsEnhancement) {
    console.log('📊 Starting file enhancement...');

    // Load all sheets as JSON
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

    // Build lookup maps
    const storageLookup = this.buildStorageLookup(storageRows);
    const placementByShipmentID = this.buildPlacementLookup(placementRows);

    // 🆕 BUILD CUFT LOOKUP FROM PLACEMENT (this is the key fix!)
    const cuftByShipmentID = this.buildCuftLookupFromPlacement(placementRows, storageLookup);

    console.log(`🔍 Storage lookup map: ${Object.keys(storageLookup).length} unique FNSKUs`);
    console.log(`🔍 Placement lookup map: ${Object.keys(placementByShipmentID).length} unique shipment IDs`);
    console.log(`🔍 Cuft lookup map: ${Object.keys(cuftByShipmentID).length} unique shipment IDs`);

    // Enhance each data row
    const enhancedData = dataRows.map((row, index) => {
      const enhanced = { ...row };
      const shipmentID = row['FBA Shipment ID'];

      // Add Cuft if missing (from Placement-based calculation)
      if (needsEnhancement.missingColumns.includes('Cuft')) {
        enhanced['Cuft'] = cuftByShipmentID[shipmentID] || 0;
      }

      // Add Placement Fees if missing
      if (needsEnhancement.missingColumns.includes('Placement Fees')) {
        enhanced['Placement Fees'] = placementByShipmentID[shipmentID]?.totalFee || 0;
      }

      // Add Total Pallet Quantity if missing
      if (needsEnhancement.missingColumns.includes('Total Pallet Quantity')) {
        const cuft = enhanced['Cuft'] || 0;
        enhanced['Total Pallet Quantity'] = cuft / this.CUFT_PER_PALLET;
      }

      // Log first few rows for verification
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

    // Calculate totals for verification
    const totalCuft = enhancedData.reduce((sum, row) => sum + (row['Cuft'] || 0), 0);
    const totalPlacementFees = enhancedData.reduce((sum, row) => sum + (row['Placement Fees'] || 0), 0);
    const totalPallets = enhancedData.reduce((sum, row) => sum + (row['Total Pallet Quantity'] || 0), 0);

    console.log('📊 Enhancement Summary:');
    console.log(`   Total Cuft: ${totalCuft.toFixed(2)}`);
    console.log(`   Total Placement Fees: $${totalPlacementFees.toFixed(2)}`);
    console.log(`   Total Pallets: ${totalPallets.toFixed(2)}`);

    // Replace Data sheet with enhanced data
    workbook.Sheets['Data'] = xlsx.utils.json_to_sheet(enhancedData);

    // Save enhanced workbook
    const enhancedFilePath = originalFilePath.replace('.xlsx', '_enhanced.xlsx');
    xlsx.writeFile(workbook, enhancedFilePath);

    console.log('💾 Enhanced file saved:', enhancedFilePath);

    return enhancedFilePath;
  }

  /**
   * Build storage lookup map: FNSKU -> item data
   */
  buildStorageLookup(storageRows) {
    const lookup = {};

    storageRows.forEach(row => {
      const fnsku = row['fnsku'] || row['FNSKU'];
      if (!fnsku) return;

      // Get item volume (cuft) from storage
      let itemVolume = 0;

      // Try to get pre-calculated item_volume
      if (row['item_volume']) {
        itemVolume = parseFloat(row['item_volume']) || 0;
      }
      // Or calculate from dimensions
      else if (row['longest_side'] && row['median_side'] && row['shortest_side']) {
        const longest = parseFloat(row['longest_side']) || 0;
        const median = parseFloat(row['median_side']) || 0;
        const shortest = parseFloat(row['shortest_side']) || 0;

        // Calculate cubic inches
        const cubicInches = longest * median * shortest;

        // Convert to cubic feet (1728 cubic inches = 1 cubic foot)
        itemVolume = cubicInches / 1728;
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
   * 🆕 NEW: Build cuft lookup from Placement sheet
   * This is the CORRECT way to calculate cuft per shipment
   */
  buildCuftLookupFromPlacement(placementRows, storageLookup) {
    const cuftByShipment = {};

    placementRows.forEach(row => {
      const shipmentID = row['FBA shipment ID'] || row['FBA Shipment ID'];
      const fnsku = row['FNSKU'];
      const quantity = parseFloat(row['Actual received quantity']) || 0;

      if (!shipmentID || !fnsku || quantity === 0) return;

      // Look up item volume for this FNSKU
      const storageInfo = storageLookup[fnsku];
      if (!storageInfo || !storageInfo.itemVolume) return;

      // Calculate cuft for this line item
      const lineCuft = storageInfo.itemVolume * quantity;

      // Aggregate to shipment
      if (!cuftByShipment[shipmentID]) {
        cuftByShipment[shipmentID] = 0;
      }

      cuftByShipment[shipmentID] += lineCuft;
    });

    return cuftByShipment;
  }

  /**
   * Build placement lookup map: FBA Shipment ID -> placement fees
   */
  buildPlacementLookup(placementRows) {
    const lookup = {};

    placementRows.forEach(row => {
      const shipmentID = row['FBA shipment ID'] || row['FBA Shipment ID'];
      if (!shipmentID) return;

      // Get placement fee for this item
      let fee = 0;

      // Try different possible column names
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

      // Aggregate fees for same shipment ID
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
