// ============================================================================
// PUBLIC FILE ANALYSIS API - Lightweight endpoint for Lead Magnet
// File: backend/routes/publicAnalyze.js
//
// This endpoint ONLY handles file processing.
// HubSpot submission is handled by WordPress (preserves hutk cookie).
// ============================================================================

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { mergeExcelTabs } from '../utils/excelMerger.js';
import SmashFoodsIntegration from '../utils/smashFoodsIntegration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ============================================================================
// RATE LIMITING - Prevent abuse (Fixed for express-rate-limit v7+)
// ============================================================================
const analyzeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per 15 minutes per IP
  message: {
    success: false,
    error: 'Too many requests. Please wait 15 minutes before trying again.',
    code: 'RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false
  }
});

// ============================================================================
// FILE UPLOAD CONFIGURATION
// ============================================================================
const uploadDir = path.join(__dirname, '..', 'uploads', 'public-temp');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedName}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv'
  ];
  const allowedExts = ['.xlsx', '.xls', '.csv'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.originalname}. Only Excel (.xlsx, .xls) and CSV files are allowed.`), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 3
  },
  fileFilter
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function cleanupFiles(...filePaths) {
  filePaths.forEach(filePath => {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted temp file: ${path.basename(filePath)}`);
      } catch (e) {
        console.error(`Failed to delete ${filePath}:`, e.message);
      }
    }
  });
}

/**
 * Calculate scorecard metrics from SmashFoodsIntegration result
 *
 * The analyzeSmashFoodsFile returns a FLAT object with this structure:
 * {
 *   totalShipments, totalUnits, totalPallets, totalCuft, totalWeight,
 *   currentCosts: { totalFreight, totalPlacementFees, totalCost, ... },
 *   proposedCosts: { sop: { mmCost, internalTransferCost, totalFreightCost, ... } },
 *   savings: { amount, percent, currentTotal, proposedTotal },
 *   transitImprovement: { currentTransitDays, amzPrepTransitDays, improvementDays, ... },
 *   shipMethodBreakdown: [...],
 *   ...
 * }
 */
