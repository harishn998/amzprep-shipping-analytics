// ============================================================================
// ADMIN FBA ZONING ROUTES - Manage FBA Zoning Configurations
// File: backend/routes/adminFBAZoning.js
// ============================================================================

import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import jwt from 'jsonwebtoken';
import FBAZoningConfig from '../models/FBAZoningConfig.js';
import { clearFBAZoningCache } from '../utils/fbaZoningHelper.js';

const router = express.Router();

// Admin middleware - Only admins can access these routes
const isAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Multer for FBA Zoning file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls'];
    const ext = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  }
});

/**
 * POST /api/admin/fba-zoning/upload
 * Upload new FBA Zoning configuration
 */
router.post('/upload', isAdmin, upload.single('file'), async (req, res) => {
  try {
    console.log('\n📤 ========== FBA ZONING UPLOAD ==========');
    console.log(`   Admin: ${req.user.email}`);
    console.log(`   File: ${req.file?.originalname}`);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { version, description, effectiveDate, makeActive } = req.body;

    if (!version) {
      return res.status(400).json({
        success: false,
        error: 'Version is required'
      });
    }

    // Check if version already exists
    const existingVersion = await FBAZoningConfig.findOne({ version });
    if (existingVersion) {
      return res.status(400).json({
        success: false,
        error: `Version "${version}" already exists. Please use a different version.`
      });
    }

    // Read Excel file from buffer
    console.log('   📊 Reading Excel file...');
    const workbook = xlsx.read(req.file.buffer);
    const sheetName = workbook.SheetNames[0];
    const zoningData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log(`   Rows: ${zoningData.length}`);

    // Validate data
    if (!zoningData.length) {
      return res.status(400).json({
        success: false,
        error: 'FBA Zoning file is empty'
      });
    }

    // Check required columns
    // Support both formats:
    // Format 1 (Simple): Destination, Zone, State, Region
    // Format 2 (Full): Ship to, Zip, Province, FBA, 2 Region, 3 Region, DC
    const firstRow = zoningData[0];
    const hasSimpleFormat = firstRow.hasOwnProperty('Destination') &&
                           firstRow.hasOwnProperty('Zone') &&
                           firstRow.hasOwnProperty('State') &&
                           firstRow.hasOwnProperty('Region');

    const hasFullFormat = firstRow.hasOwnProperty('FBA') &&
                         firstRow.hasOwnProperty('Province');

    if (!hasSimpleFormat && !hasFullFormat) {
      return res.status(400).json({
        success: false,
        error: `Invalid file format. Required columns:\n` +
               `Format 1: Destination, Zone, State, Region\n` +
               `Format 2: Ship to, Zip, Province, FBA, 2 Region, 3 Region, DC\n` +
               `Found columns: ${Object.keys(firstRow).join(', ')}`
      });
    }

    console.log(`   ✅ Valid ${hasFullFormat ? 'Full' : 'Simple'} format detected`);

    // If makeActive, deactivate all others
    if (makeActive === 'true' || makeActive === true) {
      console.log('   🔄 Deactivating other versions...');
      await FBAZoningConfig.updateMany({}, { isActive: false });
    }

    // Create new configuration
    const config = new FBAZoningConfig({
      version,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      zoningData,
      isActive: makeActive === 'true' || makeActive === true,
      createdBy: req.user.id,
      description: description || '',
      rowCount: zoningData.length
    });

    await config.save();

    // Clear cache so new data is used immediately
    clearFBAZoningCache();

    console.log(`   💾 FBA Zoning saved: ${config._id}`);
    console.log(`   Active: ${config.isActive ? 'YES' : 'NO'}`);
    console.log('============================================\n');

    res.json({
      success: true,
      message: `FBA Zoning ${version} uploaded successfully`,
      config: {
        id: config._id,
        version: config.version,
        rowCount: config.rowCount,
        isActive: config.isActive,
        effectiveDate: config.effectiveDate,
        createdAt: config.createdAt
      }
    });

  } catch (error) {
    console.error('❌ FBA Zoning upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/fba-zoning/list
 * Get all FBA Zoning configurations
 */
router.get('/list', isAdmin, async (req, res) => {
  try {
    console.log('📋 Fetching FBA Zoning configurations...');

    const configs = await FBAZoningConfig.find()
      .select('-zoningData') // Exclude large data field for list view
      .populate('createdBy', 'name email')
      .sort({ effectiveDate: -1 })
      .lean();

    console.log(`✅ Found ${configs.length} configurations`);

    res.json({
      success: true,
      configs
    });

  } catch (error) {
    console.error('❌ FBA Zoning list error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/fba-zoning/active
 * Get currently active FBA Zoning configuration
 */
router.get('/active', isAdmin, async (req, res) => {
  try {
    const active = await FBAZoningConfig.findOne({ isActive: true })
      .populate('createdBy', 'name email')
      .lean();

    if (!active) {
      return res.status(404).json({
        success: false,
        error: 'No active FBA Zoning configuration found'
      });
    }

    res.json({
      success: true,
      config: active
    });

  } catch (error) {
    console.error('❌ FBA Zoning active error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/fba-zoning/:id
 * Get specific FBA Zoning configuration with data
 */
router.get('/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const config = await FBAZoningConfig.findById(id)
      .populate('createdBy', 'name email')
      .lean();

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found'
      });
    }

    res.json({
      success: true,
      config
    });

  } catch (error) {
    console.error('❌ FBA Zoning get error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/admin/fba-zoning/:id/activate
 * Activate a specific FBA Zoning version
 */
router.put('/:id/activate', isAdmin, async (req, res) => {
  try {
    console.log('\n🔄 ========== ACTIVATE FBA ZONING ==========');
    console.log(`   Admin: ${req.user.email}`);
    console.log(`   Config ID: ${req.params.id}`);

    const { id } = req.params;

    // Check if config exists
    const config = await FBAZoningConfig.findById(id);
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found'
      });
    }

    // Deactivate all
    console.log('   🔄 Deactivating all versions...');
    await FBAZoningConfig.updateMany({}, { isActive: false });

    // Activate selected
    config.isActive = true;
    await config.save();

    // Clear cache so new active version is used
    clearFBAZoningCache();

    console.log(`   ✅ Activated version: ${config.version}`);
    console.log('============================================\n');

    res.json({
      success: true,
      message: `FBA Zoning ${config.version} is now active`,
      config: {
        id: config._id,
        version: config.version,
        isActive: config.isActive
      }
    });

  } catch (error) {
    console.error('❌ FBA Zoning activate error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/admin/fba-zoning/:id
 * Delete FBA Zoning configuration
 */
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    console.log('\n🗑️  ========== DELETE FBA ZONING ==========');
    console.log(`   Admin: ${req.user.email}`);
    console.log(`   Config ID: ${req.params.id}`);

    const { id } = req.params;

    const config = await FBAZoningConfig.findById(id);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found'
      });
    }

    // Prevent deletion of active config
    if (config.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete active configuration. Please activate another version first.'
      });
    }

    const version = config.version;
    await config.deleteOne();

    console.log(`   ✅ Deleted version: ${version}`);
    console.log('============================================\n');

    res.json({
      success: true,
      message: `FBA Zoning ${version} deleted successfully`
    });

  } catch (error) {
    console.error('❌ FBA Zoning delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/fba-zoning/template/download
 * Download FBA Zoning template file
 * NOTE: This MUST come BEFORE /:id/download to avoid route conflicts
 */
router.get('/template/download', isAdmin, async (req, res) => {
  try {
    console.log('📥 Downloading FBA Zoning template...');

    // Load full FBA Zoning data from JSON file
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    let templateData;

    // Try to load from data directory
    const templateFilePath = path.join(__dirname, '..', 'data', 'fba_zoning_template.json');

    try {
      if (fs.existsSync(templateFilePath)) {
        const fileData = fs.readFileSync(templateFilePath, 'utf8');
        templateData = JSON.parse(fileData);
        console.log(`📋 Loaded ${templateData.length} destinations from template file`);
      } else {
        // Fallback to sample data if file not found
        console.log('⚠️ Template file not found, using sample data');
        templateData = [
          { 'Ship to': '975 Powder Plans Road, Bessemer, Alabama 35022', 'Zip': '35022', 'Province': 'AL', 'FBA': 'BHM1', '2 Region': 'EAST', '3 Region': 'EAST', 'DC': 41048, 'Zip Prefix': 35 },
          { 'Ship to': '605 143RD AVE, GOODYEAR, AZ, 85338', 'Zip': '85338', 'Province': 'AZ', 'FBA': 'GYR1', '2 Region': 'WEST', '3 Region': 'West', 'DC': 89032, 'Zip Prefix': 85 },
          { 'Ship to': '10205 W ROOSEVELT ST, AVONDALE AZ 85323', 'Zip': '85323', 'Province': 'AZ', 'FBA': 'GYR4', '2 Region': 'WEST', '3 Region': 'West', 'DC': 89032, 'Zip Prefix': 85 },
          { 'Ship to': '6835 WEST BUCKEYE RD, PHOENIX AZ, 85043', 'Zip': '85043', 'Province': 'AZ', 'FBA': 'PHX3', '2 Region': 'WEST', '3 Region': 'West', 'DC': 89032, 'Zip Prefix': 85 },
          { 'Ship to': '16920 W. COMMERCE DR., GOODYEAR, AZ 85338', 'Zip': '85338', 'Province': 'AZ', 'FBA': 'PHX5', '2 Region': 'WEST', '3 Region': 'West', 'DC': 89032, 'Zip Prefix': 85 }
        ];
      }
    } catch (err) {
      console.log('⚠️ Could not load template file:', err.message);
      templateData = [
        { 'Ship to': '975 Powder Plans Road, Bessemer, Alabama 35022', 'Zip': '35022', 'Province': 'AL', 'FBA': 'BHM1', '2 Region': 'EAST', '3 Region': 'EAST', 'DC': 41048, 'Zip Prefix': 35 },
        { 'Ship to': '605 143RD AVE, GOODYEAR, AZ, 85338', 'Zip': '85338', 'Province': 'AZ', 'FBA': 'GYR1', '2 Region': 'WEST', '3 Region': 'West', 'DC': 89032, 'Zip Prefix': 85 },
        { 'Ship to': '10205 W ROOSEVELT ST, AVONDALE AZ 85323', 'Zip': '85323', 'Province': 'AZ', 'FBA': 'GYR4', '2 Region': 'WEST', '3 Region': 'West', 'DC': 89032, 'Zip Prefix': 85 }
      ];
    }

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(templateData);

    // Set column widths for better readability (8 columns now)
    ws['!cols'] = [
      { wch: 50 },  // Ship to
      { wch: 10 },  // Zip
      { wch: 10 },  // Province
      { wch: 10 },  // FBA
      { wch: 12 },  // 2 Region
      { wch: 12 },  // 3 Region
      { wch: 10 },  // DC
      { wch: 12 }   // Zip Prefix (8th column)
    ];

    xlsx.utils.book_append_sheet(wb, ws, 'FBA Zoning');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    console.log(`✅ Template generated with ${templateData.length} destinations (8 columns)`);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="FBA-Zoning-Template.xlsx"');
    res.send(buffer);

  } catch (error) {
    console.error('❌ Template download error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/fba-zoning/:id/download
 * Download FBA Zoning configuration as Excel file
 */
router.get('/:id/download', isAdmin, async (req, res) => {
  try {
    console.log('\n📥 ========== DOWNLOAD FBA ZONING ==========');
    console.log(`   Admin: ${req.user.email}`);
    console.log(`   Config ID: ${req.params.id}`);

    const { id } = req.params;

    const config = await FBAZoningConfig.findById(id);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found'
      });
    }

    // Create workbook
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(config.zoningData);
    xlsx.utils.book_append_sheet(wb, ws, 'FBA Zoning');

    // Generate buffer
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `FBA-Zoning-${config.version.replace(/[^a-zA-Z0-9]/g, '-')}.xlsx`;

    console.log(`   ✅ Generated file: ${filename}`);
    console.log('============================================\n');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);

  } catch (error) {
    console.error('❌ FBA Zoning download error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
