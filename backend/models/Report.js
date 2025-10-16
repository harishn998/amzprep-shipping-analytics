import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  // User who created the report
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userEmail: {
    type: String,
    required: true,
    index: true
  },

  // Report metadata
  filename: {
    type: String,
    required: true
  },
  uploadDate: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Analytics data
  totalShipments: {
    type: Number,
    required: true
  },
  avgWeight: {
    type: Number,
    required: true
  },
  avgCost: {
    type: mongoose.Schema.Types.Mixed,  // Can be number or "Not available"
    required: true
  },
  analysisMonths: {
    type: Number,
    required: true
  },

  // Date range
  dateRange: {
    start: String,
    end: String
  },

  // Domestic vs International
  domesticVsInternational: {
    domestic: Number,
    international: Number,
    domesticPercent: String,
    internationalPercent: String
  },

  // Top states
  topStates: [{
    name: String,
    code: String,
    volume: Number,
    percentage: Number,
    avgCost: Number
  }],

  // Warehouse comparison
  warehouseComparison: [{
    name: String,
    fullAddress: String,
    region: String,
    specialty: String,
    costMultiplier: Number,
    avgZone: Number,
    transitTime: Number,
    cost: Number,
    savings: Number,
    savingsPercent: String,
    shipments: Number,
    recommended: Boolean
  }],

  // Shipping methods
  shippingMethods: [{
    name: String,
    count: Number,
    percentage: Number
  }],

  // Weight distribution
  weightDistribution: [{
    range: String,
    count: Number
  }],

  // Zone distribution
  zoneDistribution: [{
    zone: Number,
    count: Number,
    percentage: String
  }]
}, {
  timestamps: true  // Automatically adds createdAt and updatedAt
});

// Indexes for efficient queries
reportSchema.index({ userId: 1, uploadDate: -1 });
reportSchema.index({ userEmail: 1, uploadDate: -1 });
reportSchema.index({ uploadDate: -1 });

// Method to get report summary (lightweight)
reportSchema.methods.getSummary = function() {
  return {
    id: this._id,
    filename: this.filename,
    uploadDate: this.uploadDate,
    totalShipments: this.totalShipments,
    avgCost: this.avgCost,
    analysisMonths: this.analysisMonths
  };
};

const Report = mongoose.model('Report', reportSchema);

export default Report;
