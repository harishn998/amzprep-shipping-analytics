// ============================================================================
// EXCEL MERGER - Merge separate tabs into single workbook
// File: backend/utils/excelMerger.js
// ============================================================================

import xlsx from 'xlsx';
import path from 'path';
import { getFBAZoningSheet } from './fbaZoningHelper.js';
import { validateAndEnhanceFile, logColumnHeaders } from './fileEnhancer.js';
import DataSheetEnhancer from './dataSheetEnhancer.js';

/**
 * Merge three separate Excel files into one workbook
 * @param {string} dataPath - Path to Data tab file
 * @param {string} placementPath - Path to Placement tab file
 * @param {string} storagePath - Path to Storage tab file
 * @returns {string} - Path to merged workbook
 */
export async function mergeExcelTabs(dataPath, placementPath, storagePath) {
  console.log('🔄 Merging Excel tabs...');
  console.log(`   Data: ${path.basename(dataPath)}`);
  console.log(`   Placement: ${path.basename(placementPath)}`);
  console.log(`   Storage: ${path.basename(storagePath)}`);

  try {
    // Read each file
    const dataWorkbook = xlsx.readFile(dataPath);
    const placementWorkbook = xlsx.readFile(placementPath);
    const storageWorkbook = xlsx.readFile(storagePath);

    // Get first sheet from each
    const dataSheet = dataWorkbook.Sheets[dataWorkbook.SheetNames[0]];
    const placementSheet = placementWorkbook.Sheets[placementWorkbook.SheetNames[0]];
    const storageSheet = storageWorkbook.Sheets[storageWorkbook.SheetNames[0]];

    // Create new workbook
    const mergedWorkbook = xlsx.utils.book_new();

    // Add sheets with standard names
    xlsx.utils.book_append_sheet(mergedWorkbook, dataSheet, 'Data');
    xlsx.utils.book_append_sheet(mergedWorkbook, placementSheet, 'Placement');
    xlsx.utils.book_append_sheet(mergedWorkbook, storageSheet, 'Storage');

    // Get FBA Zoning from database/config
    const fbaZoningSheet = await getFBAZoningSheet();
    xlsx.utils.book_append_sheet(mergedWorkbook, fbaZoningSheet, 'FBA Zoning');

    // Enhance Data sheet with calculated fields BEFORE writing
    console.log('\n📊 Enhancing Data sheet...');
    const dataEnhancer = new DataSheetEnhancer();
    const enhancedWorkbook = dataEnhancer.enhanceDataSheet(mergedWorkbook);

    // Write to temp file
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const outputPath = path.join(
      process.cwd(),
      'uploads',
      `merged-${timestamp}-${randomId}.xlsx`
    );

    xlsx.writeFile(enhancedWorkbook, outputPath);

    // Validate merged file
    console.log('\n🔍 Validating merged workbook...');
    const validation = validateAndEnhanceFile(outputPath);

    if (!validation.valid) {
      throw new Error('Merged workbook validation failed');
    }

    if (validation.warnings.length > 0) {
      console.log('⚠️  Validation warnings:');
      validation.warnings.forEach(w => console.log(`   - ${w}`));
    }

    console.log(`✅ Merged file created: ${path.basename(outputPath)}`);
    console.log(`   Sheets: Data, Placement, Storage, FBA Zoning`);
    console.log(`   Data rows: ${validation.dataRows}`);
    console.log(`   Placement rows: ${validation.placementRows}`);
    console.log(`   Storage rows: ${validation.storageRows}`);
    console.log(`   Has Total Cuft: ${validation.hasTotalCuft ? 'YES ✅' : 'NO ❌ (using fallback)'}`);

    return outputPath;

  } catch (error) {
    console.error('❌ Error merging Excel files:', error.message);
    throw new Error(`Failed to merge Excel files: ${error.message}`);
  }
}

/**
 * Validate merged workbook has all required sheets
 */
export function validateMergedWorkbook(filePath) {
  try {
    const workbook = xlsx.readFile(filePath);
    const requiredSheets = ['Data', 'Placement', 'Storage', 'FBA Zoning'];

    const missingSheets = requiredSheets.filter(
      sheet => !workbook.SheetNames.includes(sheet)
    );

    if (missingSheets.length > 0) {
      throw new Error(`Missing sheets: ${missingSheets.join(', ')}`);
    }

    return true;

  } catch (error) {
    throw new Error(`Invalid merged workbook: ${error.message}`);
  }
}
