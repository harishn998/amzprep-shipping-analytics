// ============================================================================
// DATA SEEDING SCRIPT FOR AMAZON RATES
// File: backend/seeders/seedAmazonRates.js
// ============================================================================

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AmazonRateEnhanced from '../models/AmazonRateEnhanced.js';
import User from '../models/User.js';

dotenv.config();

// ============================================================================
// SAMPLE RATE DATA BASED ON SMASH FOODS ANALYSIS
// ============================================================================

const seedRates = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get or create admin user for createdBy
    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('No admin user found. Please create one first.');
      process.exit(1);
    }

    // Clear existing rates (optional - comment out if you want to keep existing data)
    // await AmazonRateEnhanced.deleteMany({});
    // console.log('Cleared existing rates');

    // ============================================================================
    // 1. PREP RATE - Based on AMZ Prep assumptions
    // ============================================================================

    const prepRate = new AmazonRateEnhanced({
      rateType: 'prep',
      rateName: 'AMZ Prep Standard Rate 2025',
      description: 'Standard prep and handling rates for FBA shipments. Includes receiving, inspection, labeling, and prep work.',
      rateDetails: {
        prepCosts: [
          {
            costType: 'perUnit',
            baseCost: 0.50,
            additionalCost: 0.10,
            minCharge: 25.00,
            description: 'Standard unit prep (receiving, inspection, basic labeling)'
          },
          {
            costType: 'perSKU',
            baseCost: 5.00,
            additionalCost: 0.00,
            minCharge: 0,
            description: 'Per SKU handling fee'
          },
          {
            costType: 'perPallet',
            baseCost: 15.00,
            additionalCost: 0.00,
            minCharge: 0,
            description: 'Pallet handling and breakdown'
          }
        ],
        markupPercentage: 10,
        originWarehouse: {
          name: 'AMZ Prep Fulfillment Center',
          address: '123 Logistics Way',
          city: 'Columbus',
          state: 'OH',
          zip: '43215',
          region: 'Midwest'
        }
      },
      effectiveDate: new Date('2025-01-01'),
      isActive: true,
      createdBy: adminUser._id,
      notes: 'Competitive prep rates with 5-7 day processing time'
    });

    await prepRate.save();
    console.log('✓ Prep rate seeded');

    // ============================================================================
    // 2. MIDDLE-MILE RATE - LTL/FTL from warehouse to FBA
    // ============================================================================

    const middleMileRate = new AmazonRateEnhanced({
      rateType: 'middleMile',
      rateName: 'AMZ Prep LTL/FTL Rate 2025',
      description: 'Middle-mile shipping from prep center to Amazon FBA warehouses. Significantly faster than standard LTL (5-7 days vs 28 days).',
      rateDetails: {
        middleMileCosts: [
          {
            shipmentType: 'LTL',
            pricingModel: 'perPallet',
            baseCost: 150.00,
            perUnitCost: 56.00, // $56 per pallet as per Smash Foods analysis
            fuelSurcharge: 0.15, // 15% fuel surcharge
            minCharge: 250.00,
            transitDays: 6, // Average 5-7 days
            destinationZones: [
              { state: 'FL', zone: 7, costMultiplier: 1.2 },
              { state: 'MI', zone: 4, costMultiplier: 1.0 },
              { state: 'GA', zone: 6, costMultiplier: 1.15 },
              { state: 'TX', zone: 5, costMultiplier: 1.1 },
              { state: 'CA', zone: 8, costMultiplier: 1.3 },
              { state: 'NY', zone: 5, costMultiplier: 1.1 },
              { state: 'IL', zone: 3, costMultiplier: 0.9 }
            ]
          },
          {
            shipmentType: 'FTL',
            pricingModel: 'flat',
            baseCost: 1500.00,
            perUnitCost: 0,
            fuelSurcharge: 0.15,
            minCharge: 1500.00,
            transitDays: 5,
            destinationZones: [
              { state: 'FL', zone: 7, costMultiplier: 1.2 },
              { state: 'MI', zone: 4, costMultiplier: 1.0 },
              { state: 'GA', zone: 6, costMultiplier: 1.15 },
              { state: 'TX', zone: 5, costMultiplier: 1.1 },
              { state: 'CA', zone: 8, costMultiplier: 1.3 }
            ]
          },
          {
            shipmentType: 'Parcel',
            pricingModel: 'perWeight',
            baseCost: 25.00,
            perUnitCost: 0.75,
            fuelSurcharge: 0.12,
            minCharge: 50.00,
            transitDays: 4,
            destinationZones: []
          }
        ],
        markupPercentage: 10,
        originWarehouse: {
          name: 'AMZ Prep Fulfillment Center',
          address: '123 Logistics Way',
          city: 'Columbus',
          state: 'OH',
          zip: '43215',
          region: 'Midwest'
        }
      },
      effectiveDate: new Date('2025-01-01'),
      isActive: true,
      createdBy: adminUser._id,
      notes: 'Optimized middle-mile with 5-7 day transit vs industry standard 28 days'
    });

    await middleMileRate.save();
    console.log('✓ Middle-mile rate seeded');

    // ============================================================================
    // 3. FBA SHIPMENT RATE - Zone-based parcel shipping
    // ============================================================================

    const fbaShipmentRate = new AmazonRateEnhanced({
      rateType: 'fbaShipment',
      rateName: 'Amazon FBA Standard Shipping 2025',
      description: 'Zone-based shipping rates for FBA inbound shipments',
      rateDetails: {
        zones: [
          { zone: 2, baseCost: 5.50, perPoundCost: 0.35, transitDays: 2 },
          { zone: 3, baseCost: 6.00, perPoundCost: 0.40, transitDays: 3 },
          { zone: 4, baseCost: 6.50, perPoundCost: 0.45, transitDays: 4 },
          { zone: 5, baseCost: 7.00, perPoundCost: 0.50, transitDays: 5 },
          { zone: 6, baseCost: 7.50, perPoundCost: 0.55, transitDays: 6 },
          { zone: 7, baseCost: 8.00, perPoundCost: 0.60, transitDays: 7 },
          { zone: 8, baseCost: 9.00, perPoundCost: 0.70, transitDays: 8 }
        ],
        weightBrackets: [
          { minWeight: 0, maxWeight: 1, multiplier: 1.0 },
          { minWeight: 1, maxWeight: 5, multiplier: 0.95 },
          { minWeight: 5, maxWeight: 10, multiplier: 0.90 },
          { minWeight: 10, maxWeight: 20, multiplier: 0.85 },
          { minWeight: 20, maxWeight: 50, multiplier: 0.80 },
          { minWeight: 50, maxWeight: 999999, multiplier: 0.75 }
        ],
        serviceTypes: [
          { name: 'Ground', costMultiplier: 1.0 },
          { name: '2-Day', costMultiplier: 1.5 },
          { name: 'Overnight', costMultiplier: 2.5 }
        ],
        fbaFees: [
          {
            feeType: 'placementFee',
            calculationType: 'perUnit',
            cost: 0.52,
            applicableConditions: 'Applied to all units in split shipments'
          },
          {
            feeType: 'splitShipmentFee',
            calculationType: 'perShipment',
            cost: 150.00,
            applicableConditions: 'When shipment is split to multiple FBA centers'
          },
          {
            feeType: 'inboundPlacementFee',
            calculationType: 'perPallet',
            cost: 35.00,
            applicableConditions: 'Per pallet placement service fee'
          }
        ],
        markupPercentage: 0
      },
      effectiveDate: new Date('2025-01-01'),
      isActive: true,
      createdBy: adminUser._id,
      notes: 'Standard FBA inbound shipping rates with placement fees'
    });

    await fbaShipmentRate.save();
    console.log('✓ FBA shipment rate seeded');

    // ============================================================================
    // 4. COMBINED RATE - Full service (Prep + Middle-Mile + FBA)
    // ============================================================================

    const combinedRate = new AmazonRateEnhanced({
      rateType: 'combined',
      rateName: 'AMZ Prep Complete Solution 2025',
      description: 'All-inclusive rate: prep, middle-mile transport, and FBA delivery. One-stop solution with optimized workflow.',
      rateDetails: {
        // Prep costs
        prepCosts: [
          {
            costType: 'perUnit',
            baseCost: 0.45,
            additionalCost: 0.10,
            minCharge: 25.00,
            description: 'Standard unit prep (bundled discount)'
          },
          {
            costType: 'perSKU',
            baseCost: 4.50,
            additionalCost: 0.00,
            minCharge: 0,
            description: 'Per SKU handling fee (bundled)'
          }
        ],

        // Middle-mile costs
        middleMileCosts: [
          {
            shipmentType: 'LTL',
            pricingModel: 'perPallet',
            baseCost: 125.00,
            perUnitCost: 50.00, // Discounted from $56
            fuelSurcharge: 0.15,
            minCharge: 225.00,
            transitDays: 6,
            destinationZones: [
              { state: 'FL', zone: 7, costMultiplier: 1.2 },
              { state: 'MI', zone: 4, costMultiplier: 1.0 },
              { state: 'GA', zone: 6, costMultiplier: 1.15 }
            ]
          }
        ],

        // FBA shipment (parcel)
        zones: [
          { zone: 2, baseCost: 5.25, perPoundCost: 0.33, transitDays: 2 },
          { zone: 3, baseCost: 5.75, perPoundCost: 0.38, transitDays: 3 },
          { zone: 4, baseCost: 6.25, perPoundCost: 0.43, transitDays: 4 },
          { zone: 5, baseCost: 6.75, perPoundCost: 0.48, transitDays: 5 },
          { zone: 6, baseCost: 7.25, perPoundCost: 0.53, transitDays: 6 },
          { zone: 7, baseCost: 7.75, perPoundCost: 0.58, transitDays: 7 },
          { zone: 8, baseCost: 8.75, perPoundCost: 0.68, transitDays: 8 }
        ],
        weightBrackets: [
          { minWeight: 0, maxWeight: 1, multiplier: 1.0 },
          { minWeight: 1, maxWeight: 5, multiplier: 0.95 },
          { minWeight: 5, maxWeight: 10, multiplier: 0.90 },
          { minWeight: 10, maxWeight: 20, multiplier: 0.85 },
          { minWeight: 20, maxWeight: 50, multiplier: 0.80 },
          { minWeight: 50, maxWeight: 999999, multiplier: 0.75 }
        ],
        serviceTypes: [
          { name: 'Ground', costMultiplier: 1.0 },
          { name: '2-Day', costMultiplier: 1.5 }
        ],

        // FBA fees
        fbaFees: [
          {
            feeType: 'placementFee',
            calculationType: 'perUnit',
            cost: 0.52,
            applicableConditions: 'Applied to all units in split shipments'
          }
        ],

        markupPercentage: 8, // Slight discount for bundled services

        originWarehouse: {
          name: 'AMZ Prep Fulfillment Center',
          address: '123 Logistics Way',
          city: 'Columbus',
          state: 'OH',
          zip: '43215',
          region: 'Midwest'
        }
      },
      effectiveDate: new Date('2025-01-01'),
      isActive: true,
      createdBy: adminUser._id,
      notes: 'Complete solution with bundled discount. Faster processing and transit (5-7 days total vs 28+ days competitor)'
    });

    await combinedRate.save();
    console.log('✓ Combined rate seeded');

    // ============================================================================
    // 5. COMPETITOR RATE - Based on Smash Foods current provider
    // ============================================================================

    const competitorRate = new AmazonRateEnhanced({
      rateType: 'middleMile',
      rateName: 'Trestle Fulfillment LTL Rate 2025 (Competitor)',
      description: 'Current competitor rate from Trestle Fulfillment - Bloomingdale, IL. Longer transit times (28 days average).',
      rateDetails: {
        middleMileCosts: [
          {
            shipmentType: 'LTL',
            pricingModel: 'perCubicFoot',
            baseCost: 0,
            perUnitCost: 2.71, // Current rate: $2.71/cuft
            fuelSurcharge: 0.18,
            minCharge: 200.00,
            transitDays: 28, // Much longer transit
            destinationZones: [
              { state: 'FL', zone: 7, costMultiplier: 1.3 }, // 36 days to FL
              { state: 'MI', zone: 4, costMultiplier: 1.0 },
              { state: 'GA', zone: 6, costMultiplier: 1.1 } // 29 days to GA
            ]
          }
        ],
        markupPercentage: 0,
        originWarehouse: {
          name: 'Trestle Fulfillment',
          address: 'Address not specified',
          city: 'Bloomingdale',
          state: 'IL',
          zip: '60108',
          region: 'Midwest'
        }
      },
      effectiveDate: new Date('2025-01-01'),
      isActive: true,
      createdBy: adminUser._id,
      notes: 'Reference competitor rate. Lower per-unit cost but much longer transit (28 days vs 5-7). Significant prep delays.'
    });

    await competitorRate.save();
    console.log('✓ Competitor rate seeded');

    console.log('\n=================================');
    console.log('✓ All rates seeded successfully!');
    console.log('=================================\n');

    // Display summary
    const allRates = await AmazonRateEnhanced.find({ isActive: true });
    console.log('Active rates in database:');
    allRates.forEach(rate => {
      console.log(`  - ${rate.rateName} (${rate.rateType})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

// ============================================================================
// RUN SEEDER
// ============================================================================

seedRates();
