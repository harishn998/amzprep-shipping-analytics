// ============================================================================
// SEED FBA ZONING DATA - Populate Database with Production Data
// File: backend/scripts/seedFBAZoning.js
// Usage: node scripts/seedFBAZoning.js
// ============================================================================

import mongoose from 'mongoose';
import FBAZoningConfig from '../models/FBAZoningConfig.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import readline from 'readline';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function seedFBAZoning() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Load full data from JSON file
    let zoningData;
    try {
      const dataPath = join(__dirname, '..', 'data', 'fba_zoning_template.json');
      if (fs.existsSync(dataPath)) {
        const fileData = fs.readFileSync(dataPath, 'utf8');
        zoningData = JSON.parse(fileData);
        console.log(`📋 Loaded ${zoningData.length} destinations from: ${dataPath}`);

        // Check if data has Zip Prefix column
        const hasZipPrefix = zoningData.some(item =>
          item['Zip Prefix'] !== undefined || item.zipPrefix !== undefined
        );
        if (hasZipPrefix) {
          console.log('✅ Data includes "Zip Prefix" column (8th column)');
        } else {
          console.log('⚠️  Data does NOT include "Zip Prefix" column');
        }
      } else {
        console.error(`❌ Data file not found at: ${dataPath}`);
        console.error('');
        console.error('Please ensure fba_zoning_template.json exists in backend/data/');
        console.error('You can create it from the Excel file provided.');
        process.exit(1);
      }
    } catch (err) {
      console.error('❌ Could not load data file:', err.message);
      process.exit(1);
    }

    // Check if any config exists
    const existing = await FBAZoningConfig.findOne({ isActive: true });

    if (existing) {
      console.log('\n⚠️ Active FBA Zoning configuration already exists:');
      console.log(`   Version: ${existing.version}`);
      console.log(`   Created: ${existing.createdAt}`);
      console.log(`   Rows: ${existing.rowCount}`);

      // Check if existing data has Zip Prefix
      const existingHasZipPrefix = existing.zoningData && existing.zoningData.length > 0 &&
        existing.zoningData.some(item => item['Zip Prefix'] !== undefined || item.zipPrefix !== undefined);

      if (!existingHasZipPrefix) {
        console.log('   ⚠️  Current data is missing "Zip Prefix" column');
      }

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        rl.question('\n❓ Choose an option:\n   1. Update existing version (replace data)\n   2. Create new version\n   3. Cancel\nEnter choice (1/2/3): ', resolve);
      });
      rl.close();

      if (answer === '1') {
        // Update existing version
        console.log('\n🔄 Updating existing version...');
        existing.zoningData = zoningData;
        existing.rowCount = zoningData.length;
        existing.effectiveDate = new Date();
        existing.description = `Production FBA Zoning data with ${zoningData.length} Amazon fulfillment centers (Updated)`;
        await existing.save();

        console.log('\n✅ ========================================');
        console.log('✅ FBA Zoning Updated Successfully!');
        console.log('✅ ========================================');
        console.log(`   Version: ${existing.version}`);
        console.log(`   Destinations: ${existing.rowCount}`);
        console.log(`   Active: Yes`);
        console.log(`   MongoDB ID: ${existing._id}`);
        console.log(`   Updated: ${new Date().toISOString()}`);
        console.log('✅ ========================================\n');

        // Show sample data
        console.log('📋 Sample Data (first 5):');
        zoningData.slice(0, 5).forEach((item, idx) => {
          const fba = item.FBA || item.Destination;
          const state = item.Province || item.State;
          const region = item['2 Region'] || item.Region;
          const zipPrefix = item['Zip Prefix'] || item.zipPrefix || 'N/A';
          console.log(`   ${idx + 1}. ${fba} - ${state} (${region}) - Zip Prefix: ${zipPrefix}`);
        });

        console.log('\n✨ The system will now use this updated FBA Zoning for all analyses!\n');
        process.exit(0);

      } else if (answer === '2') {
        // Create new version with timestamp
        const now = new Date();
        const timestamp = `${now.getHours()}${String(now.getMinutes()).padStart(2, '0')}`;
        const version = `v${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${timestamp}`;

        // Deactivate current
        existing.isActive = false;
        await existing.save();

        const config = new FBAZoningConfig({
          version: version,
          effectiveDate: now,
          zoningData: zoningData,
          isActive: true,
          description: `Production FBA Zoning data with ${zoningData.length} Amazon fulfillment centers`,
          rowCount: zoningData.length
        });

        await config.save();

        console.log('\n✅ ========================================');
        console.log('✅ FBA Zoning Created Successfully!');
        console.log('✅ ========================================');
        console.log(`   Version: ${config.version}`);
        console.log(`   Destinations: ${config.rowCount}`);
        console.log(`   Active: Yes`);
        console.log(`   MongoDB ID: ${config._id}`);
        console.log(`   Previous version deactivated: ${existing.version}`);
        console.log('✅ ========================================\n');

        // Show sample data
        console.log('📋 Sample Data (first 5):');
        zoningData.slice(0, 5).forEach((item, idx) => {
          const fba = item.FBA || item.Destination;
          const state = item.Province || item.State;
          const region = item['2 Region'] || item.Region;
          const zipPrefix = item['Zip Prefix'] || item.zipPrefix || 'N/A';
          console.log(`   ${idx + 1}. ${fba} - ${state} (${region}) - Zip Prefix: ${zipPrefix}`);
        });

        console.log('\n✨ The system will now use this FBA Zoning for all analyses!\n');
        process.exit(0);

      } else {
        console.log('\n✋ Operation cancelled');
        process.exit(0);
      }
    }

    // No existing config - create new one
    const now = new Date();
    const version = `v${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const config = new FBAZoningConfig({
      version: version,
      effectiveDate: now,
      zoningData: zoningData,
      isActive: true,
      description: `Production FBA Zoning data with ${zoningData.length} Amazon fulfillment centers`,
      rowCount: zoningData.length
    });

    await config.save();

    console.log('\n✅ ========================================');
    console.log('✅ FBA Zoning Seeded Successfully!');
    console.log('✅ ========================================');
    console.log(`   Version: ${config.version}`);
    console.log(`   Destinations: ${config.rowCount}`);
    console.log(`   Active: Yes`);
    console.log(`   MongoDB ID: ${config._id}`);
    console.log(`   Effective Date: ${config.effectiveDate.toISOString()}`);
    console.log('✅ ========================================\n');

    // Show sample data
    console.log('📋 Sample Data (first 5):');
    zoningData.slice(0, 5).forEach((item, idx) => {
      const fba = item.FBA || item.Destination;
      const state = item.Province || item.State;
      const region = item['2 Region'] || item.Region;
      const zipPrefix = item['Zip Prefix'] || item.zipPrefix || 'N/A';
      console.log(`   ${idx + 1}. ${fba} - ${state} (${region}) - Zip Prefix: ${zipPrefix}`);
    });

    console.log('\n✨ The system will now use this FBA Zoning for all analyses!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Run seeding
seedFBAZoning();
