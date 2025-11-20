// ============================================================================
// AMAZON ENHANCEMENT LAYER - FIXED V3
// File: backend/utils/amazonEnhancementLayer.js
//
// FIX: Only enhance if truly needed, skip if Placement has enough data
// ============================================================================

import xlsx from 'xlsx';
import path from 'path';

/**
 * AmazonEnhancementLayer - V3 FIX
 *
 * KEY CHANGES:
 * - Check if Placement sheet has sufficient data
 * - Skip enhancement if Placement already has cuft values
 * - Only enhance if truly missing critical columns
 */
class AmazonEnhancementLayer {

  constructor() {
    this.CUFT_PER_PALLET = 67;
  }

  /**
   * Main entry point - SMARTER enhancement logic
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

    // V3 FIX: Check if Placement has cuft data
    if (workbook.Sheets['Placement']) {
      const placementHasCuft = this.checkPlacementHasCuft(workbook.Sheets['Placement']);

      if (placementHasCuft) {
        console.log('✅ Placement sheet has cuft data - skipping enhancement');
        console.log('   Parser will calculate from Placement sheet directly');
        return filePath;
      }
    }

    console.log('🔧 Enhancement required:', needsEnhancement.missingColumns.join(', '));

    // Perform enhancement
    const enhancedFilePath = await this.enhanceFile(workbook, filePath, needsEnhancement);

    console.log('✅ Enhancement complete:', enhancedFilePath);
    return enhancedFilePath;
  }

  /**
   * V3 NEW: Check if Placement sheet has cuft data
   */
  checkPlacementHasCuft(placementSheet) {
    const data = xlsx.utils.sheet_to_json(placementSheet);

    if (data.length === 0) return false;

    // Check if "Total Cuft" column exists and has values
    const hasTotalCuftColumn = Object.keys(data[0]).some(h =>
      h.toLowerCase().includes('total cuft') || h.toLowerCase() === 'cuft'
    );

    if (!hasTotalCuftColumn) return false;

    // Check if at least 10% of rows have cuft values > 0
    let rowsWithCuft = 0;
    data.forEach(row => {
      const cuft = parseFloat(row['Total Cuft'] || row['Cuft'] || row['total cuft'] || 0);
      if (cuft > 0) rowsWithCuft++;
    });

    const percentageWithCuft = (rowsWithCuft / data.length) * 100;

    console.log(`   Placement sheet check: ${rowsWithCuft}/${data.length} rows have cuft (${percentageWithCuft.toFixed(1)}%)`);

    return percentageWithCuft >= 10; // If 10%+ rows have cuft, consider it sufficient
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
   * Enhance the file - same as before
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

    const storageLookup = this.buildStorageLookup(storageRows);
    const placementByShipmentID = this.buildPlacementLookup(placementRows);
    const cuftByShipmentID = this.buildCuftLookupFromPlacement(placementRows, storageLookup);

    console.log(`🔍 Storage lookup map: ${Object.keys(storageLookup).length} unique FNSKUs`);
    console.log(`🔍 Placement lookup map: ${Object.keys(placementByShipmentID).length} unique shipment IDs`);
    console.log(`🔍 Cuft lookup map: ${Object.keys(cuftByShipmentID).length} unique shipment IDs`);

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

    const totalCuft = enhancedData.reduce((sum, row) => sum + (row['Cuft'] || 0), 0);
    const totalPlacementFees = enhancedData.reduce((sum, row) => sum + (row['Placement Fees'] || 0), 0);
    const totalPallets = enhancedData.reduce((sum, row) => sum + (row['Total Pallet Quantity'] || 0), 0);

    console.log('📊 Enhancement Summary:');
    console.log(`   Total Cuft: ${totalCuft.toFixed(2)}`);
    console.log(`   Total Placement Fees: $${totalPlacementFees.toFixed(2)}`);
    console.log(`   Total Pallets: ${totalPallets.toFixed(2)}`);

    workbook.Sheets['Data'] = xlsx.utils.json_to_sheet(enhancedData);

    const enhancedFilePath = originalFilePath.replace('.xlsx', '_enhanced.xlsx');
    xlsx.writeFile(workbook, enhancedFilePath);

    console.log('💾 Enhanced file saved:', enhancedFilePath);

    return enhancedFilePath;
  }

  buildStorageLookup(storageRows) {
    const lookup = {};

    storageRows.forEach(row => {
      const fnsku = row['fnsku'] || row['FNSKU'];
      if (!fnsku) return;

      let itemVolume = 0;

      if (row['item_volume']) {
        itemVolume = parseFloat(row['item_volume']) || 0;
      } else if (row['longest_side'] && row['median_side'] && row['shortest_side']) {
        const longest = parseFloat(row['longest_side']) || 0;
        const median = parseFloat(row['median_side']) || 0;
        const shortest = parseFloat(row['shortest_side']) || 0;
        const cubicInches = longest * median * shortest;
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

  buildCuftLookupFromPlacement(placementRows, storageLookup) {
    const cuftByShipment = {};

    placementRows.forEach(row => {
      const shipmentID = row['FBA shipment ID'] || row['FBA Shipment ID'];
      const fnsku = row['FNSKU'];
      const quantity = parseFloat(row['Actual received quantity']) || 0;

      if (!shipmentID || !fnsku || quantity === 0) return;

      const storageInfo = storageLookup[fnsku];
      if (!storageInfo || !storageInfo.itemVolume) return;

      const lineCuft = storageInfo.itemVolume * quantity;

      if (!cuftByShipment[shipmentID]) {
        cuftByShipment[shipmentID] = 0;
      }

      cuftByShipment[shipmentID] += lineCuft;
    });

    return cuftByShipment;
  }

  buildPlacementLookup(placementRows) {
    const lookup = {};

    placementRows.forEach(row => {
      const shipmentID = row['FBA shipment ID'] || row['FBA Shipment ID'];
      if (!shipmentID) return;

      let fee = 0;

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
