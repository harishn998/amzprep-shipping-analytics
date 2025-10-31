// ============================================================================
// ENHANCED AMAZON RATE MODEL - Supports Prep, Middle-Mile, FBA
// File: backend/models/AmazonRateEnhanced.js
// ============================================================================

import mongoose from 'mongoose';

// ============================================================================
// SUB-SCHEMAS FOR DIFFERENT COST COMPONENTS
// ============================================================================

// Standard zone-based shipping (for FBA shipments)
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

// Prep cost structure
const prepCostSchema = new mongoose.Schema({
  costType: {
    type: String,
    enum: ['perUnit', 'perSKU', 'perPallet', 'perCubicFoot', 'perPound'],
    required: true
  },
  baseCost: {
    type: Number,
    required: true,
    min: 0
  },
  additionalCost: {
    type: Number,
    default: 0,
    min: 0
  },
  minCharge: {
    type: Number,
    default: 0,
    min: 0
  },
  description: {
    type: String,
    default: ''
  }
});

// Middle-mile (LTL/FTL) cost structure
const middleMileCostSchema = new mongoose.Schema({
  shipmentType: {
    type: String,
    enum: ['LTL', 'FTL', 'Parcel'],
    required: true
  },
  pricingModel: {
    type: String,
    enum: ['perPallet', 'perCubicFoot', 'perMile', 'perWeight', 'flat'],
    required: true
  },
  baseCost: {
    type: Number,
    required: true,
    min: 0
  },
  perUnitCost: {
    type: Number,
    default: 0,
    min: 0
  },
  fuelSurcharge: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  minCharge: {
    type: Number,
    default: 0,
    min: 0
  },
  transitDays: {
    type: Number,
    required: true,
    min: 1
  },
  destinationZones: [{
    state: String,
    zone: Number,
    costMultiplier: {
      type: Number,
      default: 1.0,
      min: 0
    }
  }]
});

// FBA placement and split shipment fees
const fbaFeeSchema = new mongoose.Schema({
  feeType: {
    type: String,
    enum: ['placementFee', 'splitShipmentFee', 'lowInventoryFee', 'inboundPlacementFee'],
    required: true
  },
  calculationType: {
    type: String,
    enum: ['perShipment', 'perUnit', 'perPallet', 'percentage'],
    required: true
  },
  cost: {
    type: Number,
    required: true,
    min: 0
  },
  applicableConditions: {
    type: String,
    default: ''
  }
});

