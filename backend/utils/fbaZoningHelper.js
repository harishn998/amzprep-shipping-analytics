// ============================================================================
// FBA ZONING HELPER - Retrieve FBA Zoning from database
// File: backend/utils/fbaZoningHelper.js
// ============================================================================

import xlsx from 'xlsx';
import FBAZoningConfig from '../models/FBAZoningConfig.js';

/**
 * Get active FBA Zoning configuration from database
 */
export async function getActiveFBAZoning() {
  try {
    const activeZoning = await FBAZoningConfig.findOne({ isActive: true });

    if (activeZoning) {
      console.log(`📍 Using FBA Zoning version: ${activeZoning.version}`);
      return activeZoning.zoningData;
    }

    // Fallback to default if no active zoning in DB
    console.log('⚠️ No active FBA Zoning in DB, using default');
    return getDefaultFBAZoning();

  } catch (error) {
    console.error('❌ Error fetching FBA Zoning:', error.message);
    return getDefaultFBAZoning();
  }
}

/**
 * Convert FBA Zoning data to Excel sheet
 */
export async function getFBAZoningSheet() {
  const zoningData = await getActiveFBAZoning();

  // Convert JSON data to worksheet
  const worksheet = xlsx.utils.json_to_sheet(zoningData);

  return worksheet;
}

/**
 * Default FBA Zoning data (fallback)
 */
function getDefaultFBAZoning() {
  // Sample FBA Zoning data
  return [
    { Destination: 'ABE3', Zone: 'PHL', State: 'PA', Region: 'East' },
    { Destination: 'ATL6', Zone: 'ATL', State: 'GA', Region: 'Southeast' },
    { Destination: 'BFL1', Zone: 'ONT', State: 'CA', Region: 'West' },
    { Destination: 'BWI2', Zone: 'BWI', State: 'MD', Region: 'East' },
    { Destination: 'CLT2', Zone: 'CLT', State: 'NC', Region: 'Southeast' },
    { Destination: 'CMH1', Zone: 'CMH', State: 'OH', Region: 'Midwest' },
    { Destination: 'DCA6', Zone: 'IAD', State: 'VA', Region: 'East' },
    { Destination: 'FTW1', Zone: 'DFW', State: 'TX', Region: 'South' },
    { Destination: 'IND2', Zone: 'IND', State: 'IN', Region: 'Midwest' },
    { Destination: 'JAX3', Zone: 'JAX', State: 'FL', Region: 'Southeast' },
    { Destination: 'LAS1', Zone: 'LAS', State: 'NV', Region: 'West' },
    { Destination: 'MCO1', Zone: 'MCO', State: 'FL', Region: 'Southeast' },
    { Destination: 'MDW2', Zone: 'ORD', State: 'IL', Region: 'Midwest' },
    { Destination: 'MEM1', Zone: 'MEM', State: 'TN', Region: 'South' },
    { Destination: 'MGE1', Zone: 'ATL', State: 'GA', Region: 'Southeast' },
    { Destination: 'ONT8', Zone: 'ONT', State: 'CA', Region: 'West' },
    { Destination: 'PHL7', Zone: 'PHL', State: 'PA', Region: 'East' },
    { Destination: 'PHX3', Zone: 'PHX', State: 'AZ', Region: 'West' },
    { Destination: 'RIC1', Zone: 'RIC', State: 'VA', Region: 'East' },
    { Destination: 'SDF8', Zone: 'SDF', State: 'KY', Region: 'South' },
    { Destination: 'TPA2', Zone: 'TPA', State: 'FL', Region: 'Southeast' },
    { Destination: 'TEB6', Zone: 'EWR', State: 'NJ', Region: 'East' }
  ];
}

/**
 * Cache for FBA Zoning (5 minute TTL)
 */
let zoningCache = null;
let cacheTTL = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get FBA Zoning with caching
 */
export async function getCachedFBAZoning() {
  if (zoningCache && cacheTTL && Date.now() < cacheTTL) {
    console.log('📦 Using cached FBA Zoning');
    return zoningCache;
  }

  zoningCache = await getActiveFBAZoning();
  cacheTTL = Date.now() + CACHE_DURATION;

  return zoningCache;
}

/**
 * Clear FBA Zoning cache (call after admin update)
 */
export function clearFBAZoningCache() {
  zoningCache = null;
  cacheTTL = null;
  console.log('🧹 FBA Zoning cache cleared');
}
