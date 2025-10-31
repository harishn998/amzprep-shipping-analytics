// ============================================================================
// RATE MANAGEMENT API ROUTES (ES MODULE VERSION)
// File: backend/routes/rates.js
// ============================================================================

import express from 'express';
//import AmazonRate from '../models/AmazonRate.js';
import AmazonRateEnhanced from '../models/AmazonRateEnhanced.js';
import ShopifyRate from '../models/ShopifyRate.js';

const router = express.Router();

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

// ============================================================================
// AMAZON RATE ROUTES
// ============================================================================

/**
 * GET /api/rates/amazon
 * Get all Amazon rate types with their active rates
 */
router.get('/amazon', async (req, res) => {
  try {
    const rateTypes = ['prep', 'middleMile', 'fbaShipment'];
    const rates = {};

    for (const rateType of rateTypes) {
      rates[rateType] = await AmazonRateEnhanced.getActiveRate(rateType);
    }

    res.json({
      success: true,
      rates,
      availableTypes: rateTypes
    });
  } catch (error) {
    console.error('Error fetching Amazon rates:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching Amazon rates',
      error: error.message
    });
  }
});

/**
 * GET /api/rates/amazon/:rateType
 * Get active rate for specific Amazon rate type
 */
router.get('/amazon/:rateType', async (req, res) => {
  try {
    const { rateType } = req.params;

    if (!['prep', 'middleMile', 'fbaShipment'].includes(rateType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rate type'
      });
    }

    const rate = await AmazonRate.getActiveRate(rateType);

    if (!rate) {
      return res.status(404).json({
        success: false,
        message: `No active rate found for ${rateType}`
      });
    }

    res.json({
      success: true,
      rate
    });
  } catch (error) {
    console.error('Error fetching Amazon rate:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching Amazon rate',
      error: error.message
    });
  }
});

/**
 * GET /api/rates/amazon/:rateType/history
 * Get rate history for specific Amazon rate type (Admin only)
 */
router.get('/amazon/:rateType/history', isAdmin, async (req, res) => {
  try {
    const { rateType } = req.params;

    if (!['prep', 'middleMile', 'fbaShipment'].includes(rateType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rate type'
      });
    }

    const history = await AmazonRate.getRateHistory(rateType);

    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('Error fetching Amazon rate history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching rate history',
      error: error.message
    });
  }
});

/**
 * POST /api/rates/amazon
 * Create new Amazon rate configuration (Admin only)
 */
router.post('/amazon', isAdmin, async (req, res) => {
  try {
    const { rateType, rateName, description, rateDetails, effectiveDate, notes } = req.body;

    // Validate required fields
    if (!rateType || !rateName || !rateDetails) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate rate type
    if (!['prep', 'middleMile', 'fbaShipment'].includes(rateType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rate type'
      });
    }

    // Validate rate details structure
    if (!rateDetails.zones || !Array.isArray(rateDetails.zones) || rateDetails.zones.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rate details must include zones array'
      });
    }

    if (!rateDetails.weightBrackets || !Array.isArray(rateDetails.weightBrackets) || rateDetails.weightBrackets.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rate details must include weightBrackets array'
      });
    }

    // Create new rate
    const newRate = new AmazonRate({
      rateType,
      rateName,
      description: description || '',
      rateDetails,
      effectiveDate: effectiveDate || new Date(),
      isActive: true,
      createdBy: req.user._id,
      notes: notes || ''
    });

    await newRate.save();

    res.status(201).json({
      success: true,
      message: 'Amazon rate created successfully',
      rate: newRate
    });
  } catch (error) {
    console.error('Error creating Amazon rate:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating Amazon rate',
      error: error.message
    });
  }
});

/**
 * PUT /api/rates/amazon/:id
 * Update existing Amazon rate (Admin only)
 */
router.put('/amazon/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow updating rateType
    delete updates.rateType;

    // Set updatedBy
    updates.updatedBy = req.user._id;

    const rate = await AmazonRate.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    if (!rate) {
      return res.status(404).json({
        success: false,
        message: 'Rate not found'
      });
    }

    res.json({
      success: true,
      message: 'Amazon rate updated successfully',
      rate
    });
  } catch (error) {
    console.error('Error updating Amazon rate:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating Amazon rate',
      error: error.message
    });
  }
});

/**
 * DELETE /api/rates/amazon/:id
 * Deactivate Amazon rate (Admin only)
 */
router.delete('/amazon/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const rate = await AmazonRate.findByIdAndUpdate(
      id,
      { isActive: false, updatedBy: req.user._id },
      { new: true }
    );

    if (!rate) {
      return res.status(404).json({
        success: false,
        message: 'Rate not found'
      });
    }

    res.json({
      success: true,
      message: 'Amazon rate deactivated successfully',
      rate
    });
  } catch (error) {
    console.error('Error deactivating Amazon rate:', error);
    res.status(500).json({
      success: false,
      message: 'Error deactivating Amazon rate',
      error: error.message
    });
  }
});

// ============================================================================
// SHOPIFY RATE ROUTES
// ============================================================================

/**
 * GET /api/rates/shopify
 * Get all Shopify rate types with their active rates
 */
