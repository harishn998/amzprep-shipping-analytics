// ============================================================================
// ENHANCED UPLOAD AND ANALYSIS API ROUTES
// File: backend/routes/uploadEnhanced.js
// ============================================================================

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Report from '../models/Report.js';
import ReportAnalyzer from '../utils/reportAnalyzer.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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

// Middleware to ensure user is authenticated
const isAuthenticated = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  next();
};

// ============================================================================
// UPLOAD AND ANALYZE ROUTES
// ============================================================================

/**
 * POST /api/upload/amazon
 * Upload and analyze Amazon shipment data with rate type selection
 */
router.post('/amazon', isAuthenticated, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { rateType } = req.body;

    // Validate rate type
    const validRateTypes = ['prep', 'middleMile', 'fbaShipment', 'combined'];
    if (!validRateTypes.includes(rateType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid rate type. Must be one of: ${validRateTypes.join(', ')}`
      });
    }

    console.log(`Analyzing Amazon file with rate type: ${rateType}`);

    // Analyze the uploaded file
    const analysis = await ReportAnalyzer.analyzeAmazonReport(
      req.file.path,
      'amazon',
      rateType
    );

    // Create report document
    const report = new Report({
      userId: req.user._id,
      userEmail: req.user.email,
      filename: req.file.originalname,
      uploadType: 'amazon',
      rateType: rateType,

      // Basic metrics
      totalShipments: analysis.totalShipments || 0,
      avgWeight: analysis.avgWeight || 0,
      avgCost: analysis.currentCosts?.totalCost || analysis.avgCost || 0,
      analysisMonths: analysis.analysisMonths || 1,

      // Date range
      dateRange: analysis.dateRange || { start: 'N/A', end: 'N/A' },

      // Domestic vs International
      domesticVsInternational: analysis.domesticVsInternational || {
        domestic: analysis.totalShipments || 0,
        international: 0,
        domesticPercent: '100%',
        internationalPercent: '0%'
      },

      // Top states
      topStates: analysis.topStates || [],

      // Enhanced warehouse comparison with cost analysis
      warehouseComparison: analysis.proposedCosts ? [
        {
          name: 'Current Provider',
          fullAddress: 'Current logistics provider',
          region: 'Various',
          specialty: 'Standard fulfillment',
          costMultiplier: 1.0,
          avgZone: 5,
          transitTime: 28,
          cost: analysis.savings?.currentTotal || analysis.currentCosts?.totalCost || 0,
          savings: 0,
          savingsPercent: '0%',
          shipments: analysis.totalShipments || 0,
          recommended: false
        },
        {
          name: 'AMZ Prep Complete Solution',
          fullAddress: 'Columbus, OH - Optimized fulfillment',
          region: 'Midwest',
          specialty: 'Fast prep + shipping',
          costMultiplier: 0.85,
          avgZone: 5,
          transitTime: 6,
          cost: analysis.proposedCosts?.combined?.totalCost || 0,
          savings: analysis.savings?.amount || 0,
          savingsPercent: `${analysis.savings?.percent || 0}%`,
          shipments: analysis.totalShipments || 0,
          recommended: analysis.savings?.amount > 0
        }
      ] : [],

      // Transport modes
      shippingMethods: analysis.transportModes || [],

      // Weight distribution (if available)
      weightDistribution: analysis.weightDistribution || [],

      // Zone distribution (if available)
      zoneDistribution: analysis.zoneDistribution || [],

      // Store enhanced analysis data in metadata (custom field)
      metadata: {
        dataFormat: analysis.dataFormat,
        currentCosts: analysis.currentCosts,
        proposedCosts: analysis.proposedCosts,
        savings: analysis.savings,
        recommendations: analysis.recommendations,
        carriers: analysis.carriers,
        avgPrepTime: analysis.avgPrepTime,
        avgTransitTime: analysis.avgTransitTime,
        splitShipments: analysis.splitShipments,
        splitShipmentRate: analysis.splitShipmentRate
      }
    });

    await report.save();

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: 'File analyzed successfully',
      reportId: report._id,
      analysis: {
        ...analysis,
        reportId: report._id
      }
    });

  } catch (error) {
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('Error processing upload:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing file',
      error: error.message
    });
  }
});

/**
 * POST /api/upload/shopify
 * Upload and analyze Shopify order data
 */
router.post('/shopify', isAuthenticated, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { rateType } = req.body;

    // Validate rate type for Shopify
    const validRateTypes = ['orderUpdate', 'productUpdate'];
    if (!validRateTypes.includes(rateType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid rate type for Shopify. Must be one of: ${validRateTypes.join(', ')}`
      });
    }

    console.log(`Analyzing Shopify file with rate type: ${rateType}`);

    // Analyze Shopify data (would need separate analyzer)
    const analysis = await ReportAnalyzer.analyzeAmazonReport(
      req.file.path,
      'shopify',
      rateType
    );

    // Create report
    const report = new Report({
      userId: req.user._id,
      userEmail: req.user.email,
      filename: req.file.originalname,
      uploadType: 'shopify',
      rateType: rateType,
      totalShipments: analysis.totalShipments || 0,
      avgWeight: analysis.avgWeight || 0,
      avgCost: analysis.avgCost || 0,
      analysisMonths: analysis.analysisMonths || 1,
      dateRange: analysis.dateRange || { start: 'N/A', end: 'N/A' },
      domesticVsInternational: analysis.domesticVsInternational || {},
      topStates: analysis.topStates || [],
      warehouseComparison: analysis.warehouseComparison || [],
      shippingMethods: analysis.shippingMethods || [],
      weightDistribution: analysis.weightDistribution || [],
      zoneDistribution: analysis.zoneDistribution || []
    });

    await report.save();

    // Clean up
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: 'Shopify file analyzed successfully',
      reportId: report._id,
      analysis
    });

  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('Error processing Shopify upload:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing Shopify file',
      error: error.message
    });
  }
});

