// ============================================================================
// ADMIN RATE UPLOAD FEATURE
// File: backend/routes/adminRateUpload.js
// ============================================================================

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import XLSX from 'xlsx';
import AmazonRateEnhanced from '../models/AmazonRateEnhanced.js';
import ShopifyRate from '../models/ShopifyRate.js';

const router = express.Router();

// Configure multer for rate file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads/rates';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'rate-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel and CSV files are allowed'));
    }
  }
});

// Admin middleware
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// ============================================================================
// RATE FILE PARSERS
// ============================================================================

class RateFileParser {

  /**
   * Parse prep rate file
   * Expected columns: Cost Type, Base Cost, Additional Cost, Min Charge, Description
   */
  static parsePrepRateFile(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const prepCosts = data.map(row => ({
      costType: row['Cost Type'] || row['costType'],
      baseCost: parseFloat(row['Base Cost'] || row['baseCost'] || 0),
      additionalCost: parseFloat(row['Additional Cost'] || row['additionalCost'] || 0),
      minCharge: parseFloat(row['Min Charge'] || row['minCharge'] || 0),
      description: row['Description'] || row['description'] || ''
    }));

    // Validate cost types
    const validCostTypes = ['perUnit', 'perSKU', 'perPallet', 'perCubicFoot', 'perPound'];
    const invalidCosts = prepCosts.filter(c => !validCostTypes.includes(c.costType));

    if (invalidCosts.length > 0) {
      throw new Error(`Invalid cost types: ${invalidCosts.map(c => c.costType).join(', ')}`);
    }

    return {
      prepCosts,
      markupPercentage: this.extractMarkup(data)
    };
  }

  /**
   * Parse middle-mile rate file
   * Expected columns: Shipment Type, Pricing Model, Base Cost, Per Unit Cost,
   *                   Fuel Surcharge, Min Charge, Transit Days
   * Optional: State, Zone, Cost Multiplier (for destination zones)
   */
  static parseMiddleMileRateFile(filePath) {
    const workbook = XLSX.readFile(filePath);

    // Main rates sheet
    const mainSheet = workbook.Sheets[workbook.SheetNames[0]];
    const mainData = XLSX.utils.sheet_to_json(mainSheet);

    // Destination zones sheet (if exists)
    let destinationZones = [];
    if (workbook.SheetNames.includes('Destination Zones') || workbook.SheetNames.includes('Zones')) {
      const zonesSheet = workbook.Sheets[workbook.SheetNames.find(s =>
        s.includes('Zones') || s.includes('zones')
      )];
      const zonesData = XLSX.utils.sheet_to_json(zonesSheet);
      destinationZones = zonesData.map(row => ({
        state: row['State'] || row['state'],
        zone: parseInt(row['Zone'] || row['zone'] || 5),
        costMultiplier: parseFloat(row['Cost Multiplier'] || row['costMultiplier'] || 1.0)
      }));
    }

    const middleMileCosts = mainData.map(row => ({
      shipmentType: row['Shipment Type'] || row['shipmentType'],
      pricingModel: row['Pricing Model'] || row['pricingModel'],
      baseCost: parseFloat(row['Base Cost'] || row['baseCost'] || 0),
      perUnitCost: parseFloat(row['Per Unit Cost'] || row['perUnitCost'] || 0),
      fuelSurcharge: parseFloat(row['Fuel Surcharge'] || row['fuelSurcharge'] || 0),
      minCharge: parseFloat(row['Min Charge'] || row['minCharge'] || 0),
      transitDays: parseInt(row['Transit Days'] || row['transitDays'] || 5),
      destinationZones: destinationZones.length > 0 ? destinationZones : []
    }));

    return {
      middleMileCosts,
      markupPercentage: this.extractMarkup(mainData)
    };
  }

