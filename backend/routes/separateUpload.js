// ============================================================================
// SEPARATE UPLOAD ROUTES - Handle tab-by-tab uploads (AUTH REQUIRED)
// File: backend/routes/separateUpload.js
// ============================================================================

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import Report from '../models/Report.js';
import {
  createNewSession,
  getSession,
  updateSessionTab,
  updateSessionConfig,
  isSessionReady,
  getSessionStatus,
  cleanupSession
} from '../utils/sessionManager.js';
import {
  validateDataTab,
  validatePlacementTab,
  validateStorageTab
} from '../utils/tabValidator.js';
import { mergeExcelTabs } from '../utils/excelMerger.js';

const router = express.Router();

function extractBrandFromFilename(filename) {
  if (!filename) return null;

  let name = filename.replace(/\.[^/.]+$/, '');
  name = name.replace(/_/g, ' ');
  name = name.replace(/^copy\s*(of\s*)?/i, '');
  name = name.replace(/[\s-]*[-–]\s*full\s*data\s*analysis$/i, '');
  name = name.replace(/[\s-]*full\s*data\s*analysis$/i, '');
  name = name.replace(/[\s-]*analysis$/i, '');
  name = name.replace(/^[\s-]+|[\s-]+$/g, '');
  name = name.replace(/\s+/g, ' ').trim();

  return name || null;
}

// Multer configuration for tab uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir);
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per tab
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  }
});

/**
 * POST /api/separate-upload
 * Upload individual tab (data, placement, or storage)
 * ✅ REQUIRES AUTHENTICATION
 */
router.post('/separate-upload', upload.single('file'), async (req, res) => {
  try {
    console.log('\n📤 ============ TAB UPLOAD REQUEST ============');

    // ✅ Require authentication for uploads too
    if (!req.user || !req.user.id) {
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path); // Cleanup
      }
      return res.status(401).json({
        error: 'Please log in to upload files.',
        requiresAuth: true
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { tabType, sessionId: existingSessionId } = req.body;
    const userId = req.user.id;  // ✅ Always authenticated

    // Validate tabType
    if (!['data', 'placement', 'storage'].includes(tabType)) {
      fs.unlinkSync(req.file.path); // Cleanup
      return res.status(400).json({
        error: 'Invalid tab type. Must be: data, placement, or storage'
      });
    }

    console.log(`   Tab Type: ${tabType}`);
    console.log(`   File: ${req.file.originalname}`);
    console.log(`   User: ${req.user.email}`);
    console.log(`   Existing Session ID: ${existingSessionId || 'None (will create new)'}`);

    // Get or create session
    let session;
    if (existingSessionId) {
      session = getSession(existingSessionId, userId);
      if (!session) {
        fs.unlinkSync(req.file.path); // Cleanup
        return res.status(404).json({
          error: 'Session not found or expired. Please start over.',
          expired: true
        });
      }
    } else {
      session = createNewSession(userId);
    }

    // Validate tab file
    try {
      let validationResult;

      switch (tabType) {
        case 'data':
          validationResult = validateDataTab(req.file.path);
          break;
        case 'placement':
          validationResult = validatePlacementTab(req.file.path);
          break;
        case 'storage':
          validationResult = validateStorageTab(req.file.path);
          break;
      }

      console.log(`   ✅ Validation passed: ${validationResult.rowCount} rows`);

    } catch (validationError) {
      fs.unlinkSync(req.file.path); // Cleanup invalid file
      return res.status(400).json({
        error: validationError.message,
        tabType
      });
    }

    // Update session with uploaded tab
    updateSessionTab(
      session.sessionId,
      tabType,
      req.file.path,
      req.file.originalname
    );

    // Check if all tabs are ready
    const ready = isSessionReady(session.sessionId);

    // Get list of uploaded tabs
    const status = getSessionStatus(session.sessionId);

    console.log(`   Uploaded Tabs: ${status.uploadedTabs.join(', ')}`);
    console.log(`   All Ready: ${ready ? 'YES ✓' : 'NO ✗'}`);
    console.log('============================================\n');

    res.json({
      success: true,
      sessionId: session.sessionId,
      uploaded: tabType,
      ready,
      filesUploaded: status.uploadedTabs,
      expiresAt: session.expiresAt
    });

  } catch (error) {
    console.error('❌ Tab upload error:', error);

    // Cleanup file on error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {}
    }

    res.status(500).json({ error: 'Error uploading tab: ' + error.message });
  }
});