// ============================================================================
// REPORT RETRIEVAL ROUTES
// ============================================================================

/**
 * GET /api/upload/reports
 * Get all reports for current user
 */
router.get('/reports', isAuthenticated, async (req, res) => {
  try {
    const { uploadType, rateType, limit = 50, skip = 0 } = req.query;

    const query = { userId: req.user._id };

    if (uploadType) {
      query.uploadType = uploadType;
    }

    if (rateType) {
      query.rateType = rateType;
    }

    const reports = await Report.find(query)
      .sort({ uploadDate: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .select('-metadata'); // Exclude heavy metadata in list view

    const total = await Report.countDocuments(query);

    res.json({
      success: true,
      reports,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: (parseInt(skip) + reports.length) < total
      }
    });

  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reports',
      error: error.message
    });
  }
});

/**
 * GET /api/upload/reports/:id
 * Get specific report with full details
 */
router.get('/reports/:id', isAuthenticated, async (req, res) => {
  try {
    const report = await Report.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    res.json({
      success: true,
      report
    });

  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching report',
      error: error.message
    });
  }
});

/**
 * DELETE /api/upload/reports/:id
 * Delete a report
 */
router.delete('/reports/:id', isAuthenticated, async (req, res) => {
  try {
    const report = await Report.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting report',
      error: error.message
    });
  }
});

// ============================================================================
// COMPARISON ROUTES
// ============================================================================

/**
 * POST /api/upload/compare
 * Compare multiple reports or recalculate with different rate type
 */
router.post('/compare', isAuthenticated, async (req, res) => {
  try {
    const { reportId, newRateType } = req.body;

    if (!reportId || !newRateType) {
      return res.status(400).json({
        success: false,
        message: 'Report ID and new rate type required'
      });
    }

    const report = await Report.findOne({
      _id: reportId,
      userId: req.user._id
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Recalculate with new rate type
    // This would require storing raw shipment data or re-upload
    // For now, return comparison of saved rates

    res.json({
      success: true,
      message: 'Comparison feature - store raw data for recalculation',
      originalRateType: report.rateType,
      newRateType,
      note: 'To enable full recalculation, store raw shipment data in Report model'
    });

  } catch (error) {
    console.error('Error comparing rates:', error);
    res.status(500).json({
      success: false,
      message: 'Error comparing rates',
      error: error.message
    });
  }
});

export default router;