  /**
   * Parse FBA shipment rate file
   * Expected columns: Zone, Base Cost, Per Pound Cost, Transit Days
   * Weight brackets in separate sheet
   */
  static parseFBAShipmentRateFile(filePath) {
    const workbook = XLSX.readFile(filePath);

    // Zones sheet
    const zonesSheet = workbook.Sheets[workbook.SheetNames[0]];
    const zonesData = XLSX.utils.sheet_to_json(zonesSheet);

    const zones = zonesData.map(row => ({
      zone: parseInt(row['Zone'] || row['zone']),
      baseCost: parseFloat(row['Base Cost'] || row['baseCost'] || 0),
      perPoundCost: parseFloat(row['Per Pound Cost'] || row['perPoundCost'] || 0),
      transitDays: parseInt(row['Transit Days'] || row['transitDays'] || 5)
    }));

    // Weight brackets sheet (if exists)
    let weightBrackets = [];
    if (workbook.SheetNames.includes('Weight Brackets') || workbook.SheetNames.length > 1) {
      const bracketsSheet = workbook.Sheets[workbook.SheetNames.find(s =>
        s.includes('Weight') || s.includes('Bracket')
      ) || workbook.SheetNames[1]];
      const bracketsData = XLSX.utils.sheet_to_json(bracketsSheet);

      weightBrackets = bracketsData.map(row => ({
        minWeight: parseFloat(row['Min Weight'] || row['minWeight'] || 0),
        maxWeight: parseFloat(row['Max Weight'] || row['maxWeight'] || 999999),
        multiplier: parseFloat(row['Multiplier'] || row['multiplier'] || 1.0)
      }));
    } else {
      // Default weight brackets
      weightBrackets = [
        { minWeight: 0, maxWeight: 1, multiplier: 1.0 },
        { minWeight: 1, maxWeight: 5, multiplier: 0.95 },
        { minWeight: 5, maxWeight: 10, multiplier: 0.90 },
        { minWeight: 10, maxWeight: 50, multiplier: 0.85 },
        { minWeight: 50, maxWeight: 999999, multiplier: 0.80 }
      ];
    }

    // Service types (if exists in sheet)
    let serviceTypes = [
      { name: 'Ground', costMultiplier: 1.0 },
      { name: '2-Day', costMultiplier: 1.5 },
      { name: 'Overnight', costMultiplier: 2.5 }
    ];

    // FBA fees (if exists in sheet)
    let fbaFees = [];
    if (workbook.SheetNames.includes('FBA Fees') || workbook.SheetNames.includes('Fees')) {
      const feesSheet = workbook.Sheets[workbook.SheetNames.find(s =>
        s.includes('Fee') || s.includes('fee')
      )];
      const feesData = XLSX.utils.sheet_to_json(feesSheet);

      fbaFees = feesData.map(row => ({
        feeType: row['Fee Type'] || row['feeType'],
        calculationType: row['Calculation Type'] || row['calculationType'],
        cost: parseFloat(row['Cost'] || row['cost'] || 0),
        applicableConditions: row['Conditions'] || row['conditions'] || ''
      }));
    }

    return {
      zones,
      weightBrackets,
      serviceTypes,
      fbaFees,
      markupPercentage: this.extractMarkup(zonesData)
    };
  }

  /**
   * Extract markup percentage from data (if present in any row)
   */
  static extractMarkup(data) {
    for (const row of data) {
      if (row['Markup'] || row['markup'] || row['Markup %'] || row['Markup Percentage']) {
        return parseFloat(row['Markup'] || row['markup'] || row['Markup %'] || row['Markup Percentage'] || 0);
      }
    }
    return 0;
  }
}

// ============================================================================
// ADMIN RATE UPLOAD ROUTES
// ============================================================================

/**
 * POST /api/admin/rates/upload/prep
 * Upload prep rate configuration file
 */