/**
 * POST /api/separate-analyze
 * Trigger analysis when all tabs are uploaded
 * ✅ REQUIRES AUTHENTICATION
 */
router.post('/separate-analyze', async (req, res) => {
  try {
    console.log('\n🔬 ========== ANALYZE SESSION REQUEST ==========');

    // ✅ Require authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: 'Please log in to analyze your data.',
        requiresAuth: true
      });
    }

    const { sessionId, costConfig, hazmatFilter } = req.body;
    const userId = req.user.id;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // Get session
    const session = getSession(sessionId, userId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found or expired',
        expired: true
      });
    }

    console.log(`   Session ID: ${sessionId}`);
    console.log(`   User: ${req.user.email}`);

    // Check if all tabs uploaded
    if (!isSessionReady(sessionId)) {
      const status = getSessionStatus(sessionId);
      return res.status(400).json({
        error: 'Not all tabs uploaded',
        uploadedTabs: status.uploadedTabs,
        missingTabs: ['data', 'placement', 'storage'].filter(
          tab => !status.uploadedTabs.includes(tab)
        )
      });
    }

    // Update session config if provided
    if (costConfig || hazmatFilter) {
      updateSessionConfig(sessionId, costConfig, hazmatFilter);
    }

    console.log(`   Cost Config: ${JSON.stringify(costConfig || session.costConfig)}`);
    console.log(`   Hazmat Filter: ${hazmatFilter || session.hazmatFilter}`);

    // Merge Excel files
    console.log('   🔄 Merging Excel files...');
    const mergedFilePath = await mergeExcelTabs(
      session.files.data.path,
      session.files.placement.path,
      session.files.storage.path
    );

    console.log(`   ✅ Merged file created: ${path.basename(mergedFilePath)}`);

    // Import functions from server.js
    const serverModule = await import('../server.js');
    const { parseExcelFile, analyzeShipments } = serverModule;

    // Parse merged file
    console.log('   📊 Parsing merged file...');
    const shipments = await parseExcelFile(
      mergedFilePath,
      session.hazmatFilter || hazmatFilter || 'all',
      session.costConfig || costConfig || {}
    );

    console.log(`   ✅ Parsed ${shipments.length} shipment(s)`);

    // Analyze shipments
    console.log('   🔬 Analyzing shipments...');
    const analysis = analyzeShipments(shipments);

    console.log(`   ✅ Analysis complete`);

    // Save report with authenticated user ID
    const report = new Report({
      userId: req.user.id,
      userEmail: req.user.email,
      filename: `Merged-${session.files.data.filename}`,
      uploadDate: new Date(),
      uploadType: 'amazon',
      rateType: 'prep',
      ...analysis,
      costConfig: session.costConfig || costConfig
    });

    await report.save();
    console.log(`   💾 Report saved: ${report._id}`);

    // Cleanup
    console.log('   🧹 Cleaning up...');
    try {
      fs.unlinkSync(mergedFilePath);
      console.log(`   🗑️ Deleted merged file`);
    } catch (err) {
      console.error('   ⚠️ Error deleting merged file:', err.message);
    }

    cleanupSession(sessionId);

    console.log('============================================\n');

    const dataFilename = session.files?.data?.originalname || '';
    const brandName = extractBrandFromFilename(dataFilename);

    res.json({
      success: true,
      data: analysis,
      reportId: report._id.toString(),
      brandName: brandName
    });

  } catch (error) {
    console.error('❌ Analyze session error:', error);
    res.status(500).json({ error: 'Error analyzing session: ' + error.message });
  }
});

/**
 * GET /api/session-status/:sessionId
 * Get status of upload session
 */
router.get('/session-status/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;
    const session = getSession(sessionId, userId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    const status = getSessionStatus(sessionId);

    res.json({
      success: true,
      status
    });

  } catch (error) {
    console.error('Session status error:', error);
    res.status(500).json({ error: 'Error getting session status' });
  }
});

/**
 * DELETE /api/session/:sessionId
 * Cancel/delete upload session
 */
router.delete('/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;
    const session = getSession(sessionId, userId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    cleanupSession(sessionId);

    res.json({
      success: true,
      message: 'Session cancelled and files cleaned up'
    });

  } catch (error) {
    console.error('Cancel session error:', error);
    res.status(500).json({ error: 'Error cancelling session' });
  }
});

export default router;
