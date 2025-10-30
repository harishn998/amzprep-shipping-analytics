// ============================================================================
// SHOPIFY RATE MODEL (ES MODULE VERSION)
// File: backend/models/ShopifyRate.js
// ============================================================================

import mongoose from 'mongoose';

const zoneSchema = new mongoose.Schema({
  zone: {
    type: Number,
    required: true,
    min: 2,
    max: 8
  },
  baseCost: {
    type: Number,
    required: true,
    min: 0
  },
  perPoundCost: {
    type: Number,
    required: true,
    min: 0
  },
  transitDays: {
    type: Number,
    required: true,
    min: 1
  }
});

const weightBracketSchema = new mongoose.Schema({
  minWeight: {
    type: Number,
    required: true,
    min: 0
  },
  maxWeight: {
    type: Number,
    required: true
  },
  multiplier: {
    type: Number,
    required: true,
    min: 0,
    max: 2
  }
});

const orderTypeSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true
  },
  costMultiplier: {
    type: Number,
    required: true,
    min: 0,
    max: 5
  }
});

const shopifyRateSchema = new mongoose.Schema({
  rateType: {
    type: String,
    required: true,
    enum: ['orderUpdate', 'productUpdate'],
    index: true
  },
  rateName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  rateDetails: {
    zones: {
      type: [zoneSchema],
      required: true,
      validate: {
        validator: function(zones) {
          return zones.length > 0 && zones.length <= 7;
        },
        message: 'Must have between 1 and 7 zones'
      }
    },
    weightBrackets: {
      type: [weightBracketSchema],
      required: true,
      validate: {
        validator: function(brackets) {
          return brackets.length > 0;
        },
        message: 'Must have at least one weight bracket'
      }
    },
    orderTypes: {
      type: [orderTypeSchema],
      required: true,
      default: [
        { type: 'Standard', costMultiplier: 1.0 },
        { type: 'Express', costMultiplier: 1.4 },
        { type: 'Priority', costMultiplier: 1.8 }
      ]
    }
  },
  effectiveDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  expiryDate: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    required: true,
    default: true,
    index: true
  },
  version: {
    type: Number,
    required: true,
    default: 1
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
shopifyRateSchema.index({ rateType: 1, isActive: 1 });
shopifyRateSchema.index({ effectiveDate: 1, expiryDate: 1 });
shopifyRateSchema.index({ createdAt: -1 });

// Virtual for checking if rate is currently valid
shopifyRateSchema.virtual('isValid').get(function() {
  const now = new Date();
  const isEffective = this.effectiveDate <= now;
  const notExpired = !this.expiryDate || this.expiryDate > now;
  return this.isActive && isEffective && notExpired;
});

// Method to calculate cost based on rate details
shopifyRateSchema.methods.calculateCost = function(zone, weight, orderType = 'Standard') {
  // Find zone rate
  const zoneRate = this.rateDetails.zones.find(z => z.zone === zone);
  if (!zoneRate) {
    throw new Error(`Zone ${zone} not found in rate configuration`);
  }

  // Find weight bracket multiplier
  const weightBracket = this.rateDetails.weightBrackets.find(
    wb => weight >= wb.minWeight && weight < wb.maxWeight
  );
  const weightMultiplier = weightBracket ? weightBracket.multiplier : 1.0;

  // Find order type multiplier
  const order = this.rateDetails.orderTypes.find(ot => ot.type === orderType);
  const orderMultiplier = order ? order.costMultiplier : 1.0;

  // Calculate total cost
  const baseCost = zoneRate.baseCost + (weight * zoneRate.perPoundCost);
  const totalCost = baseCost * weightMultiplier * orderMultiplier;

  return {
    baseCost,
    weightMultiplier,
    orderMultiplier,
    totalCost: Number(totalCost.toFixed(2)),
    transitDays: zoneRate.transitDays
  };
};

// Static method to get active rate for a type
shopifyRateSchema.statics.getActiveRate = async function(rateType) {
  const now = new Date();
  return await this.findOne({
    rateType,
    isActive: true,
    effectiveDate: { $lte: now },
    $or: [
      { expiryDate: null },
      { expiryDate: { $gt: now } }
    ]
  }).sort({ effectiveDate: -1 });
};

// Static method to get rate history
shopifyRateSchema.statics.getRateHistory = async function(rateType) {
  return await this.find({ rateType })
    .sort({ effectiveDate: -1 })
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');
};

// Pre-save hook to increment version
shopifyRateSchema.pre('save', function(next) {
  if (this.isModified('rateDetails')) {
    this.version += 1;
  }
  next();
});

// Pre-save hook to deactivate previous versions
shopifyRateSchema.pre('save', async function(next) {
  if (this.isNew && this.isActive) {
    // Deactivate all previous active rates of same type
    await this.constructor.updateMany(
      {
        _id: { $ne: this._id },
        rateType: this.rateType,
        isActive: true
      },
      {
        $set: { isActive: false }
      }
    );
  }
  next();
});

const ShopifyRate = mongoose.model('ShopifyRate', shopifyRateSchema);

export default ShopifyRate;