// Service type multipliers
const serviceTypeSchema = new mongoose.Schema({
  name: {
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

// ============================================================================
// MAIN AMAZON RATE SCHEMA
// ============================================================================

const amazonRateEnhancedSchema = new mongoose.Schema({
  rateType: {
    type: String,
    required: true,
    enum: ['prep', 'middleMile', 'fbaShipment', 'combined'],
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

  // ============================================================================
  // RATE DETAILS - Conditional based on rateType
  // ============================================================================

  rateDetails: {
    // For 'fbaShipment' type - zone-based parcel shipping
    zones: {
      type: [zoneSchema],
      validate: {
        validator: function(zones) {
          if (this.rateType === 'fbaShipment' || this.rateType === 'combined') {
            return zones && zones.length > 0 && zones.length <= 7;
          }
          return true;
        },
        message: 'FBA shipment rates must have between 1 and 7 zones'
      }
    },
    weightBrackets: {
      type: [weightBracketSchema],
      validate: {
        validator: function(brackets) {
          if (this.rateType === 'fbaShipment' || this.rateType === 'combined') {
            return brackets && brackets.length > 0;
          }
          return true;
        },
        message: 'FBA shipment rates must have at least one weight bracket'
      }
    },
    serviceTypes: {
      type: [serviceTypeSchema],
      default: function() {
        if (this.rateType === 'fbaShipment') {
          return [
            { name: 'Ground', costMultiplier: 1.0 },
            { name: '2-Day', costMultiplier: 1.5 },
            { name: 'Overnight', costMultiplier: 2.5 }
          ];
        }
        return [];
      }
    },

    // For 'prep' type - prep and handling costs
    prepCosts: {
      type: [prepCostSchema],
      validate: {
        validator: function(prepCosts) {
          if (this.rateType === 'prep' || this.rateType === 'combined') {
            return prepCosts && prepCosts.length > 0;
          }
          return true;
        },
        message: 'Prep rates must have at least one cost component'
      }
    },

    // For 'middleMile' type - LTL/FTL shipping
    middleMileCosts: {
      type: [middleMileCostSchema],
      validate: {
        validator: function(middleMileCosts) {
          if (this.rateType === 'middleMile' || this.rateType === 'combined') {
            return middleMileCosts && middleMileCosts.length > 0;
          }
          return true;
        },
        message: 'Middle-mile rates must have at least one cost component'
      }
    },

    // FBA-specific fees (placement, split shipment, etc.)
    fbaFees: {
      type: [fbaFeeSchema],
      default: []
    },

    // Markup/discount percentage
    markupPercentage: {
      type: Number,
      default: 0,
      min: -50,
      max: 100
    },

    // Origin warehouse information
    originWarehouse: {
      name: String,
      address: String,
      city: String,
      state: String,
      zip: String,
      region: String
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

// ============================================================================
// INDEXES
// ============================================================================

amazonRateEnhancedSchema.index({ rateType: 1, isActive: 1 });
amazonRateEnhancedSchema.index({ effectiveDate: 1, expiryDate: 1 });
amazonRateEnhancedSchema.index({ createdAt: -1 });

// ============================================================================
// VIRTUALS
// ============================================================================

amazonRateEnhancedSchema.virtual('isValid').get(function() {
  const now = new Date();
  const isEffective = this.effectiveDate <= now;
  const notExpired = !this.expiryDate || this.expiryDate > now;
  return this.isActive && isEffective && notExpired;
});

// ============================================================================
// INSTANCE METHODS
// ============================================================================

// Calculate prep costs
amazonRateEnhancedSchema.methods.calculatePrepCost = function(params) {
  const { units, skus, pallets, cubicFeet, weight } = params;

  if (!this.rateDetails.prepCosts || this.rateDetails.prepCosts.length === 0) {
    throw new Error('No prep costs configured for this rate');
  }

  let totalCost = 0;
  const breakdown = [];

  this.rateDetails.prepCosts.forEach(prepCost => {
    let cost = 0;
    let quantity = 0;

    switch (prepCost.costType) {
      case 'perUnit':
        quantity = units || 0;
        cost = (prepCost.baseCost + prepCost.additionalCost) * quantity;
        break;
      case 'perSKU':
        quantity = skus || 0;
        cost = (prepCost.baseCost + prepCost.additionalCost) * quantity;
        break;
      case 'perPallet':
        quantity = pallets || 0;
        cost = (prepCost.baseCost + prepCost.additionalCost) * quantity;
        break;
      case 'perCubicFoot':
        quantity = cubicFeet || 0;
        cost = (prepCost.baseCost + prepCost.additionalCost) * quantity;
        break;
      case 'perPound':
        quantity = weight || 0;
        cost = (prepCost.baseCost + prepCost.additionalCost) * quantity;
        break;
    }

    // Apply minimum charge if applicable
    if (prepCost.minCharge > 0 && cost < prepCost.minCharge) {
      cost = prepCost.minCharge;
    }

    totalCost += cost;
    breakdown.push({
      type: prepCost.costType,
      description: prepCost.description,
      quantity,
      rate: prepCost.baseCost + prepCost.additionalCost,
      cost: Number(cost.toFixed(2))
    });
  });

  return {
    totalCost: Number(totalCost.toFixed(2)),
    breakdown
  };
};

// Calculate middle-mile costs
amazonRateEnhancedSchema.methods.calculateMiddleMileCost = function(params) {
  const { shipmentType, pallets, cubicFeet, miles, weight, destinationState } = params;

  if (!this.rateDetails.middleMileCosts || this.rateDetails.middleMileCosts.length === 0) {
    throw new Error('No middle-mile costs configured for this rate');
  }

  // Find matching cost structure
  const costConfig = this.rateDetails.middleMileCosts.find(
    mc => mc.shipmentType === shipmentType
  );

  if (!costConfig) {
    throw new Error(`No middle-mile cost found for shipment type: ${shipmentType}`);
  }

  let baseCost = costConfig.baseCost;
  let variableCost = 0;
  let quantity = 0;

  // Calculate based on pricing model
  switch (costConfig.pricingModel) {
    case 'perPallet':
      quantity = pallets || 0;
      variableCost = costConfig.perUnitCost * quantity;
      break;
    case 'perCubicFoot':
      quantity = cubicFeet || 0;
      variableCost = costConfig.perUnitCost * quantity;
      break;
    case 'perMile':
      quantity = miles || 0;
      variableCost = costConfig.perUnitCost * quantity;
      break;
    case 'perWeight':
      quantity = weight || 0;
      variableCost = costConfig.perUnitCost * quantity;
      break;
    case 'flat':
      variableCost = 0;
      break;
  }

  let subtotal = baseCost + variableCost;

  // Apply destination zone multiplier if applicable
  if (destinationState && costConfig.destinationZones) {
    const zoneConfig = costConfig.destinationZones.find(
      dz => dz.state === destinationState
    );
    if (zoneConfig) {
      subtotal *= zoneConfig.costMultiplier;
    }
  }

  // Apply fuel surcharge
  const fuelSurcharge = subtotal * costConfig.fuelSurcharge;
  let totalCost = subtotal + fuelSurcharge;

  // Apply minimum charge
  if (costConfig.minCharge > 0 && totalCost < costConfig.minCharge) {
    totalCost = costConfig.minCharge;
  }

  return {
    totalCost: Number(totalCost.toFixed(2)),
    breakdown: {
      baseCost,
      variableCost: Number(variableCost.toFixed(2)),
      fuelSurcharge: Number(fuelSurcharge.toFixed(2)),
      subtotal: Number(subtotal.toFixed(2)),
      pricingModel: costConfig.pricingModel,
      quantity,
      transitDays: costConfig.transitDays
    }
  };
};

// Calculate FBA shipment costs (zone-based)
amazonRateEnhancedSchema.methods.calculateFBAShipmentCost = function(zone, weight, serviceType = 'Ground') {
  if (!this.rateDetails.zones || this.rateDetails.zones.length === 0) {
    throw new Error('No zones configured for FBA shipment');
  }

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

  // Find service type multiplier
  const service = this.rateDetails.serviceTypes.find(st => st.name === serviceType);
  const serviceMultiplier = service ? service.costMultiplier : 1.0;

  // Calculate total cost
  const baseCost = zoneRate.baseCost + (weight * zoneRate.perPoundCost);
  const totalCost = baseCost * weightMultiplier * serviceMultiplier;

  return {
    baseCost,
    weightMultiplier,
    serviceMultiplier,
    totalCost: Number(totalCost.toFixed(2)),
    transitDays: zoneRate.transitDays
  };
};

// Calculate FBA fees
amazonRateEnhancedSchema.methods.calculateFBAFees = function(params) {
  const { shipments, units, pallets, isSplit } = params;

  if (!this.rateDetails.fbaFees || this.rateDetails.fbaFees.length === 0) {
    return {
      totalFees: 0,
      breakdown: []
    };
  }

  let totalFees = 0;
  const breakdown = [];

  this.rateDetails.fbaFees.forEach(fee => {
    // Skip split shipment fee if not applicable
    if (fee.feeType === 'splitShipmentFee' && !isSplit) {
      return;
    }

    let feeCost = 0;
    let quantity = 0;

    switch (fee.calculationType) {
      case 'perShipment':
        quantity = shipments || 0;
        feeCost = fee.cost * quantity;
        break;
      case 'perUnit':
        quantity = units || 0;
        feeCost = fee.cost * quantity;
        break;
      case 'perPallet':
        quantity = pallets || 0;
        feeCost = fee.cost * quantity;
        break;
      case 'percentage':
        // This would need a base amount passed in params
        feeCost = 0;
        break;
    }

    totalFees += feeCost;
    breakdown.push({
      feeType: fee.feeType,
      calculationType: fee.calculationType,
      quantity,
      rate: fee.cost,
      cost: Number(feeCost.toFixed(2))
    });
  });

  return {
    totalFees: Number(totalFees.toFixed(2)),
    breakdown
  };
};

// Comprehensive cost calculation
amazonRateEnhancedSchema.methods.calculateComprehensiveCost = function(params) {
  const result = {
    totalCost: 0,
    components: {}
  };

  // Apply markup
  const applyMarkup = (cost) => {
    if (this.rateDetails.markupPercentage) {
      const markup = cost * (this.rateDetails.markupPercentage / 100);
      return cost + markup;
    }
    return cost;
  };

  // Calculate based on rate type
  if (this.rateType === 'prep' || this.rateType === 'combined') {
    result.components.prep = this.calculatePrepCost(params);
    result.totalCost += result.components.prep.totalCost;
  }

  if (this.rateType === 'middleMile' || this.rateType === 'combined') {
    result.components.middleMile = this.calculateMiddleMileCost(params);
    result.totalCost += result.components.middleMile.totalCost;
  }

  if (this.rateType === 'fbaShipment' || this.rateType === 'combined') {
    if (params.zone && params.weight) {
      result.components.fbaShipment = this.calculateFBAShipmentCost(
        params.zone,
        params.weight,
        params.serviceType
      );
      result.totalCost += result.components.fbaShipment.totalCost;
    }
  }

  // Add FBA fees if applicable
  if (params.shipments || params.isSplit) {
    result.components.fbaFees = this.calculateFBAFees(params);
    result.totalCost += result.components.fbaFees.totalFees;
  }

  // Apply overall markup
  result.totalCostWithMarkup = applyMarkup(result.totalCost);

  return {
    ...result,
    totalCostWithMarkup: Number(result.totalCostWithMarkup.toFixed(2)),
    totalCost: Number(result.totalCost.toFixed(2))
  };
};

// ============================================================================
// STATIC METHODS
// ============================================================================

amazonRateEnhancedSchema.statics.getActiveRate = async function(rateType) {
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

amazonRateEnhancedSchema.statics.getRateHistory = async function(rateType) {
  return await this.find({ rateType })
    .sort({ effectiveDate: -1 })
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');
};

// ============================================================================
// PRE-SAVE HOOKS
// ============================================================================

amazonRateEnhancedSchema.pre('save', function(next) {
  if (this.isModified('rateDetails')) {
    this.version += 1;
  }
  next();
});

amazonRateEnhancedSchema.pre('save', async function(next) {
  if (this.isNew && this.isActive) {
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

const AmazonRateEnhanced = mongoose.model('AmazonRateEnhanced', amazonRateEnhancedSchema);

export default AmazonRateEnhanced;