router.get('/shopify', async (req, res) => {
  try {
    const rateTypes = ['orderUpdate', 'productUpdate'];
    const rates = {};

    for (const rateType of rateTypes) {
      rates[rateType] = await ShopifyRate.getActiveRate(rateType);
    }

    res.json({
      success: true,
      rates,
      availableTypes: rateTypes
    });
  } catch (error) {
    console.error('Error fetching Shopify rates:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching Shopify rates',
      error: error.message
    });
  }
});

/**
 * GET /api/rates/shopify/:rateType
 * Get active rate for specific Shopify rate type
 */
router.get('/shopify/:rateType', async (req, res) => {
  try {
    const { rateType } = req.params;

    if (!['orderUpdate', 'productUpdate'].includes(rateType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rate type'
      });
    }

    const rate = await ShopifyRate.getActiveRate(rateType);

    if (!rate) {
      return res.status(404).json({
        success: false,
        message: `No active rate found for ${rateType}`
      });
    }

    res.json({
      success: true,
      rate
    });
  } catch (error) {
    console.error('Error fetching Shopify rate:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching Shopify rate',
      error: error.message
    });
  }
});

/**
 * GET /api/rates/shopify/:rateType/history
 * Get rate history for specific Shopify rate type (Admin only)
 */
router.get('/shopify/:rateType/history', isAdmin, async (req, res) => {
  try {
    const { rateType } = req.params;

    if (!['orderUpdate', 'productUpdate'].includes(rateType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rate type'
      });
    }

    const history = await ShopifyRate.getRateHistory(rateType);

    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('Error fetching Shopify rate history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching rate history',
      error: error.message
    });
  }
});

/**
 * POST /api/rates/shopify
 * Create new Shopify rate configuration (Admin only)
 */
router.post('/shopify', isAdmin, async (req, res) => {
  try {
    const { rateType, rateName, description, rateDetails, effectiveDate, notes } = req.body;

    // Validate required fields
    if (!rateType || !rateName || !rateDetails) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate rate type
    if (!['orderUpdate', 'productUpdate'].includes(rateType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rate type'
      });
    }

    // Validate rate details structure
    if (!rateDetails.zones || !Array.isArray(rateDetails.zones) || rateDetails.zones.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rate details must include zones array'
      });
    }

    if (!rateDetails.weightBrackets || !Array.isArray(rateDetails.weightBrackets) || rateDetails.weightBrackets.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rate details must include weightBrackets array'
      });
    }

    // Create new rate
    const newRate = new ShopifyRate({
      rateType,
      rateName,
      description: description || '',
      rateDetails,
      effectiveDate: effectiveDate || new Date(),
      isActive: true,
      createdBy: req.user._id,
      notes: notes || ''
    });

    await newRate.save();

    res.status(201).json({
      success: true,
      message: 'Shopify rate created successfully',
      rate: newRate
    });
  } catch (error) {
    console.error('Error creating Shopify rate:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating Shopify rate',
      error: error.message
    });
  }
});

/**
 * PUT /api/rates/shopify/:id
 * Update existing Shopify rate (Admin only)
 */
router.put('/shopify/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow updating rateType
    delete updates.rateType;

    // Set updatedBy
    updates.updatedBy = req.user._id;

    const rate = await ShopifyRate.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    if (!rate) {
      return res.status(404).json({
        success: false,
        message: 'Rate not found'
      });
    }

    res.json({
      success: true,
      message: 'Shopify rate updated successfully',
      rate
    });
  } catch (error) {
    console.error('Error updating Shopify rate:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating Shopify rate',
      error: error.message
    });
  }
});

/**
 * DELETE /api/rates/shopify/:id
 * Deactivate Shopify rate (Admin only)
 */
router.delete('/shopify/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const rate = await ShopifyRate.findByIdAndUpdate(
      id,
      { isActive: false, updatedBy: req.user._id },
      { new: true }
    );

    if (!rate) {
      return res.status(404).json({
        success: false,
        message: 'Rate not found'
      });
    }

    res.json({
      success: true,
      message: 'Shopify rate deactivated successfully',
      rate
    });
  } catch (error) {
    console.error('Error deactivating Shopify rate:', error);
    res.status(500).json({
      success: false,
      message: 'Error deactivating Shopify rate',
      error: error.message
    });
  }
});

// ============================================================================
// UTILITY ROUTES
// ============================================================================

/**
 * POST /api/rates/calculate
 * Calculate shipping cost using specified rate
 */
router.post('/calculate', async (req, res) => {
  try {
    const { platform, rateType, zone, weight, serviceType } = req.body;

    if (!platform || !rateType || !zone || !weight) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    let rate;
    if (platform === 'amazon') {
      rate = await AmazonRate.getActiveRate(rateType);
    } else if (platform === 'shopify') {
      rate = await ShopifyRate.getActiveRate(rateType);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid platform'
      });
    }

    if (!rate) {
      return res.status(404).json({
        success: false,
        message: `No active rate found for ${platform} ${rateType}`
      });
    }

    const calculation = rate.calculateCost(zone, weight, serviceType);

    res.json({
      success: true,
      calculation,
      rateUsed: {
        id: rate._id,
        name: rate.rateName,
        version: rate.version
      }
    });
  } catch (error) {
    console.error('Error calculating cost:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating cost',
      error: error.message
    });
  }
});

export default router;
