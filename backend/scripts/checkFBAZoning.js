// ============================================================================
// CHECK FBA ZONING IN DATABASE
// File: backend/scripts/checkFBAZoning.js
// Usage: node scripts/checkFBAZoning.js
// ============================================================================

import mongoose from 'mongoose';
import FBAZoningConfig from '../models/FBAZoningConfig.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkFBAZoning() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    console.log('');

    // Check if any FBA Zoning configs exist
    const allConfigs = await FBAZoningConfig.find();

    console.log('📊 ========================================');
    console.log('   FBA ZONING DATABASE STATUS');
    console.log('========================================');

    if (allConfigs.length === 0) {
      console.log('❌ NO FBA ZONING DATA IN DATABASE!');
      console.log('');
      console.log('⚠️  This means:');
      console.log('   - Separate tab uploads will use fallback data');
      console.log('   - Only ~5 sample destinations available');
      console.log('   - Calculations will be INACCURATE!');
      console.log('');
      console.log('✅ FIX: Run the seeding script:');
      console.log('   node scripts/seedFBAZoning.js');
      console.log('========================================\n');
      process.exit(0);
    }

    console.log(`✅ Found ${allConfigs.length} configuration(s)\n`);

    // Check active configuration
    const activeConfig = await FBAZoningConfig.findOne({ isActive: true });

    if (!activeConfig) {
      console.log('❌ NO ACTIVE FBA ZONING CONFIGURATION!');
      console.log('');
      console.log('⚠️  This means:');
      console.log('   - Separate tab uploads will use fallback data');
      console.log('   - Calculations will be INACCURATE!');
      console.log('');
      console.log('✅ FIX: Activate a configuration or run seeding:');
      console.log('   node scripts/seedFBAZoning.js');
      console.log('');
      console.log('📋 Available configurations:');
      allConfigs.forEach((config, idx) => {
        console.log(`   ${idx + 1}. ${config.version} - ${config.rowCount} rows (${config.isActive ? 'ACTIVE' : 'inactive'})`);
      });
      console.log('========================================\n');
      process.exit(0);
    }

    // Show active configuration details
    console.log('✅ ACTIVE CONFIGURATION FOUND!');
    console.log('========================================');
    console.log(`   Version: ${activeConfig.version}`);
    console.log(`   Row Count: ${activeConfig.rowCount} destinations`);
    console.log(`   Effective Date: ${activeConfig.effectiveDate.toISOString().split('T')[0]}`);
    console.log(`   Created: ${activeConfig.createdAt.toISOString().split('T')[0]}`);
    console.log(`   Description: ${activeConfig.description || 'N/A'}`);
    console.log(`   MongoDB ID: ${activeConfig._id}`);
    console.log('========================================\n');

    // Check if it has the full 263 destinations
    if (activeConfig.rowCount < 200) {
      console.log('⚠️  WARNING: Row count is LOW!');
      console.log(`   Current: ${activeConfig.rowCount} rows`);
      console.log(`   Expected: 263 rows (full Amazon fulfillment centers)`);
      console.log('');
      console.log('   This might be old sample data.');
      console.log('');
      console.log('✅ RECOMMENDED: Update with full data:');
      console.log('   1. Make sure fba_zoning_template.json has 263 rows');
      console.log('   2. Run: node scripts/seedFBAZoning.js');
      console.log('   3. Type "yes" to create new version');
      console.log('========================================\n');
    } else {
      console.log('✅ EXCELLENT! Full dataset present!');
      console.log(`   ${activeConfig.rowCount} destinations ≈ Complete Amazon network`);
      console.log('');
      console.log('   Separate tab uploads will use accurate data! 🎉');
      console.log('========================================\n');
    }

    // Show sample data from active config
    if (activeConfig.zoningData && activeConfig.zoningData.length > 0) {
      console.log('📋 Sample Data (first 5 destinations):');
      console.log('----------------------------------------');

      const sampleSize = Math.min(5, activeConfig.zoningData.length);
      for (let i = 0; i < sampleSize; i++) {
        const item = activeConfig.zoningData[i];

        // Check what format it is
        if (item.FBA) {
          // Full format
          console.log(`   ${i + 1}. ${item.FBA} - ${item.Province} (${item['2 Region'] || 'N/A'})`);
          if (item['Zip Prefix']) {
            console.log(`      ✅ Has Zip Prefix: ${item['Zip Prefix']}`);
          }
        } else if (item.Destination) {
          // Simple format
          console.log(`   ${i + 1}. ${item.Destination} - ${item.State} (${item.Region})`);
        } else {
          console.log(`   ${i + 1}. ${JSON.stringify(item)}`);
        }
      }
      console.log('========================================\n');

      // Check if it has Zip Prefix column
      const hasZipPrefix = activeConfig.zoningData.some(item =>
        item['Zip Prefix'] !== undefined || item.zipPrefix !== undefined
      );

      if (!hasZipPrefix) {
        console.log('⚠️  NOTE: Data does NOT have "Zip Prefix" column');
        console.log('   The 8th column is missing.');
        console.log('');
        console.log('✅ RECOMMENDED: Update with complete format:');
        console.log('   Use: fba_zoning_complete_format.json');
        console.log('   Run: node scripts/seedFBAZoning.js');
        console.log('========================================\n');
      } else {
        console.log('✅ Data includes "Zip Prefix" column (8th column)');
        console.log('========================================\n');
      }
    }

    // Show all configurations
    if (allConfigs.length > 1) {
      console.log('📚 All Configurations in Database:');
      console.log('----------------------------------------');
      allConfigs.forEach((config, idx) => {
        console.log(`   ${idx + 1}. ${config.version}`);
        console.log(`      Rows: ${config.rowCount}`);
        console.log(`      Active: ${config.isActive ? 'YES ✅' : 'No'}`);
        console.log(`      Created: ${config.createdAt.toISOString().split('T')[0]}`);
        console.log('');
      });
      console.log('========================================\n');
    }

    console.log('🎯 SUMMARY:');
    console.log('----------------------------------------');
    console.log(`   Total Configurations: ${allConfigs.length}`);
    console.log(`   Active Configuration: ${activeConfig.version}`);
    console.log(`   Destinations: ${activeConfig.rowCount}`);
    console.log(`   Status: ${activeConfig.rowCount >= 200 ? '✅ GOOD' : '⚠️  NEEDS UPDATE'}`);
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('');
    console.error('Common issues:');
    console.error('  - MongoDB not running');
    console.error('  - Wrong connection string in .env');
    console.error('  - Network issues');
    console.error('');
    process.exit(1);
  }
}

// Run check
checkFBAZoning();