function calculateScorecardMetrics(result) {
  // Log the structure to debug
  console.log('📊 [DEBUG] Extracting scorecard metrics...');
  console.log('   Keys in result:', Object.keys(result));

  // Direct extraction from the flat result object
  const totalShipments = result.totalShipments || 0;
  const totalUnits = result.totalUnits || 0;
  const totalCuft = result.totalCuft || 0;
  const totalPallets = result.totalPallets || 0;

  // Current costs - direct from result.currentCosts
  const currentCosts = result.currentCosts || {};
  const totalPlacementFees = currentCosts.totalPlacementFees || 0;
  const totalFreightCost = currentCosts.totalCost || 0;
  const carrierCost = currentCosts.totalFreight || 0;

  // Savings - direct from result.savings
  const savings = result.savings || {};
  const savingsAmount = savings.amount || 0;
  const savingsPercent = savings.percent || 0;

  // Transit - direct from result.transitImprovement
  const transit = result.transitImprovement || {};
  const currentTransitTime = transit.currentTransitDays || 16;
  const amzPrepTransitTime = transit.amzPrepTransitDays || 3;

  // Ship method breakdown
  const shipMethodBreakdown = result.shipMethodBreakdown || [];

  console.log('   Extracted values:');
  console.log(`     totalShipments: ${totalShipments}`);
  console.log(`     totalUnits: ${totalUnits}`);
  console.log(`     totalCuft: ${totalCuft}`);
  console.log(`     totalPallets: ${totalPallets}`);
  console.log(`     totalPlacementFees: ${totalPlacementFees}`);
  console.log(`     totalFreightCost: ${totalFreightCost}`);
  console.log(`     savingsAmount: ${savingsAmount}`);
  console.log(`     savingsPercent: ${savingsPercent}`);
  console.log(`     currentTransitTime: ${currentTransitTime}`);

  // SPEED SCORE (40 points max)
  let speedScore = 40;
  let speedGrade = 'A';
  if (currentTransitTime > 20) {
    speedScore = 5; speedGrade = 'F';
  } else if (currentTransitTime > 15) {
    speedScore = 10; speedGrade = 'E';
  } else if (currentTransitTime > 10) {
    speedScore = 18; speedGrade = 'D';
  } else if (currentTransitTime > 7) {
    speedScore = 25; speedGrade = 'C';
  } else if (currentTransitTime > 5) {
    speedScore = 32; speedGrade = 'B';
  }

  // COST SCORE (35 points max)
  let costScore = 35;
  let costGrade = 'A';
  const placementFeeRatio = totalFreightCost > 0 ? (totalPlacementFees / totalFreightCost) : 0;

  if (totalPlacementFees > 0 && placementFeeRatio > 0.5) {
    costScore = 5; costGrade = 'F';
  } else if (totalPlacementFees > 0 && placementFeeRatio > 0.3) {
    costScore = 12; costGrade = 'E';
  } else if (totalPlacementFees > 0 && placementFeeRatio > 0.15) {
    costScore = 18; costGrade = 'D';
  } else if (totalPlacementFees > 0) {
    costScore = 25; costGrade = 'C';
  } else if (savingsPercent > 20) {
    costScore = 28; costGrade = 'B';
  }

  // GEO SCORE (25 points max)
  let geoScore = 20;
  let geoGrade = 'B';
  // Could be enhanced with state breakdown analysis

  // TOTAL SCORE & GRADE
  const totalScore = speedScore + costScore + geoScore;

  let overallGrade = 'A';
  let gradeLabel = 'Excellent';
  if (totalScore < 25) {
    overallGrade = 'F'; gradeLabel = 'Critical';
  } else if (totalScore < 40) {
    overallGrade = 'E'; gradeLabel = 'Poor';
  } else if (totalScore < 55) {
    overallGrade = 'D'; gradeLabel = 'Below Average';
  } else if (totalScore < 70) {
    overallGrade = 'C'; gradeLabel = 'Average';
  } else if (totalScore < 85) {
    overallGrade = 'B'; gradeLabel = 'Good';
  }

  return {
    totalScore,
    overallGrade,
    gradeLabel,
    speedMetrics: {
      currentDays: currentTransitTime,
      amzPrepDays: amzPrepTransitTime,
      improvement: Math.max(0, currentTransitTime - amzPrepTransitTime),
      grade: speedGrade
    },
    breakdown: {
      speed: { score: speedScore, max: 40, grade: speedGrade },
      cost: { score: costScore, max: 35, grade: costGrade },
      geo: { score: geoScore, max: 25, grade: geoGrade }
    },
    metrics: {
      totalShipments,
      totalUnits,
      totalCuft: Math.round(totalCuft),
      totalPallets: Math.round(totalPallets * 100) / 100,
      placementFees: Math.round(totalPlacementFees * 100) / 100,
      totalFreightCost: Math.round(totalFreightCost * 100) / 100,
      carrierCost: Math.round(carrierCost * 100) / 100,
      savingsAmount: Math.round(savingsAmount * 100) / 100,
      savingsPercent: Math.round(savingsPercent * 10) / 10,
      totalAnnualOpportunity: Math.round(Math.abs(savingsAmount) + totalPlacementFees)
    },
    shipMethods: Array.isArray(shipMethodBreakdown) ? shipMethodBreakdown.map(m => ({
      method: m.method || m.type || 'Unknown',
      count: m.shipmentCount || m.count || 0,
      percent: totalShipments > 0 ? Math.round(((m.shipmentCount || m.count || 0) / totalShipments) * 100) : 0
    })) : []
  };
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/public/analyze-files
 */
router.post('/analyze-files',
  analyzeRateLimiter,
  upload.fields([
    { name: 'dataFile', maxCount: 1 },
    { name: 'placementFile', maxCount: 1 },
    { name: 'storageFile', maxCount: 1 }
  ]),
  async (req, res) => {
    const startTime = Date.now();
    console.log('📊 [PUBLIC] File analysis request received');

    let dataFilePath = null;
    let placementFilePath = null;
    let storageFilePath = null;
    let mergedFilePath = null;

    try {
      const { dataFile, placementFile, storageFile } = req.files || {};

      if (!dataFile?.[0] || !placementFile?.[0] || !storageFile?.[0]) {
        const missing = [];
        if (!dataFile?.[0]) missing.push('Data');
        if (!placementFile?.[0]) missing.push('Placement');
        if (!storageFile?.[0]) missing.push('Storage');

        cleanupFiles(
          dataFile?.[0]?.path,
          placementFile?.[0]?.path,
          storageFile?.[0]?.path
        );

        return res.status(400).json({
          success: false,
          error: `Missing required files: ${missing.join(', ')}`,
          code: 'MISSING_FILES'
        });
      }

      dataFilePath = dataFile[0].path;
      placementFilePath = placementFile[0].path;
      storageFilePath = storageFile[0].path;

      console.log(`📁 Files received:`);
      console.log(`   Data: ${dataFile[0].originalname} (${(dataFile[0].size / 1024).toFixed(1)} KB)`);
      console.log(`   Placement: ${placementFile[0].originalname} (${(placementFile[0].size / 1024).toFixed(1)} KB)`);
      console.log(`   Storage: ${storageFile[0].originalname} (${(storageFile[0].size / 1024).toFixed(1)} KB)`);

      console.log('🔄 Merging files...');
      mergedFilePath = await mergeExcelTabs(dataFilePath, placementFilePath, storageFilePath);

      console.log('🔄 Processing analysis with SmashFoodsIntegration...');

      // Create instance and call the correct method
      const integration = new SmashFoodsIntegration();

      // Use analyzeSmashFoodsFile method
      // Returns flat object with: totalShipments, totalUnits, currentCosts, savings, etc.
      const analysisResult = await integration.analyzeSmashFoodsFile(
        mergedFilePath,
        'combined',  // rateType
        0.10,        // markup
        'all',       // hazmatFilter
        {}           // config
      );

      if (!analysisResult) {
        throw new Error('Analysis processing failed - no result returned');
      }

      console.log('🎯 Calculating scorecard...');
      const scorecard = calculateScorecardMetrics(analysisResult);

      cleanupFiles(dataFilePath, placementFilePath, storageFilePath, mergedFilePath);

      const processingTime = Date.now() - startTime;
      console.log(`✅ Analysis complete in ${processingTime}ms`);
      console.log(`   Score: ${scorecard.totalScore}/100 (Grade: ${scorecard.overallGrade})`);
      console.log(`   Metrics: Cuft=${scorecard.metrics.totalCuft}, Placement=$${scorecard.metrics.placementFees}, Savings=$${scorecard.metrics.savingsAmount}`);

      res.json({
        success: true,
        scorecard,
        processingTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ [PUBLIC] Analysis error:', error.message);
      console.error('   Stack:', error.stack);

      cleanupFiles(dataFilePath, placementFilePath, storageFilePath, mergedFilePath);

      let userMessage = 'Unable to process your files. Please ensure they are valid Amazon FBA export files.';
      let errorCode = 'PROCESSING_ERROR';

      if (error.message.includes('Missing required')) {
        userMessage = error.message;
        errorCode = 'MISSING_FILES';
      } else if (error.message.includes('Invalid file type')) {
        userMessage = 'Invalid file format. Please upload Excel (.xlsx) or CSV files.';
        errorCode = 'INVALID_FORMAT';
      } else if (error.message.includes('file size')) {
        userMessage = 'File too large. Maximum file size is 25MB.';
        errorCode = 'FILE_TOO_LARGE';
      }

      res.status(500).json({
        success: false,
        error: userMessage,
        code: errorCode
      });
    }
  }
);

/**
 * GET /api/public/health
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'AMZ Prep Lead Magnet API',
    status: 'operational',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * Handle multer errors
 */
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 25MB per file.',
        code: 'FILE_TOO_LARGE'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Please upload exactly 3 files.',
        code: 'TOO_MANY_FILES'
      });
    }
  }

  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      error: error.message,
      code: 'INVALID_FORMAT'
    });
  }

  next(error);
});

export default router;