router.post('/upload/prep', isAdmin, upload.single('file'), async (req, res) => {
  try {

    const rateTypeLabel = 'Prep';

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { rateName, description, effectiveDate, notes } = req.body;

    if (!rateName) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Rate name is required'
      });
    }

    console.log('Parsing prep rate file:', req.file.originalname);

    // Parse the uploaded file
    const rateDetails = RateFileParser.parsePrepRateFile(req.file.path);

    // Create rate document
    const newRate = new AmazonRateEnhanced({
      rateType: 'prep',
      rateName,
      description: description || `Prep rate uploaded from ${req.file.originalname}`,
      rateDetails,
      effectiveDate: effectiveDate || new Date(),
      isActive: true,
      createdBy: req.user._id,
      notes: notes || `Uploaded from file: ${req.file.originalname}`
    });

    await newRate.save();

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.status(201).json({
    success: true,
    message: `${rateTypeLabel} rate created successfully from uploaded file`,
    rate: newRate.toObject() // Return full rate document
    });

  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('Error uploading prep rate:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing rate file',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/rates/upload/middleMile
 * Upload middle-mile rate configuration file
 */
router.post('/upload/middleMile', isAdmin, upload.single('file'), async (req, res) => {
  try {

    const rateTypeLabel = 'Middle-mile';

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { rateName, description, effectiveDate, notes } = req.body;

    if (!rateName) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Rate name is required'
      });
    }

    console.log('Parsing middle-mile rate file:', req.file.originalname);

    // Parse the uploaded file
    const rateDetails = RateFileParser.parseMiddleMileRateFile(req.file.path);

    // Create rate document
    const newRate = new AmazonRateEnhanced({
      rateType: 'middleMile',
      rateName,
      description: description || `Middle-mile rate uploaded from ${req.file.originalname}`,
      rateDetails,
      effectiveDate: effectiveDate || new Date(),
      isActive: true,
      createdBy: req.user._id,
      notes: notes || `Uploaded from file: ${req.file.originalname}`
    });

    await newRate.save();

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.status(201).json({
    success: true,
    message: 'Middle-mile rate created successfully from uploaded file',
    rate: newRate.toObject()
    });

  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('Error uploading middle-mile rate:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing rate file',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/rates/upload/fbaShipment
 * Upload FBA shipment rate configuration file
 */
router.post('/upload/fbaShipment', isAdmin, upload.single('file'), async (req, res) => {
  try {

    const rateTypeLabel = 'FBA Shipment';

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { rateName, description, effectiveDate, notes } = req.body;

    if (!rateName) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Rate name is required'
      });
    }

    console.log('Parsing FBA shipment rate file:', req.file.originalname);

    // Parse the uploaded file
    const rateDetails = RateFileParser.parseFBAShipmentRateFile(req.file.path);

    // Create rate document
    const newRate = new AmazonRateEnhanced({
      rateType: 'fbaShipment',
      rateName,
      description: description || `FBA shipment rate uploaded from ${req.file.originalname}`,
      rateDetails,
      effectiveDate: effectiveDate || new Date(),
      isActive: true,
      createdBy: req.user._id,
      notes: notes || `Uploaded from file: ${req.file.originalname}`
    });

    await newRate.save();

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.status(201).json({
    success: true,
    message: 'FBA shipment rate created successfully from uploaded file',
    rate: newRate.toObject()
    });

  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('Error uploading FBA shipment rate:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing rate file',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/rates/template/:rateType
 * Download template Excel file for rate upload
 */
router.get('/template/:rateType', isAdmin, (req, res) => {
  const { rateType } = req.params;

  const templates = {
    prep: 'PREP_RATE_TEMPLATE.xlsx',
    middleMile: 'MIDDLE_MILE_RATE_TEMPLATE.xlsx',
    fbaShipment: 'FBA_SHIPMENT_RATE_TEMPLATE.xlsx'
  };

  const templateFile = templates[rateType];

  if (!templateFile) {
    return res.status(400).json({
      success: false,
      message: 'Invalid rate type'
    });
  }

  const templatePath = path.join(__dirname, '../templates/rates', templateFile);

  if (!fs.existsSync(templatePath)) {
    return res.status(404).json({
      success: false,
      message: 'Template file not found',
      note: 'Create template files in backend/templates/rates/ directory'
    });
  }

  res.download(templatePath, templateFile);
});

export default router;
