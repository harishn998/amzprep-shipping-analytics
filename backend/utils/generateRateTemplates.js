// ============================================================================
// EXCEL TEMPLATE GENERATOR FOR ADMIN RATE UPLOADS
// File: backend/utils/generateRateTemplates.js
// Run: node backend/utils/generateRateTemplates.js
// ============================================================================

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create templates directory if it doesn't exist
const templatesDir = path.join(__dirname, '../templates/rates');
if (!fs.existsSync(templatesDir)) {
  fs.mkdirSync(templatesDir, { recursive: true });
}

// ============================================================================
// PREP RATE TEMPLATE
// ============================================================================

function generatePrepRateTemplate() {
  const prepData = [
    {
      'Cost Type': 'perUnit',
      'Base Cost': 0.50,
      'Additional Cost': 0.10,
      'Min Charge': 25.00,
      'Description': 'Standard unit prep (receiving, inspection, labeling)'
    },
    {
      'Cost Type': 'perSKU',
      'Base Cost': 5.00,
      'Additional Cost': 0.00,
      'Min Charge': 0,
      'Description': 'Per SKU handling fee'
    },
    {
      'Cost Type': 'perPallet',
      'Base Cost': 15.00,
      'Additional Cost': 0.00,
      'Min Charge': 0,
      'Description': 'Pallet handling and breakdown'
    },
    {
      'Cost Type': 'perCubicFoot',
      'Base Cost': 0.25,
      'Additional Cost': 0.00,
      'Min Charge': 0,
      'Description': 'Storage-based pricing'
    },
    {
      'Cost Type': 'perPound',
      'Base Cost': 0.05,
      'Additional Cost': 0.00,
      'Min Charge': 0,
      'Description': 'Weight-based pricing'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(prepData);

  // Add instructions sheet
  const instructions = [
    { Instruction: 'PREP RATE TEMPLATE INSTRUCTIONS' },
    { Instruction: '' },
    { Instruction: 'Valid Cost Types:' },
    { Instruction: '  - perUnit: Cost per individual unit/item' },
    { Instruction: '  - perSKU: Cost per unique SKU' },
    { Instruction: '  - perPallet: Cost per pallet' },
    { Instruction: '  - perCubicFoot: Cost per cubic foot of volume' },
    { Instruction: '  - perPound: Cost per pound of weight' },
    { Instruction: '' },
    { Instruction: 'Base Cost: Primary cost for this operation' },
    { Instruction: 'Additional Cost: Extra charges (optional, can be 0)' },
    { Instruction: 'Min Charge: Minimum charge regardless of quantity (optional)' },
    { Instruction: '' },
    { Instruction: 'You can add a "Markup" column with % value (e.g., 10 for 10%)' }
  ];

  const wsInstructions = XLSX.utils.json_to_sheet(instructions);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Prep Costs');
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  const filePath = path.join(templatesDir, 'PREP_RATE_TEMPLATE.xlsx');
  XLSX.writeFile(wb, filePath);
  console.log('✓ Created PREP_RATE_TEMPLATE.xlsx');
}

// ============================================================================
// MIDDLE-MILE RATE TEMPLATE
// ============================================================================

function generateMiddleMileRateTemplate() {
  // Main rates sheet
  const mainData = [
    {
      'Shipment Type': 'LTL',
      'Pricing Model': 'perPallet',
      'Base Cost': 150.00,
      'Per Unit Cost': 56.00,
      'Fuel Surcharge': 0.15,
      'Min Charge': 250.00,
      'Transit Days': 6
    },
    {
      'Shipment Type': 'FTL',
      'Pricing Model': 'flat',
      'Base Cost': 1500.00,
      'Per Unit Cost': 0,
      'Fuel Surcharge': 0.15,
      'Min Charge': 1500.00,
      'Transit Days': 5
    },
    {
      'Shipment Type': 'Parcel',
      'Pricing Model': 'perPound',
      'Base Cost': 25.00,
      'Per Unit Cost': 0.75,
      'Fuel Surcharge': 0.12,
      'Min Charge': 50.00,
      'Transit Days': 4
    }
  ];

  // Destination zones sheet
  const zonesData = [
    { 'State': 'FL', 'Zone': 7, 'Cost Multiplier': 1.2 },
    { 'State': 'MI', 'Zone': 4, 'Cost Multiplier': 1.0 },
    { 'State': 'GA', 'Zone': 6, 'Cost Multiplier': 1.15 },
    { 'State': 'TX', 'Zone': 5, 'Cost Multiplier': 1.1 },
    { 'State': 'CA', 'Zone': 8, 'Cost Multiplier': 1.3 },
    { 'State': 'NY', 'Zone': 5, 'Cost Multiplier': 1.1 },
    { 'State': 'IL', 'Zone': 3, 'Cost Multiplier': 0.9 }
  ];

  const instructions = [
    { Instruction: 'MIDDLE-MILE RATE TEMPLATE INSTRUCTIONS' },
    { Instruction: '' },
    { Instruction: 'Valid Shipment Types:' },
    { Instruction: '  - LTL: Less Than Truckload' },
    { Instruction: '  - FTL: Full Truckload' },
    { Instruction: '  - Parcel: Individual packages' },
    { Instruction: '' },
    { Instruction: 'Valid Pricing Models:' },
    { Instruction: '  - perPallet: Price per pallet' },
    { Instruction: '  - perCubicFoot: Price per cubic foot' },
    { Instruction: '  - perPound: Price per pound' },
    { Instruction: '  - flat: Flat rate (Base Cost only)' },
    { Instruction: '' },
    { Instruction: 'Fuel Surcharge: Decimal (0.15 = 15%)' },
    { Instruction: '' },
    { Instruction: 'Destination Zones sheet is optional but recommended' },
    { Instruction: 'Cost Multiplier adjusts base cost by state (1.0 = 100%)' }
  ];

  const wsMain = XLSX.utils.json_to_sheet(mainData);
  const wsZones = XLSX.utils.json_to_sheet(zonesData);
  const wsInstructions = XLSX.utils.json_to_sheet(instructions);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsMain, 'Middle Mile Rates');
  XLSX.utils.book_append_sheet(wb, wsZones, 'Destination Zones');
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  const filePath = path.join(templatesDir, 'MIDDLE_MILE_RATE_TEMPLATE.xlsx');
  XLSX.writeFile(wb, filePath);
  console.log('✓ Created MIDDLE_MILE_RATE_TEMPLATE.xlsx');
}

// ============================================================================
// FBA SHIPMENT RATE TEMPLATE
// ============================================================================

function generateFBAShipmentRateTemplate() {
  // Zones data
  const zonesData = [
    { 'Zone': 2, 'Base Cost': 5.50, 'Per Pound Cost': 0.35, 'Transit Days': 2 },
    { 'Zone': 3, 'Base Cost': 6.00, 'Per Pound Cost': 0.40, 'Transit Days': 3 },
    { 'Zone': 4, 'Base Cost': 6.50, 'Per Pound Cost': 0.45, 'Transit Days': 4 },
    { 'Zone': 5, 'Base Cost': 7.00, 'Per Pound Cost': 0.50, 'Transit Days': 5 },
    { 'Zone': 6, 'Base Cost': 7.50, 'Per Pound Cost': 0.55, 'Transit Days': 6 },
    { 'Zone': 7, 'Base Cost': 8.00, 'Per Pound Cost': 0.60, 'Transit Days': 7 },
    { 'Zone': 8, 'Base Cost': 9.00, 'Per Pound Cost': 0.70, 'Transit Days': 8 }
  ];

  // Weight brackets data
  const bracketsData = [
    { 'Min Weight': 0, 'Max Weight': 1, 'Multiplier': 1.0 },
    { 'Min Weight': 1, 'Max Weight': 5, 'Multiplier': 0.95 },
    { 'Min Weight': 5, 'Max Weight': 10, 'Multiplier': 0.90 },
    { 'Min Weight': 10, 'Max Weight': 20, 'Multiplier': 0.85 },
    { 'Min Weight': 20, 'Max Weight': 50, 'Multiplier': 0.80 },
    { 'Min Weight': 50, 'Max Weight': 999999, 'Multiplier': 0.75 }
  ];

  // Service types (optional)
  const serviceData = [
    { 'Service Name': 'Ground', 'Cost Multiplier': 1.0 },
    { 'Service Name': '2-Day', 'Cost Multiplier': 1.5 },
    { 'Service Name': 'Overnight', 'Cost Multiplier': 2.5 }
  ];

  // FBA Fees (optional)
  const feesData = [
    { 'Fee Type': 'placementFee', 'Calculation Type': 'perUnit', 'Cost': 0.52, 'Conditions': 'Split shipments' },
    { 'Fee Type': 'splitShipmentFee', 'Calculation Type': 'perShipment', 'Cost': 150.00, 'Conditions': 'Multiple destinations' },
    { 'Fee Type': 'inboundPlacementFee', 'Calculation Type': 'perPallet', 'Cost': 35.00, 'Conditions': 'Per pallet' }
  ];

  const instructions = [
    { Instruction: 'FBA SHIPMENT RATE TEMPLATE INSTRUCTIONS' },
    { Instruction: '' },
    { Instruction: 'Zones Sheet (Required):' },
    { Instruction: '  - Zone: Amazon shipping zone (2-8)' },
    { Instruction: '  - Base Cost: Starting cost' },
    { Instruction: '  - Per Pound Cost: Cost per pound' },
    { Instruction: '  - Transit Days: Expected delivery days' },
    { Instruction: '' },
    { Instruction: 'Weight Brackets Sheet (Optional):' },
    { Instruction: '  - Provides volume discounts' },
    { Instruction: '  - Multiplier: Adjust cost (1.0 = 100%, 0.95 = 5% discount)' },
    { Instruction: '' },
    { Instruction: 'Service Types Sheet (Optional):' },
    { Instruction: '  - Define service levels (Ground, Express, etc.)' },
    { Instruction: '' },
    { Instruction: 'FBA Fees Sheet (Optional):' },
    { Instruction: '  - Valid Fee Types: placementFee, splitShipmentFee, etc.' },
    { Instruction: '  - Valid Calculation Types: perUnit, perShipment, perPallet' }
  ];

  const wsZones = XLSX.utils.json_to_sheet(zonesData);
  const wsBrackets = XLSX.utils.json_to_sheet(bracketsData);
  const wsServices = XLSX.utils.json_to_sheet(serviceData);
  const wsFees = XLSX.utils.json_to_sheet(feesData);
  const wsInstructions = XLSX.utils.json_to_sheet(instructions);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsZones, 'Zones');
  XLSX.utils.book_append_sheet(wb, wsBrackets, 'Weight Brackets');
  XLSX.utils.book_append_sheet(wb, wsServices, 'Service Types');
  XLSX.utils.book_append_sheet(wb, wsFees, 'FBA Fees');
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  const filePath = path.join(templatesDir, 'FBA_SHIPMENT_RATE_TEMPLATE.xlsx');
  XLSX.writeFile(wb, filePath);
  console.log('✓ Created FBA_SHIPMENT_RATE_TEMPLATE.xlsx');
}

// ============================================================================
// RUN GENERATOR
// ============================================================================

console.log('Generating rate upload templates...\n');

generatePrepRateTemplate();
generateMiddleMileRateTemplate();
generateFBAShipmentRateTemplate();

console.log('\n✓ All templates generated successfully!');
console.log(`Location: ${templatesDir}`);
console.log('\nTemplates created:');
console.log('  1. PREP_RATE_TEMPLATE.xlsx');
console.log('  2. MIDDLE_MILE_RATE_TEMPLATE.xlsx');
console.log('  3. FBA_SHIPMENT_RATE_TEMPLATE.xlsx');
console.log('\nAdmins can download these templates and fill them with their rate data.');
