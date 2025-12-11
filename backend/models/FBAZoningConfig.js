// ============================================================================
// FBA ZONING CONFIG MODEL
// File: backend/models/FBAZoningConfig.js
// ============================================================================

import mongoose from 'mongoose';

const fbaZoningConfigSchema = new mongoose.Schema({
  // Version identifier (e.g., "v1.2", "2024-Q1")
  version: {
    type: String,
    required: true,
    unique: true
  },

  // Effective date of this zoning configuration
  effectiveDate: {
    type: Date,
    required: true,
    default: Date.now
  },

  // The actual FBA Zoning data (array of objects)
  // Example: [{ Destination: 'ABE3', Zone: 'PHL', State: 'PA', Region: 'East' }, ...]
  zoningData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // Is this the currently active configuration?
  isActive: {
    type: Boolean,
    default: false,
    index: true
  },

  // Who created/uploaded this configuration
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Metadata
  description: {
    type: String,
    default: ''
  },

  // Row count (for quick reference)
  rowCount: {
    type: Number,
    default: 0
  }

}, {
  timestamps: true  // Adds createdAt and updatedAt
});

// Indexes
fbaZoningConfigSchema.index({ isActive: 1, effectiveDate: -1 });
fbaZoningConfigSchema.index({ version: 1 });

// Static method to get active zoning
fbaZoningConfigSchema.statics.getActiveZoning = async function() {
  return this.findOne({ isActive: true });
};

// Instance method to activate this version
fbaZoningConfigSchema.methods.activate = async function() {
  // Deactivate all other versions
  await this.constructor.updateMany({}, { isActive: false });

  // Activate this version
  this.isActive = true;
  await this.save();

  console.log(`✅ Activated FBA Zoning version: ${this.version}`);
};

const FBAZoningConfig = mongoose.model('FBAZoningConfig', fbaZoningConfigSchema);

export default FBAZoningConfig;
