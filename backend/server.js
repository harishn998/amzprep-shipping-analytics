import 'dotenv/config';

import express from 'express';
import multer from 'multer';
import cors from 'cors';
import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import https from 'https';
import { createCanvas } from 'canvas';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from './config/passport.js';
import jwt from 'jsonwebtoken';
import puppeteer from 'puppeteer';
import { zipToState, calculateZone, estimateTransitTime } from './utils/zipToState.js';
import { detectFileFormat, getFormatDisplayName } from './utils/formatDetector.js';
import connectDB from './config/database.js';
import User from './models/User.js';
import Report from './models/Report.js';
import AmazonRate from './models/AmazonRate.js';
import ShopifyRate from './models/ShopifyRate.js';
import ratesRouter from './routes/rates.js';
import AmazonRateEnhanced from './models/AmazonRateEnhanced.js';
import ReportEnhanced from './models/ReportEnhanced.js';
import uploadEnhancedRoutes from './routes/uploadEnhanced.js';
import adminRateUploadRoutes from './routes/adminRateUpload.js';
import adminUserManagementRoutes from './routes/adminUserManagement.js';
import SmashFoodsIntegration from './utils/smashFoodsIntegration.js';
import AmazonEnhancementLayer from './utils/amazonEnhancementLayer.js';
import separateUploadRoutes from './routes/separateUpload.js';
import { startSessionCleanup } from './utils/sessionManager.js';
import adminFBAZoningRoutes from './routes/adminFBAZoning.js';
import publicAnalyzeRoutes from './routes/publicAnalyze.js';
//import dotenv from 'dotenv';
//dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
//const PORT = 5000;

const PORT = process.env.PORT || 5000;

// ============================================
// DATABASE CONNECTION (NEW)
// ============================================
connectDB();

// Start session cleanup (runs every 5 minutes)
startSessionCleanup(5);

//app.use(cors());

// ============================================
// CORS CONFIGURATION - Works for Dev & Production
// ============================================
const allowedOrigins = [
  // Production domains
  'https://rate.amzprep.com',
  'https://amzprep.com',
  'https://www.amzprep.com',

  // Development domains (only active in non-production)
  ...(process.env.NODE_ENV !== 'production' ? [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5500',
  ] : []),

  // For local HTML file testing (dev only)
  ...(process.env.NODE_ENV !== 'production' ? ['null'] : []),

  // From environment variable
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Log CORS config on startup
console.log(`🌐 CORS Configuration:`);
console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`   Allowed Origins: ${allowedOrigins.join(', ')}`);

app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const templatesDir = path.join(__dirname, 'templates');
if (!fs.existsSync(templatesDir)) {
  fs.mkdirSync(templatesDir);
}

// Ensure public-temp directory exists for lead magnet uploads
const publicTempDir = path.join(__dirname, 'uploads', 'public-temp');
if (!fs.existsSync(publicTempDir)) {
  fs.mkdirSync(publicTempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// ⚡ CRITICAL: Trust proxy when behind Nginx
app.set('trust proxy', 1);

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60,  // 1 day
    autoRemove: 'native'
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    domain: process.env.NODE_ENV === 'production' ? '.amzprep.com' : undefined
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// ============================================
// PUBLIC ROUTES - NO AUTHENTICATION REQUIRED
// ============================================
app.use('/api/public', publicAnalyzeRoutes);
console.log('✅ Public routes: /api/public/health, /api/public/analyze-files');

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel and CSV files are allowed'));
    }
  }
});

//let reports = [];
//let reportIdCounter = 1;

const stateNameToCode = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
  'District of Columbia': 'DC'
};

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        https.get(response.headers.location, (redirectResponse) => {
          const chunks = [];
          redirectResponse.on('data', (chunk) => chunks.push(chunk));
          redirectResponse.on('end', () => resolve(Buffer.concat(chunks)));
          redirectResponse.on('error', reject);
        }).on('error', reject);
      } else {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }
    }).on('error', reject);
  });
}

async function parseExcelFile(filePath, hazmatFilter = 'all', costConfig = {}) {
  // ✨ NEW: Enhancement Layer
  const enhancer = new AmazonEnhancementLayer();
  const enhancedFilePath = await enhancer.enhanceIfNeeded(filePath);

  // Now use the enhanced file path
  const workbook = xlsx.readFile(enhancedFilePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet);

  console.log(`📊 Parsing ${data.length} rows from Excel file`);

  const firstRow = data[0];
  if (!firstRow) {
    console.error('❌ No data found in file');
    return [];
  }

  // Detect format (this should now detect Smash Foods for enhanced files!)
  const detection = detectFileFormat(firstRow);

  console.log(`📋 Detected format: ${getFormatDisplayName(detection.format).toUpperCase()} (${detection.confidence}% confidence)`);

  if (detection.indicators && detection.indicators.length > 0) {
    console.log(`📋 Key indicators:`, detection.indicators.join(', '));
  }

  // Route to appropriate parser
  switch (detection.format) {
    case 'smash_foods':
      return await parseSmashFoodsFormat(enhancedFilePath, hazmatFilter, costConfig || 'all');  // ✓ Use enhanced path

    case 'muscle_mac':
      return await parseMuscleMacFormat(enhancedFilePath, hazmatFilter, costConfig || 'all');  // ✓ Use enhanced path

    case 'shopify':
      return parseShopifyFormat(data);

    case 'simple':
      return parseSimpleFormat(data);

    case 'unknown':
    default:
      console.error('❌ Unknown format. Cannot parse data.');
      console.error('📋 Sample headers:', Object.keys(firstRow).slice(0, 10).join(', '));
      return [];
  }
}

// Original simple format parser
function parseSimpleFormat(data) {
  return data.map(row => ({
    state: row.State || row.state || '',
    weight: parseFloat(row.Weight || row.weight || 0),
    cost: parseFloat(row.Cost || row.Shipping_Cost || row.shipping_cost || row.cost || 0),
    shippingMethod: row.Shipping_Method || row.Method || row.shipping_method || row.method || 'Standard',
    zone: parseInt(row.Zone || row.zone || 5),
    transitTime: parseInt(row.Transit_Time || row.transit_time || 4),
    zipCode: row.Zip_Code || row.zip_code || row.zipcode || '',
    date: row.Date || row.date || new Date().toISOString(),
    country: row.Country || row.country || 'US'
  }));
}

// New MUSCLE MAC format parser
async function parseMuscleMacFormat(filePath, hazmatFilter = 'all', costConfig = {}) {
  console.log('🔄 Processing Muscle Mac (Inv Water) format...');
  console.log('   File path:', filePath);
  console.log('   Using Smash Foods integration with Muscle Mac column mapping');
  console.log(`   Hazmat filter: ${hazmatFilter}`);
  console.log('   Cost Config:', JSON.stringify(costConfig));

  try {
    const integration = new SmashFoodsIntegration();

    // 🆕 Build SOP config from costConfig (same as Smash Foods)
    const sopConfig = {
      freightCost: costConfig.freightCost || 3000,
      freightMarkup: costConfig.freightMarkup || 1.20,
      mmBaseCost: costConfig.mmBaseCost || null,
      mmMarkup: costConfig.mmMarkup || 1.0,
      rateMode: costConfig.rateMode || 'FTL',
      destination: costConfig.destination || null,
      palletCost: costConfig.palletCost || 150,

      analysisYear: costConfig.analysisYear || new Date().getFullYear(),
      analysisStartMonth: costConfig.analysisStartMonth || 1,
      analysisEndMonth: costConfig.analysisEndMonth || 12,
      shipFromFilter: costConfig.shipFromFilter || [],

      ftlCost: costConfig.freightCost || 3000,
      useFTL: costConfig.rateMode !== 'PALLET'
    };

    const analysis = await integration.analyzeSmashFoodsFile(
      filePath,
      'combined',
      0.10,
      hazmatFilter,
      sopConfig  // 🆕 Pass dynamic config
    );

    console.log('✅ Muscle Mac analysis complete');
    console.log(`   Total Shipments: ${analysis.totalShipments}`);
    console.log(`   Total Pallets: ${analysis.totalPallets}`);
    console.log(`   Total Cuft: ${analysis.totalCuft?.toFixed(2)}`);
    console.log(`   Savings: $${analysis.savings?.amount?.toFixed(2)}`);

    // Return with special flag
    return [{
      __smashFoodsAnalysis: true,
      analysis: {
        ...analysis,
        metadata: {
          ...analysis.metadata,
          dataFormat: 'muscle_mac_actual',
          originalFormat: 'muscle_mac',
          costConfig: sopConfig  // 🆕 Include config in metadata
        },
        executiveSummary: {
          ...analysis.executiveSummary,
          title: 'Inv Water Freight Analysis'
        }
      }
    }];

  } catch (error) {
    console.error('❌ Muscle Mac processing failed:', error);
    throw error;
  }
}

// Smash Foods format parser
// NEW: Automated Smash Foods parser using integration module
async function parseSmashFoodsFormat(filePath, hazmatFilter = 'all', costConfig = {}) {
  console.log('🚀 Processing Smash Foods format with FULL AUTOMATION...');
  console.log(`   File path: ${filePath}`);
  console.log(`   Hazmat filter: ${hazmatFilter}`);
  console.log(`   Cost Config:`, JSON.stringify(costConfig));

  try {
    const integration = new SmashFoodsIntegration();

    // 🆕 Build SOP config from costConfig
    const sopConfig = {
      // Freight settings
      freightCost: costConfig.freightCost || 3000,
      freightMarkup: costConfig.freightMarkup || 1.20,

      // Middle mile settings
      mmBaseCost: costConfig.mmBaseCost || null,  // null = use pattern rates
      mmMarkup: costConfig.mmMarkup || 1.0,

      // Rate mode
      rateMode: costConfig.rateMode || 'FTL',  // 'FTL' or 'PALLET'

      // Destination override
      destination: costConfig.destination || null,  // null = auto-detect

      // Pallet cost (for PALLET mode)
      palletCost: costConfig.palletCost || 150,

      analysisYear: costConfig.analysisYear || new Date().getFullYear(),
      analysisStartMonth: costConfig.analysisStartMonth || 1,
      analysisEndMonth: costConfig.analysisEndMonth || 12,
      shipFromFilter: costConfig.shipFromFilter || [],

      // Backward compatibility
      ftlCost: costConfig.freightCost || 3000,
      useFTL: costConfig.rateMode !== 'PALLET'
    };

    console.log('📊 SOP Config built:', JSON.stringify(sopConfig, null, 2));

    // Run complete automated analysis using SOP-compliant formulas
    const analysis = await integration.analyzeSmashFoodsFile(
      filePath,
      'combined',  // rate type
      0.10,        // 10% markup (legacy param)
      hazmatFilter,
      sopConfig    // 🆕 Pass dynamic config
    );

    console.log('✅ Smash Foods analysis complete');
    console.log(`   Total Shipments: ${analysis.totalShipments}`);
    console.log(`   Total Pallets: ${analysis.totalPallets}`);
    console.log(`   Total Cuft: ${analysis.totalCuft?.toFixed(2)}`);
    console.log(`   Hazmat Products: ${analysis.hazmat?.products?.hazmat || 0}`);
    console.log(`   Current Total: $${analysis.currentCosts?.totalCost?.toFixed(2)}`);
    console.log(`   AMZ Prep Total: $${analysis.proposedCosts?.combined?.totalCost?.toFixed(2) || analysis.proposedCosts?.sop?.totalFreightCost?.toFixed(2)}`);
    console.log(`   Savings: $${analysis.savings?.amount?.toFixed(2)}`);

    // Return with special marker
    return [{
      __smashFoodsAnalysis: true,
      analysis: {
        ...analysis,
        metadata: {
          ...analysis.metadata,
          dataFormat: 'smash_foods_actual',
          originalFormat: 'smash_foods',
          hazmatFilter,
          costConfig: sopConfig  // 🆕 Include config in metadata for audit trail
        }
      }
    }];

  } catch (error) {
    console.error('❌ Smash Foods analysis failed:', error);
    throw error;
  }
}

// ============================================
// SHOPIFY ORDERS FORMAT PARSER
// ============================================
function parseShopifyFormat(data) {
  console.log('🛒 Parsing SHOPIFY ORDERS format...');

  const shipments = [];
  const orderMap = new Map(); // Group by order number
  let skippedRows = 0;
  let processedRows = 0;

  // Warehouse origin ZIP (adjust to your actual warehouse)
  const warehouseZip = '28601'; // Hickory, NC - CHANGE THIS TO YOUR WAREHOUSE ZIP

  // Step 1: Group line items by order
  data.forEach((row, index) => {
    try {
      processedRows++;

      // Get order number (e.g., "#315724")
      const orderName = row['Name'];

      // Skip empty rows or non-order rows
      if (!orderName || orderName.trim() === '') {
        skippedRows++;
        return;
      }

      // Initialize order if not exists
      if (!orderMap.has(orderName)) {
        orderMap.set(orderName, {
          orderName: orderName,
          shippingZip: row['Shipping Zip'],
          shippingCost: parseFloat(row['Shipping'] || 0),
          shippingMethod: row['Shipping Method'] || 'Standard Shipping',
          shippingCountry: row['Shipping Country'] || 'US',
          shippingState: row['Shipping Province'] || '',
          createdAt: row['Created at'],
          totalWeight: 0,
          lineItemCount: 0
        });
      }

      // Get order reference
      const order = orderMap.get(orderName);

      // Extract and convert line item weight to pounds
      const lineitemWeight = parseFloat(row['Lineitem weight'] || 0);
      const lineitemGrams = parseFloat(row['Lineitem grams'] || 0);
      const weightUnit = (row['Lineitem weight unit'] || 'kg').toLowerCase();

      // Convert weight to pounds
      let weightInPounds = 0;

      if (lineitemWeight > 0) {
        if (weightUnit === 'kg') {
          weightInPounds = lineitemWeight * 2.20462; // kg to lbs
        } else if (weightUnit === 'lbs' || weightUnit === 'lb') {
          weightInPounds = lineitemWeight;
        } else if (weightUnit === 'g' || weightUnit === 'grams') {
          weightInPounds = lineitemWeight * 0.00220462; // grams to lbs
        } else {
          // Unknown unit, try to infer
          if (lineitemWeight < 10) {
            // Likely kg or lbs
            weightInPounds = lineitemWeight;
          } else if (lineitemWeight > 100) {
            // Likely grams
            weightInPounds = lineitemWeight * 0.00220462;
          }
        }
      } else if (lineitemGrams > 0) {
        weightInPounds = lineitemGrams * 0.00220462; // grams to lbs
      }

      // Add to order total weight
      if (weightInPounds > 0) {
        order.totalWeight += weightInPounds;
        order.lineItemCount++;
      }

    } catch (error) {
      console.error(`❌ Error parsing Shopify row ${index + 1}:`, error.message);
      skippedRows++;
    }
  });

  console.log(`📦 Processed ${processedRows} rows`);
  console.log(`📦 Found ${orderMap.size} unique orders`);

  // Step 2: Convert orders to shipments
  let validShipments = 0;
  let invalidShipments = 0;

  for (const [orderName, order] of orderMap) {
    try {
      // Skip orders without shipping ZIP
      if (!order.shippingZip) {
        console.log(`⚠️  Order ${orderName}: No shipping ZIP, skipping`);
        invalidShipments++;
        continue;
      }

      // Clean ZIP code (remove everything after hyphen)
      const zipCode = String(order.shippingZip).split('-')[0].trim();

      // Skip if ZIP is too short
      if (zipCode.length < 5) {
        console.log(`⚠️  Order ${orderName}: Invalid ZIP length (${zipCode}), skipping`);
        invalidShipments++;
        continue;
      }

      // Get state from ZIP
      let stateInfo = zipToState(zipCode);

      // Fallback: if ZIP doesn't work, try to use shipping state/province
      if (!stateInfo && order.shippingState) {
        // Handle Canadian provinces
        const canadianProvinces = {
          'QC': 'Quebec', 'ON': 'Ontario', 'BC': 'British Columbia',
          'AB': 'Alberta', 'MB': 'Manitoba', 'SK': 'Saskatchewan',
          'NS': 'Nova Scotia', 'NB': 'New Brunswick', 'NL': 'Newfoundland and Labrador',
          'PE': 'Prince Edward Island', 'NT': 'Northwest Territories',
          'YT': 'Yukon', 'NU': 'Nunavut'
        };

        const province = order.shippingState.toUpperCase();
        if (canadianProvinces[province]) {
          stateInfo = {
            state: canadianProvinces[province],
            code: province
          };
        }
      }

      // Skip if state cannot be determined
      if (!stateInfo) {
        console.log(`⚠️  Order ${orderName}: Cannot determine state for ZIP ${zipCode}, skipping`);
        invalidShipments++;
        continue;
      }

      // Calculate zone (defaults to 5 if calculation fails)
      const zone = calculateZone(warehouseZip, zipCode);

      // Estimate transit time based on shipping method
      const transitTime = estimateTransitTime(order.shippingMethod, zone);

      // Parse date
      let date = new Date().toISOString();
      if (order.createdAt) {
        try {
          // Shopify format examples: "10/27/25 15:58" or "2025-10-27T15:58:00"
          const parsedDate = new Date(order.createdAt);
          if (!isNaN(parsedDate.getTime())) {
            date = parsedDate.toISOString();
          }
        } catch (e) {
          console.log(`⚠️  Order ${orderName}: Invalid date format, using current date`);
        }
      }

      // Determine if international based on country code
      const isInternational = order.shippingCountry &&
                            order.shippingCountry.toUpperCase() !== 'US';

      // Add shipment
      shipments.push({
        state: stateInfo.state,
        weight: order.totalWeight > 0 ? order.totalWeight : 1, // Default to 1 lb if 0
        cost: order.shippingCost || 0, // Some orders have free shipping
        shippingMethod: order.shippingMethod,
        zone: zone,
        transitTime: transitTime,
        zipCode: zipCode,
        date: date,
        country: order.shippingCountry || 'US',
        // Additional metadata
        orderName: orderName,
        lineItemCount: order.lineItemCount
      });

      validShipments++;

    } catch (error) {
      console.error(`❌ Error processing order ${orderName}:`, error.message);
      invalidShipments++;
    }
  }

  console.log(`✅ Successfully parsed ${validShipments} Shopify orders into shipments`);
  console.log(`⚠️  Skipped ${skippedRows} invalid rows`);
  console.log(`⚠️  Skipped ${invalidShipments} invalid orders`);

  // Log sample of first few shipments for verification
  if (shipments.length > 0) {
    console.log('📊 Sample shipment data:');
    console.log(JSON.stringify(shipments.slice(0, 3), null, 2));
  }

  return shipments;
}

function calculateWarehouseComparison(shipments) {
  const baseCost = shipments.reduce((sum, s) => sum + s.cost, 0);

  // Real DTC Warehouse Locations with full addresses
  const warehouses = [
    {
      name: 'Charlotte, NC',
      fullAddress: 'Suite C - 585 11th Street Ct NW, Hickory, NC 28601',
      costMultiplier: 1.0,
      avgZone: 5.1,
      transitTime: 4.5,
      region: 'Southeast'
    },
    {
      name: 'California',
      fullAddress: '2530 Lindsay Privado Dr #A, Ontario, CA 91761',
      costMultiplier: 1.21,
      avgZone: 6.2,
      transitTime: 5.4,
      region: 'West Coast'
    },
    {
      name: 'Orlando, FL',
      fullAddress: 'Unit 2 - 212 Outlook Point Dr., Orlando, FL 32809',
      costMultiplier: 1.15,
      avgZone: 6.0,
      transitTime: 4.9,
      region: 'Southeast'
    },
    {
      name: 'Charlotte + CA + Orlando (3)',
      fullAddress: 'Multi-warehouse strategy',
      costMultiplier: 0.85,
      avgZone: 3.9,
      transitTime: 4.1,
      recommended: true,
      region: 'Multi-Region'
    },
    {
      name: 'Charlotte + California (2)',
      fullAddress: 'East-West coverage',
      costMultiplier: 0.86,
      avgZone: 4.1,
      transitTime: 4.1,
      region: 'Multi-Region'
    },
    {
      name: 'California + Orlando (2)',
      fullAddress: 'West-Southeast coverage',
      costMultiplier: 0.98,
      avgZone: 4.8,
      transitTime: 4.5,
      region: 'Multi-Region'
    },
    {
      name: 'Dallas, TX',
      fullAddress: 'Suite 1 - 1809 W. Frankford Rd. #160, Carrollton, TX 75007',
      costMultiplier: 1.05,
      avgZone: 5.5,
      transitTime: 4.7,
      region: 'South Central'
    },
    {
      name: 'Salt Lake City, UT',
      fullAddress: '720 Gladiola St. Suite A, Salt Lake City, UT 84104',
      costMultiplier: 1.18,
      avgZone: 5.8,
      transitTime: 5.2,
      region: 'Mountain West'
    },
    {
      name: 'Chicago, IL',
      fullAddress: '3001 Broadsmore Dr #340., Algonquin, IL 60102',
      costMultiplier: 1.08,
      avgZone: 5.3,
      transitTime: 4.6,
      region: 'Midwest'
    },
    {
      name: 'Alabama (Temp Controlled)',
      fullAddress: 'Unit 408 - 980 Murray Rd, Dothan, AL 36303',
      costMultiplier: 1.12,
      avgZone: 5.7,
      transitTime: 5.0,
      region: 'Southeast',
      specialty: 'Temperature Controlled'
    }
  ];

  return warehouses.map(wh => {
    const cost = Math.round(baseCost * wh.costMultiplier);
    const savings = wh.recommended ? Math.round(baseCost - cost) : null;
    const savingsPercent = wh.recommended ? ((baseCost - cost) / baseCost * 100).toFixed(1) : null;
    return {
      ...wh,
      cost,
      savings,
      savingsPercent,
      shipments: shipments.length
    };
  });
}

function analyzeShipments(shipments) {

  // CHECK: If this is a complete Smash Foods analysis, return it directly
  if (shipments.length === 1 && shipments[0].__smashFoodsAnalysis) {
    console.log('📊 Using complete Smash Foods analysis');
    const smashAnalysis = shipments[0].analysis;

    // Convert to format expected by Report model
    return convertSmashFoodsToReportFormat(smashAnalysis);
  }

  // NEW: Check if this is Smash Foods automated analysis
  if (shipments.length === 1 && shipments[0]._smashFoodsAnalysis) {
    return convertSmashFoodsAnalysisToReport(shipments[0]._smashFoodsAnalysis);
  }

  const totalShipments = shipments.length;
  const totalWeight = shipments.reduce((sum, s) => sum + s.weight, 0);
  const totalCost = shipments.reduce((sum, s) => sum + s.cost, 0);
  const avgWeight = (totalWeight / totalShipments).toFixed(2);
  const avgCost = totalCost > 0 ? (totalCost / totalShipments).toFixed(2) : 'Not available';

  const domesticCount = shipments.filter(s => s.country === 'US' || !s.country).length;
  const internationalCount = totalShipments - domesticCount;

  const stateCounts = {};
  const stateCosts = {};

  shipments.forEach(s => {
    const stateName = s.state.trim();
    if (!stateCounts[stateName]) {
      stateCounts[stateName] = 0;
      stateCosts[stateName] = [];
    }
    stateCounts[stateName]++;
    stateCosts[stateName].push(s.cost);
  });

  const topStates = Object.entries(stateCounts)
    .map(([name, count]) => {
      let code;
      if (name.length === 2) {
        code = name.toUpperCase();
      } else {
        code = stateNameToCode[name] || name.substring(0, 2).toUpperCase();
      }

      return {
        name,
        code,
        volume: count,
        percentage: Math.round((count / totalShipments) * 100),
        avgCost: stateCosts[name].length > 0
          ? parseFloat((stateCosts[name].reduce((a, b) => a + b, 0) / stateCosts[name].length).toFixed(2))
          : null
      };
    })
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 7);

  const methodCounts = {};
  shipments.forEach(s => {
    const method = s.shippingMethod;
    methodCounts[method] = (methodCounts[method] || 0) + 1;
  });

  const shippingMethods = Object.entries(methodCounts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / totalShipments) * 100)
    }))
    .sort((a, b) => b.count - a.count);

  const weightRanges = [
    { range: '0-0.5 lbs', min: 0, max: 0.5 },
    { range: '0.5-0.99 lbs', min: 0.5, max: 0.99 },
    { range: '1-5 lbs', min: 1, max: 5 },
    { range: '5 lbs+', min: 5, max: Infinity }
  ];

  const weightDistribution = weightRanges.map(wr => ({
    range: wr.range,
    count: shipments.filter(s => s.weight >= wr.min && s.weight < wr.max).length
  }));

  const zoneCounts = {};
  shipments.forEach(s => {
    const zone = s.zone || 5;
    zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
  });

  const zoneDistribution = Object.entries(zoneCounts)
    .map(([zone, count]) => ({
      zone: parseInt(zone),
      count,
      percentage: ((count / totalShipments) * 100).toFixed(1)
    }))
    .sort((a, b) => a.zone - b.zone);

  const warehouseComparison = calculateWarehouseComparison(shipments);

  const dates = shipments.map(s => new Date(s.date)).filter(d => !isNaN(d));
  const minDate = dates.length > 0 ? new Date(Math.min(...dates)) : new Date();
  const maxDate = dates.length > 0 ? new Date(Math.max(...dates)) : new Date();
  const daysDiff = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
  const months = daysDiff > 30 ? Math.ceil(daysDiff / 30) : 1;

  return {
    totalShipments,
    avgWeight: parseFloat(avgWeight),
    avgCost,
    analysisMonths: months,
    dateRange: {
      start: minDate.toISOString().split('T')[0],
      end: maxDate.toISOString().split('T')[0]
    },
    domesticVsInternational: {
      domestic: domesticCount,
      international: internationalCount,
      domesticPercent: ((domesticCount / totalShipments) * 100).toFixed(1),
      internationalPercent: ((internationalCount / totalShipments) * 100).toFixed(1)
    },
    topStates,
    warehouseComparison,
    shippingMethods,
    weightDistribution,
    zoneDistribution
  };
}

function convertSmashFoodsToReportFormat(analysis) {
  // Helper function to safely get numbers
  const safeNumber = (val, defaultVal = 0) => {
    const num = Number(val);
    return isNaN(num) ? defaultVal : num;
  };

  // Extract key metrics
  const totalShipments = safeNumber(analysis.totalShipments, 0);
  const totalUnits = safeNumber(analysis.totalUnits, 0);
  const totalPallets = Math.round(safeNumber(analysis.totalPallets, 0));
  const totalCuft = safeNumber(analysis.totalCuft, 0);
  const totalWeight = safeNumber(analysis.totalWeight, 0);

  // Current costs
  const currentTotalCost = safeNumber(analysis.currentCosts?.totalCost, 0);
  const currentFreight = safeNumber(analysis.currentCosts?.totalFreight, 0);
  const currentPlacementFees = safeNumber(analysis.currentCosts?.totalPlacementFees, 0);

  // Proposed costs - using SOP structure
  const proposedTotalCost = safeNumber(analysis.proposedCosts?.sop?.totalFreightCost, 0);
  const mmCost = safeNumber(analysis.proposedCosts?.sop?.mmCost, 0);
  const internalTransferCost = safeNumber(analysis.proposedCosts?.sop?.internalTransferCost, 0);
  const mmCostPT = safeNumber(analysis.proposedCosts?.sop?.mmCostPT, 0);

  // Savings
  const savingsAmount = safeNumber(analysis.savings?.amount, 0);
  const savingsPercent = safeNumber(analysis.savings?.percent, 0);

  // 🆕 FIX #1: Transit times - get from transitImprovement object
  const avgTransitTime = safeNumber(
    analysis.transitImprovement?.currentTransitDays || analysis.avgTransitTime,
    0
  );
  const amzPrepTransitTime = safeNumber(
    analysis.transitImprovement?.amzPrepTransitDays || analysis.amzPrepTransitTime,
    6
  );
  const transitImprovement = safeNumber(
    analysis.transitImprovement?.improvementDays || analysis.transitImprovement,
    0
  );
  const transitImprovementPercent = safeNumber(
    analysis.transitImprovement?.improvementPercent || analysis.transitImprovementPercent,
    0
  );

  // 🆕 FIX #2: Convert stateBreakdown object to topStates array
  const topStates = Object.values(analysis.stateBreakdown || {})
    .map(state => ({
      name: state.state || 'Unknown',
      code: state.state || 'XX',
      volume: safeNumber(state.count, 0),
      percentage: totalShipments > 0
        ? Math.round((safeNumber(state.count, 0) / totalShipments) * 100)
        : 0,
      avgCost: safeNumber(state.count, 0) > 0
        ? Math.round(safeNumber(state.currentCost, 0) / safeNumber(state.count, 0))
        : 0
    }))
    .sort((a, b) => b.volume - a.volume);

  // 🆕 FIX #3: Get recommendations from insights
  const recommendations = (analysis.insights?.recommendations || analysis.recommendations || [])
    .map(rec => ({
      type: rec.type || 'general',
      title: rec.title || 'Recommendation',
      description: rec.description || '',
      impact: rec.impact || 'medium',
      savings: rec.savings ? Math.round(safeNumber(rec.savings, 0)) : undefined,
      improvement: rec.improvement ? safeNumber(rec.improvement, 0) : undefined
    }));

  // 🆕 FIX #4: Transform hazmat data to expected structure
  const hazmatData = analysis.hazmatAnalysis ? {
    overview: {
      totalProducts: safeNumber(analysis.hazmatAnalysis.products?.total, 0),
      totalHazmatProducts: safeNumber(analysis.hazmatAnalysis.products?.hazmat, 0),
      totalNonHazmatProducts: safeNumber(analysis.hazmatAnalysis.products?.nonHazmat, 0),
      hazmatPercentage: safeNumber(analysis.hazmatAnalysis.products?.percentHazmat, 0),
      shipmentsAnalyzed: safeNumber(analysis.hazmatAnalysis.shipments?.total, totalShipments),
      totalHazmatShipments: safeNumber(analysis.hazmatAnalysis.shipments?.hazmat, 0),
      totalNonHazmatShipments: safeNumber(analysis.hazmatAnalysis.shipments?.nonHazmat, 0),
      shipmentHazmatPercentage: safeNumber(analysis.hazmatAnalysis.shipments?.percentHazmat, 0)
    },
    typeBreakdown: (analysis.hazmatAnalysis.typeBreakdown || []).map(item => ({
      type: item.type || 'Unknown',
      count: safeNumber(item.count, 0),
      percentage: safeNumber(item.percentage, 0)
    })),
    compliance: analysis.hazmatAnalysis.compliance || [],
    products: analysis.hazmatAnalysis.products || {}
  } : null;

  return {
    // Basic metrics
    totalShipments: totalShipments,
    avgWeight: totalShipments > 0 ? Math.round(totalWeight / totalShipments) : 0,
    avgCost: totalShipments > 0 ? Math.round(currentTotalCost / totalShipments) : 0,
    analysisMonths: Math.max(1, Math.ceil(safeNumber(analysis.dateRange?.days, 30) / 30)),

    // Date range
    dateRange: {
      start: analysis.dateRange?.start || new Date().toISOString().split('T')[0],
      end: analysis.dateRange?.end || new Date().toISOString().split('T')[0]
    },

    // Domestic vs International
    domesticVsInternational: {
      domestic: totalShipments,
      international: 0,
      domesticPercent: '100%',
      internationalPercent: '0%'
    },

    // 🆕 FIX #2: Use converted topStates array
    topStates: topStates,

    // Warehouse comparison
    warehouseComparison: [
      {
        name: 'Current Provider',
        fullAddress: 'Various carriers and locations',
        region: 'Multiple',
        specialty: 'Standard fulfillment',
        costMultiplier: 1.0,
        avgZone: 6,
        transitTime: Math.round(avgTransitTime) || 0,
        cost: Math.round(currentTotalCost) || 0,
        savings: 0,
        savingsPercent: '0%',
        shipments: totalShipments,
        recommended: false
      },
      {
        name: 'AMZ Prep Complete Solution',
        fullAddress: 'Columbus, OH - Central fulfillment hub',
        region: 'Midwest',
        specialty: 'Fast prep + optimized shipping',
        costMultiplier: 0.85,
        avgZone: 5,
        transitTime: amzPrepTransitTime,
        cost: Math.round(proposedTotalCost) || 0,
        savings: Math.round(savingsAmount) || 0,
        savingsPercent: `${savingsPercent.toFixed(1)}%`,
        shipments: totalShipments,
        recommended: savingsAmount > 0
      }
    ],

    // Shipping methods
    shippingMethods: (analysis.carriers || []).map(carrier => ({
      name: carrier.name || 'Unknown',
      count: safeNumber(carrier.count, 0),
      percentage: safeNumber(carrier.percentage, 0)
    })),

    // Weight distribution
    weightDistribution: [
      { range: '0-10 lbs', count: Math.round(totalShipments * 0.3) },
      { range: '10-50 lbs', count: Math.round(totalShipments * 0.4) },
      { range: '50-150 lbs', count: Math.round(totalShipments * 0.2) },
      { range: '150+ lbs', count: Math.round(totalShipments * 0.1) }
    ],

    // Zone distribution
    zoneDistribution: [
      { zone: 4, count: Math.round(totalShipments * 0.2), percentage: '20%' },
      { zone: 5, count: Math.round(totalShipments * 0.3), percentage: '30%' },
      { zone: 6, count: Math.round(totalShipments * 0.3), percentage: '30%' },
      { zone: 7, count: Math.round(totalShipments * 0.2), percentage: '20%' }
    ],

    // 🆕 FIX #4: Use transformed hazmat data
    hazmat: hazmatData,

    // ENHANCED METADATA
    metadata: {
      dataFormat: 'smash_foods_actual',

      // Current costs breakdown
      currentCosts: {
        totalFreight: Math.round(currentFreight),
        totalPlacementFees: Math.round(currentPlacementFees),
        totalCost: Math.round(currentTotalCost),
        costPerCuft: safeNumber(analysis.currentCosts?.costPerCuft, 0),
        costPerUnit: safeNumber(analysis.currentCosts?.costPerUnit, 0),
        costPerPallet: safeNumber(analysis.currentCosts?.costPerPallet, 0)
      },

      // Proposed costs using SOP structure
      proposedCosts: {
        sop: {
          mmCost: Math.round(mmCost),
          internalTransferCost: Math.round(internalTransferCost),
          totalFreightCost: Math.round(proposedTotalCost),
          mmCostPT: Math.round(mmCostPT),
          costPerCuft: safeNumber(analysis.proposedCosts?.sop?.costPerCuft, 0),
          costPerUnit: safeNumber(analysis.proposedCosts?.sop?.costPerUnit, 0),
          costPerPallet: safeNumber(analysis.proposedCosts?.sop?.costPerPallet, 0),
          breakdown: (analysis.proposedCosts?.sop?.breakdown || []).map(item => ({
            type: item.type || 'Unknown',
            description: item.description || '',
            cost: Math.round(safeNumber(item.cost, 0))
          }))
        }
      },

      // Savings calculation
      savings: {
        amount: Math.round(savingsAmount),
        percent: safeNumber(savingsPercent, 0),
        currentTotal: Math.round(currentTotalCost),
        proposedTotal: Math.round(proposedTotalCost)
      },

      // 🆕 FIX #3: Recommendations from insights
      recommendations: recommendations,

      // Carrier information
      carriers: (analysis.carriers || []).map(carrier => ({
        name: carrier.name || 'Unknown',
        count: safeNumber(carrier.count, 0),
        percentage: safeNumber(carrier.percentage, 0)
      })),

      // 🆕 FIX #1: Timeline metrics from transitImprovement
      avgPrepTime: safeNumber(analysis.avgPrepTime, 0),
      avgTransitTime: Math.round(avgTransitTime),
      amzPrepTransitTime: amzPrepTransitTime,
      transitImprovement: transitImprovement,
      transitImprovementPercent: transitImprovementPercent,

      // Shipment splitting analysis
      splitShipments: safeNumber(analysis.splitShipments, 0),
      splitShipmentRate: safeNumber(analysis.splitShipmentRate, 0),

      // Additional metrics
      totalUnits: safeNumber(totalUnits, 0),
      totalPallets: totalPallets,
      totalCuft: safeNumber(totalCuft, 0),
      totalWeight: Math.round(totalWeight),

      // State-level details
      stateDetails: analysis.stateBreakdown || {},

      // Executive summary
      executiveSummary: analysis.insights?.executiveSummary || analysis.executiveSummary || {
        title: 'Smash Foods Freight Analysis',
        subtitle: `${totalShipments} Shipments | ${totalUnits.toLocaleString()} Units | ${totalPallets} Pallets`,
        keyFindings: []
      },

      // Monthly breakdown data
      monthlyBreakdown: analysis.metadata?.monthlyBreakdown || analysis.monthlyBreakdown || null,
      shipMethodBreakdown: analysis.metadata?.shipMethodBreakdown || analysis.shipMethodBreakdown || null,

      // 🆕 FIX #5: Add fromZipBreakdown
      fromZipBreakdown: analysis.metadata?.fromZipBreakdown || analysis.fromZipBreakdown || null
    }
  };
}

/**
 * Convert Smash Foods analysis to report format
 * This bridges the automated analysis to your existing dashboard structure
 */
 function convertSmashFoodsAnalysisToReport(analysis) {
   console.log('📊 Converting Smash Foods analysis to report format...');

   // Helper function to safely convert to number or default
   const safeNumber = (value, defaultValue = 0) => {
     const num = Number(value);
     return isNaN(num) || !isFinite(num) ? defaultValue : num;
   };

   // Safely get values with defaults
   const totalShipments = safeNumber(analysis.totalShipments, 0);
   const totalWeight = safeNumber(analysis.totalWeight, 0);
   const totalUnits = safeNumber(analysis.totalUnits, 0);
   const totalPallets = safeNumber(analysis.totalPallets, 0);
   const totalCuft = safeNumber(analysis.totalCuft, 0);

   const currentTotalCost = safeNumber(analysis.currentCosts?.totalCost, 0);
   const proposedTotalCost = safeNumber(
     analysis.proposedCosts?.sop?.totalFreightCost || analysis.proposedCosts?.combined?.totalCost,
     0
   );
   const savingsAmount = safeNumber(analysis.savings?.amount, 0);
   const savingsPercent = safeNumber(analysis.savings?.percent, 0);

   // 🆕 FIX #1: Transit times from transitImprovement object
   const avgTransitTime = safeNumber(
     analysis.transitImprovement?.currentTransitDays || analysis.avgTransitTime,
     0
   );
   const amzPrepTransitTime = safeNumber(
     analysis.transitImprovement?.amzPrepTransitDays || analysis.amzPrepTransitTime,
     6
   );
   const transitImprovement = safeNumber(
     analysis.transitImprovement?.improvementDays,
     0
   );
   const transitImprovementPercent = safeNumber(
     analysis.transitImprovement?.improvementPercent,
     0
   );

   // 🆕 FIX #2: Convert stateBreakdown object to topStates array
   const topStates = Object.values(analysis.stateBreakdown || {})
     .map(state => ({
       name: state.state || 'Unknown',
       code: state.state || 'XX',
       volume: safeNumber(state.count, 0),
       percentage: totalShipments > 0
         ? Math.round((safeNumber(state.count, 0) / totalShipments) * 100)
         : 0,
       avgCost: safeNumber(state.count, 0) > 0
         ? Math.round(safeNumber(state.currentCost, 0) / safeNumber(state.count, 0))
         : 0
     }))
     .sort((a, b) => b.volume - a.volume);

   // 🆕 FIX #3: Get recommendations from insights
   const recommendations = (analysis.insights?.recommendations || analysis.recommendations || [])
     .map(rec => ({
       type: rec.type || 'general',
       title: rec.title || 'Recommendation',
       description: rec.description || '',
       impact: rec.impact || 'medium',
       savings: rec.savings ? Math.round(safeNumber(rec.savings, 0)) : undefined,
       improvement: rec.improvement ? safeNumber(rec.improvement, 0) : undefined
     }));

   // 🆕 FIX #4: Transform hazmat data
   const hazmatData = analysis.hazmatAnalysis ? {
     overview: {
       totalProducts: safeNumber(analysis.hazmatAnalysis.products?.total, 0),
       totalHazmatProducts: safeNumber(analysis.hazmatAnalysis.products?.hazmat, 0),
       totalNonHazmatProducts: safeNumber(analysis.hazmatAnalysis.products?.nonHazmat, 0),
       hazmatPercentage: safeNumber(analysis.hazmatAnalysis.products?.percentHazmat, 0),
       shipmentsAnalyzed: safeNumber(analysis.hazmatAnalysis.shipments?.total, totalShipments),
       totalHazmatShipments: safeNumber(analysis.hazmatAnalysis.shipments?.hazmat, 0),
       totalNonHazmatShipments: safeNumber(analysis.hazmatAnalysis.shipments?.nonHazmat, 0),
       shipmentHazmatPercentage: safeNumber(analysis.hazmatAnalysis.shipments?.percentHazmat, 0)
     },
     typeBreakdown: (analysis.hazmatAnalysis.typeBreakdown || []).map(item => ({
       type: item.type || 'Unknown',
       count: safeNumber(item.count, 0),
       percentage: safeNumber(item.percentage, 0)
     })),
     compliance: analysis.hazmatAnalysis.compliance || [],
     products: analysis.hazmatAnalysis.products || {}
   } : null;

   return {
     // Basic metrics
     totalShipments: totalShipments,
     avgWeight: totalShipments > 0 ? safeNumber(totalWeight / totalShipments, 0) : 0,
     avgCost: totalShipments > 0 ? safeNumber(currentTotalCost / totalShipments, 0) : 0,
     analysisMonths: Math.max(1, Math.ceil(safeNumber(analysis.dateRange?.days, 30) / 30)),

     // Date range
     dateRange: {
       start: analysis.dateRange?.start || new Date().toISOString().split('T')[0],
       end: analysis.dateRange?.end || new Date().toISOString().split('T')[0]
     },

     // Domestic vs International
     domesticVsInternational: {
       domestic: totalShipments,
       international: 0,
       domesticPercent: '100%',
       internationalPercent: '0%'
     },

     // 🆕 FIX #2: Top states from stateBreakdown
     topStates: topStates,

     // Warehouse comparison with AMZ Prep
     warehouseComparison: [
       {
         name: 'Current Provider',
         fullAddress: 'Various carriers and locations',
         region: 'Multiple',
         specialty: 'Standard fulfillment',
         costMultiplier: 1.0,
         avgZone: 6,
         transitTime: Math.round(avgTransitTime) || 0,
         cost: Math.round(currentTotalCost) || 0,
         savings: 0,
         savingsPercent: '0%',
         shipments: totalShipments,
         recommended: false
       },
       {
         name: 'AMZ Prep Complete Solution',
         fullAddress: 'Columbus, OH - Central fulfillment hub',
         region: 'Midwest',
         specialty: 'Fast prep + optimized shipping',
         costMultiplier: 0.85,
         avgZone: 5,
         transitTime: amzPrepTransitTime,
         cost: Math.round(proposedTotalCost) || 0,
         savings: Math.round(savingsAmount) || 0,
         savingsPercent: `${savingsPercent.toFixed(1)}%`,
         shipments: totalShipments,
         recommended: savingsAmount > 0
       }
     ],

     // Shipping methods
     shippingMethods: (analysis.carriers || []).map(carrier => ({
       name: carrier.name || 'Unknown',
       count: safeNumber(carrier.count, 0),
       percentage: safeNumber(carrier.percentage, 0)
     })),

     // Weight distribution
     weightDistribution: [
       { range: '0-10 lbs', count: Math.round(totalShipments * 0.3) },
       { range: '10-50 lbs', count: Math.round(totalShipments * 0.4) },
       { range: '50-150 lbs', count: Math.round(totalShipments * 0.2) },
       { range: '150+ lbs', count: Math.round(totalShipments * 0.1) }
     ],

     // Zone distribution
     zoneDistribution: [
       { zone: 4, count: Math.round(totalShipments * 0.2), percentage: '20%' },
       { zone: 5, count: Math.round(totalShipments * 0.3), percentage: '30%' },
       { zone: 6, count: Math.round(totalShipments * 0.3), percentage: '30%' },
       { zone: 7, count: Math.round(totalShipments * 0.2), percentage: '20%' }
     ],

     // 🆕 FIX #4: Hazmat data
     hazmat: hazmatData,

     // ENHANCED METADATA
     metadata: {
       dataFormat: 'smash_foods_actual',

       // Current costs breakdown
       currentCosts: {
         totalFreight: Math.round(safeNumber(analysis.currentCosts?.totalFreight, 0)),
         totalPlacementFees: Math.round(safeNumber(analysis.currentCosts?.totalPlacementFees, 0)),
         totalCost: Math.round(currentTotalCost),
         costPerCuft: safeNumber(analysis.currentCosts?.costPerCuft, 0),
         costPerUnit: safeNumber(analysis.currentCosts?.costPerUnit, 0),
         costPerPallet: safeNumber(analysis.currentCosts?.costPerPallet, 0)
       },

       // Proposed costs - support both SOP and combined formats
       proposedCosts: {
         sop: {
           mmCost: Math.round(safeNumber(analysis.proposedCosts?.sop?.mmCost, 0)),
           internalTransferCost: Math.round(safeNumber(analysis.proposedCosts?.sop?.internalTransferCost, 0)),
           totalFreightCost: Math.round(proposedTotalCost),
           mmCostPT: Math.round(safeNumber(analysis.proposedCosts?.sop?.mmCostPT, 0)),
           costPerCuft: safeNumber(analysis.proposedCosts?.sop?.costPerCuft, 0),
           costPerUnit: safeNumber(analysis.proposedCosts?.sop?.costPerUnit, 0),
           costPerPallet: safeNumber(analysis.proposedCosts?.sop?.costPerPallet, 0),
           breakdown: (analysis.proposedCosts?.sop?.breakdown || []).map(item => ({
             type: item.type || 'Unknown',
             description: item.description || '',
             cost: Math.round(safeNumber(item.cost, 0))
           }))
         }
       },

       // Savings calculation
       savings: {
         amount: Math.round(savingsAmount),
         percent: safeNumber(savingsPercent, 0),
         currentTotal: Math.round(currentTotalCost),
         proposedTotal: Math.round(proposedTotalCost)
       },

       // 🆕 FIX #3: Recommendations
       recommendations: recommendations,

       // Carrier information
       carriers: (analysis.carriers || []).map(carrier => ({
         name: carrier.name || 'Unknown',
         count: safeNumber(carrier.count, 0),
         percentage: safeNumber(carrier.percentage, 0)
       })),

       // 🆕 FIX #1: Timeline metrics
       avgPrepTime: safeNumber(analysis.avgPrepTime, 0),
       avgTransitTime: Math.round(avgTransitTime),
       amzPrepTransitTime: amzPrepTransitTime,
       transitImprovement: transitImprovement,
       transitImprovementPercent: transitImprovementPercent,

       // Shipment splitting
       splitShipments: safeNumber(analysis.splitShipments, 0),
       splitShipmentRate: safeNumber(analysis.splitShipmentRate, 0),

       // Additional metrics
       totalUnits: safeNumber(totalUnits, 0),
       totalPallets: safeNumber(totalPallets, 0),
       totalCuft: safeNumber(totalCuft, 0),
       totalWeight: safeNumber(totalWeight, 0),

       // State-level details
       stateDetails: analysis.stateBreakdown || {},

       // Executive summary
       executiveSummary: analysis.insights?.executiveSummary || analysis.executiveSummary || {
         title: 'Smash Foods Freight Analysis',
         subtitle: `${totalShipments} Shipments`,
         keyFindings: []
       },

       // Monthly breakdown
       monthlyBreakdown: analysis.metadata?.monthlyBreakdown || analysis.monthlyBreakdown || null,
       shipMethodBreakdown: analysis.metadata?.shipMethodBreakdown || analysis.shipMethodBreakdown || null,

       // 🆕 FIX #5: From Zip breakdown
       fromZipBreakdown: analysis.metadata?.fromZipBreakdown || analysis.fromZipBreakdown || null
     }
   };
 }

async function generateUSMapVisualization(topStates, mapType = 'volume') {
  const width = 1200;
  const height = 520;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.imageSmoothingEnabled = false;

  // Background
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#0f172a');
  gradient.addColorStop(1, '#1e293b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Header
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px Arial';
  ctx.textBaseline = 'top';
  const title = mapType === 'volume' ? 'Shipping Volume Heat Map' : 'Average Cost Heat Map';
  ctx.fillText(title, 40, 25);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px Arial';
  const subtitle = mapType === 'volume'
    ? 'Distribution by state shipping volume'
    : 'Distribution by average shipping cost per order';
  ctx.fillText(subtitle, 40, 58);

  // [Keep the same US map drawing code from previous version]
  const offsetX = 80;
  const offsetY = 100;

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 12;

  ctx.beginPath();
  ctx.moveTo(offsetX + 40, offsetY + 15);
  ctx.lineTo(offsetX + 35, offsetY + 45);
  ctx.lineTo(offsetX + 30, offsetY + 70);
  ctx.quadraticCurveTo(offsetX + 25, offsetY + 100, offsetX + 30, offsetY + 130);
  ctx.lineTo(offsetX + 35, offsetY + 160);
  ctx.lineTo(offsetX + 50, offsetY + 180);
  ctx.lineTo(offsetX + 90, offsetY + 190);
  ctx.lineTo(offsetX + 130, offsetY + 195);
  ctx.lineTo(offsetX + 170, offsetY + 200);
  ctx.lineTo(offsetX + 220, offsetY + 210);
  ctx.lineTo(offsetX + 260, offsetY + 208);
  ctx.lineTo(offsetX + 290, offsetY + 198);
  ctx.lineTo(offsetX + 305, offsetY + 190);
  ctx.lineTo(offsetX + 320, offsetY + 185);
  ctx.lineTo(offsetX + 345, offsetY + 180);
  ctx.lineTo(offsetX + 365, offsetY + 185);
  ctx.lineTo(offsetX + 380, offsetY + 195);
  ctx.lineTo(offsetX + 390, offsetY + 210);
  ctx.lineTo(offsetX + 395, offsetY + 230);
  ctx.lineTo(offsetX + 392, offsetY + 245);
  ctx.lineTo(offsetX + 385, offsetY + 255);
  ctx.lineTo(offsetX + 378, offsetY + 245);
  ctx.lineTo(offsetX + 370, offsetY + 220);
  ctx.lineTo(offsetX + 360, offsetY + 195);
  ctx.lineTo(offsetX + 365, offsetY + 175);
  ctx.lineTo(offsetX + 375, offsetY + 160);
  ctx.lineTo(offsetX + 385, offsetY + 145);
  ctx.lineTo(offsetX + 395, offsetY + 135);
  ctx.lineTo(offsetX + 405, offsetY + 125);
  ctx.quadraticCurveTo(offsetX + 413, offsetY + 115, offsetX + 418, offsetY + 105);
  ctx.lineTo(offsetX + 425, offsetY + 90);
  ctx.lineTo(offsetX + 430, offsetY + 75);
  ctx.lineTo(offsetX + 438, offsetY + 62);
  ctx.lineTo(offsetX + 445, offsetY + 48);
  ctx.lineTo(offsetX + 452, offsetY + 30);
  ctx.lineTo(offsetX + 458, offsetY + 18);
  ctx.lineTo(offsetX + 448, offsetY + 15);
  ctx.lineTo(offsetX + 420, offsetY + 20);
  ctx.lineTo(offsetX + 395, offsetY + 25);
  ctx.quadraticCurveTo(offsetX + 370, offsetY + 18, offsetX + 345, offsetY + 25);
  ctx.quadraticCurveTo(offsetX + 320, offsetY + 20, offsetX + 295, offsetY + 28);
  ctx.quadraticCurveTo(offsetX + 270, offsetY + 22, offsetX + 245, offsetY + 30);
  ctx.quadraticCurveTo(offsetX + 225, offsetY + 25, offsetX + 205, offsetY + 35);
  ctx.lineTo(offsetX + 185, offsetY + 30);
  ctx.lineTo(offsetX + 165, offsetY + 25);
  ctx.lineTo(offsetX + 145, offsetY + 22);
  ctx.lineTo(offsetX + 125, offsetY + 20);
  ctx.lineTo(offsetX + 105, offsetY + 18);
  ctx.lineTo(offsetX + 85, offsetY + 16);
  ctx.lineTo(offsetX + 65, offsetY + 18);
  ctx.lineTo(offsetX + 50, offsetY + 20);
  ctx.closePath();
  ctx.stroke();
  ctx.shadowBlur = 0;

  const statePositions = {
    'WA': { x: offsetX + 50, y: offsetY + 35 }, 'OR': { x: offsetX + 50, y: offsetY + 70 }, 'CA': { x: offsetX + 50, y: offsetY + 140 },
    'ID': { x: offsetX + 80, y: offsetY + 50 }, 'MT': { x: offsetX + 110, y: offsetY + 35 }, 'WY': { x: offsetX + 130, y: offsetY + 60 },
    'NV': { x: offsetX + 70, y: offsetY + 110 }, 'UT': { x: offsetX + 100, y: offsetY + 110 }, 'CO': { x: offsetX + 140, y: offsetY + 105 },
    'AZ': { x: offsetX + 80, y: offsetY + 160 }, 'NM': { x: offsetX + 130, y: offsetY + 165 },
    'ND': { x: offsetX + 160, y: offsetY + 40 }, 'SD': { x: offsetX + 165, y: offsetY + 65 }, 'NE': { x: offsetX + 170, y: offsetY + 95 },
    'KS': { x: offsetX + 175, y: offsetY + 125 }, 'OK': { x: offsetX + 175, y: offsetY + 158 }, 'TX': { x: offsetX + 200, y: offsetY + 195 },
    'MN': { x: offsetX + 195, y: offsetY + 50 }, 'IA': { x: offsetX + 205, y: offsetY + 85 }, 'MO': { x: offsetX + 210, y: offsetY + 125 },
    'AR': { x: offsetX + 215, y: offsetY + 158 }, 'LA': { x: offsetX + 255, y: offsetY + 190 },
    'WI': { x: offsetX + 230, y: offsetY + 60 }, 'IL': { x: offsetX + 240, y: offsetY + 100 }, 'MI': { x: offsetX + 265, y: offsetY + 60 },
    'IN': { x: offsetX + 255, y: offsetY + 100 }, 'OH': { x: offsetX + 285, y: offsetY + 100 },
    'MS': { x: offsetX + 265, y: offsetY + 170 }, 'AL': { x: offsetX + 290, y: offsetY + 170 }, 'TN': { x: offsetX + 280, y: offsetY + 138 },
    'KY': { x: offsetX + 290, y: offsetY + 118 }, 'WV': { x: offsetX + 315, y: offsetY + 115 }, 'VA': { x: offsetX + 345, y: offsetY + 120 },
    'NC': { x: offsetX + 355, y: offsetY + 145 }, 'SC': { x: offsetX + 345, y: offsetY + 165 }, 'GA': { x: offsetX + 320, y: offsetY + 170 },
    'FL': { x: offsetX + 355, y: offsetY + 210 },
    'PA': { x: offsetX + 350, y: offsetY + 95 }, 'MD': { x: offsetX + 365, y: offsetY + 110 }, 'DE': { x: offsetX + 378, y: offsetY + 108 },
    'NJ': { x: offsetX + 383, y: offsetY + 95 }, 'NY': { x: offsetX + 375, y: offsetY + 70 },
    'CT': { x: offsetX + 400, y: offsetY + 82 }, 'RI': { x: offsetX + 410, y: offsetY + 80 }, 'MA': { x: offsetX + 415, y: offsetY + 68 },
    'VT': { x: offsetX + 390, y: offsetY + 55 }, 'NH': { x: offsetX + 405, y: offsetY + 52 }, 'ME': { x: offsetX + 430, y: offsetY + 38 }
  };

  const stateDataMap = {};
  topStates.forEach(state => { stateDataMap[state.code] = state; });

  function getColor(state, type) {
    if (!state) return null;
    if (type === 'volume') {
      if (state.percentage >= 15) return '#1e40af';
      if (state.percentage >= 10) return '#2563eb';
      if (state.percentage >= 5) return '#3b82f6';
      return '#60a5fa';
    } else {
      const cost = state.avgCost || 0;
      if (cost >= 16) return '#dc2626';
      if (cost >= 14) return '#f97316';
      if (cost >= 12) return '#fbbf24';
      return '#34d399';
    }
  }

  function getSize(state, type) {
    if (!state) return 0;
    if (type === 'volume') {
      if (state.percentage >= 15) return 42;
      if (state.percentage >= 10) return 34;
      if (state.percentage >= 5) return 28;
      return 22;
    } else {
      const cost = state.avgCost || 0;
      if (cost >= 16) return 42;
      if (cost >= 14) return 34;
      if (cost >= 12) return 28;
      return 22;
    }
  }

  Object.entries(statePositions).forEach(([code, pos]) => {
    const stateData = stateDataMap[code];
    if (stateData) {
      const color = getColor(stateData, mapType);
      const size = getSize(stateData, mapType);

      ctx.shadowColor = color;
      ctx.shadowBlur = 35;
      ctx.fillStyle = color + '20';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size / 2 + 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 20;
      ctx.fillStyle = color + '50';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size / 2 + 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff40';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(code, pos.x, pos.y);
      ctx.shadowBlur = 0;
    }
  });

  // Legend
  const legendY = height - 55;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.roundRect(30, legendY - 28, width - 60, 58, 10);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 17px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('● Legend', 50, legendY - 5);

  let legendX = 180;
  const legendSpacing = 220;

  if (mapType === 'volume') {
    const volumeLegend = [
      { color: '#60a5fa', label: 'Low Volume', range: '(1-4%)', size: 22 },
      { color: '#3b82f6', label: 'Medium', range: '(5-9%)', size: 28 },
      { color: '#2563eb', label: 'High', range: '(10-14%)', size: 34 },
      { color: '#1e40af', label: 'Very High', range: '(15%+)', size: 42 }
    ];

    volumeLegend.forEach(item => {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(legendX, legendY, item.size / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, legendX + 32, legendY - 4);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px Arial';
      ctx.fillText(item.range, legendX + 32, legendY + 11);

      legendX += legendSpacing;
    });
  } else {
    const costLegend = [
      { color: '#34d399', label: 'Low Cost', range: '($0-12)', size: 22 },
      { color: '#fbbf24', label: 'Medium', range: '($12-14)', size: 28 },
      { color: '#f97316', label: 'High', range: '($14-16)', size: 34 },
      { color: '#dc2626', label: 'Very High', range: '($16+)', size: 42 }
    ];

    costLegend.forEach(item => {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(legendX, legendY, item.size / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, legendX + 32, legendY - 4);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px Arial';
      ctx.fillText(item.range, legendX + 32, legendY + 11);

      legendX += legendSpacing;
    });
  }

  // Top 5 Panel
  const panelX = width - 235;
  const panelY = 100;
  const rowHeight = 36;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.roundRect(panelX - 18, panelY, 225, 210, 12);
  ctx.fill();

  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 19px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('⭐ Top 5 States', panelX, panelY + 23);

  let listY = panelY + 57;
  topStates.slice(0, 5).forEach((state, idx) => {
    const color = getColor(state, mapType);
    const value = mapType === 'volume' ? `${state.percentage}%` : `$${state.avgCost}`;

    const rankGradient = ctx.createLinearGradient(panelX + 5, listY - 14, panelX + 18, listY + 14);
    rankGradient.addColorStop(0, '#475569');
    rankGradient.addColorStop(1, '#334155');
    ctx.fillStyle = rankGradient;
    ctx.beginPath();
    ctx.arc(panelX + 13, listY, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${idx + 1}`, panelX + 13, listY + 1);

    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(state.code, panelX + 35, listY + 1);

    ctx.fillStyle = color + '30';
    ctx.roundRect(panelX + 125, listY - 13, 68, 26, 5);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.font = 'bold 17px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(value, panelX + 186, listY + 1);

    listY += rowHeight;
  });

  return canvas.toBuffer('image/png', { compressionLevel: 3, filters: canvas.PNG_FILTER_NONE });
}

// ============================================================================
// ULTRA-OPTIMIZED generatePDF - MAXIMUM PERFORMANCE
// ============================================================================

async function generatePDF(data, outputPath) {
  const startTime = Date.now();

  return new Promise(async (resolve, reject) => {
    let browser = null;

    try {
      console.log('🚀 Starting PDF generation...');

      // ========== PARALLEL: LOAD LOGO + PREPARE DATA ==========
      const [logoBase64, brandName] = await Promise.all([
        // Load logo in parallel
        (async () => {
          const logoFormats = ['amzprep_white_logo.png', 'amzprep_white_logo.jpg', 'amzprep_white_logo.jpeg'];
          for (const logoFile of logoFormats) {
            try {
              const logoPath = path.join(__dirname, logoFile);
              if (fs.existsSync(logoPath)) {
                const buffer = fs.readFileSync(logoPath);
                const ext = logoFile.split('.').pop();
                const mime = ext === 'jpg' ? 'jpeg' : ext;
                return `data:image/${mime};base64,${buffer.toString('base64')}`;
              }
            } catch (err) {}
          }
          return '';
        })(),

        // Extract brand name in parallel
        (async () => {
          if (data.metadata?.brandName) return data.metadata.brandName;
          if (!data.filename) return 'Client Report';
          return data.filename
            .replace(/\.(xlsx|xls|csv)$/i, '')
            .replace(/^(AMZ-Prep-|Data-|Analysis-|Copy of |copy of )/i, '')
            .replace(/-\d{4}-\d{2}-\d{2}/g, '')
            .replace(/[_-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        })()
      ]);

      // ========== EXTRACT DATA (OPTIMIZED) ==========
      const m = data.metadata || {};
      const cc = m.currentCosts || {};
      const pc = m.proposedCosts?.sop || {};
      const sv = m.savings || {};

      const cuft = m.totalCuft || 1;
      const ccTotal = cc.totalCost || 0;
      const ccFreight = cc.totalFreight || 0;
      const ccPlace = cc.totalPlacementFees || 0;
      const ccPerCuft = cc.costPerCuft || (ccTotal / cuft);

      const pcTotal = pc.totalFreightCost || 0;
      const pcMM = pc.mmCost || 0;
      const pcInt = pc.internalTransferCost || 0;
      const pcPerCuft = pc.costPerCuft || (pcTotal / cuft);
      const pcPat = pc.pattern || 'KY';

      const isInc = (sv.amount || 0) < 0;
      const svAmt = Math.abs(sv.amount || 0);
      const svPct = Math.abs(sv.percent || 0);

      const tCur = m.avgTransitTime || 0;
      const tAmz = m.amzPrepTransitTime || 0;
      const tImp = m.transitImprovement || Math.abs(tCur - tAmz) || 0;

      const avgMo = (sv.amount || 0) / (data.analysisMonths || 1);
      const cfRate = (sv.amount || 0) / cuft;

      // Limited data for performance
      const monthly = (m.monthlyBreakdown || []).slice(0, 5);
      const fromZip = (m.fromZipBreakdown || []).slice(0, 5);
      const states = (data.topStates || []).slice(0, 7);

      // ========== MINIMAL HTML (ULTRA-COMPRESSED) ==========
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}@page{margin:0}body{font-family:-apple-system,sans-serif;background:linear-gradient(180deg,#000 0%,#050814 20%,#070b1a 30%,#091332 50%,#091332 100%);color:#fff;padding:38px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{page-break-after:always;min-height:940px}.page:last-child{page-break-after:auto}.logo{height:24px;margin-bottom:24px}.brand{font-size:28px;font-weight:700;color:#0386FE;margin-bottom:8px;text-transform:uppercase}.sub{font-size:13px;color:#94a3b8;margin-bottom:6px}.date{font-size:10px;color:#64748b;margin-bottom:28px}h2{font-size:16px;font-weight:700;margin:24px 0 16px}.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:28px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:28px}.card{background:rgba(9,19,50,.6);border:2px solid #0386FE;border-radius:8px;padding:14px;text-align:center;min-height:90px}.card.red{border-color:#ef4444}.card.green{border-color:#10b981}.card.blue{border-color:#0386FE}.card.gray{border-color:#475569}.lbl{font-size:9px;font-weight:700;color:#0386FE;margin-bottom:8px;text-transform:uppercase}.lbl.red{color:#ef4444}.lbl.green{color:#10b981}.val{font-size:28px;font-weight:700;margin-bottom:6px}.val.sm{font-size:22px}.val.md{font-size:26px}.sub2{font-size:9px;color:#94a3b8}.cost{background:rgba(9,19,50,.6);border:2px solid #475569;border-radius:8px;padding:16px;min-height:135px}.cost.blue{border-color:#0386FE}.cost.save{background:linear-gradient(180deg,${isInc?'#dc2626':'#059669'} 0%,${isInc?'#991b1b':'#047857'} 100%);border-color:${isInc?'#ef4444':'#10b981'};text-align:center;display:flex;flex-direction:column;justify-content:center}.ct{font-size:12px;font-weight:700;margin-bottom:10px}.ct.blue{color:#0386FE}.cr{display:flex;justify-content:space-between;font-size:10px;margin-bottom:6px}.crl{color:#94a3b8}.crv{font-weight:600}.cd{border-top:1px solid #475569;margin:10px 0}.ct2{display:flex;justify-content:space-between;font-weight:700;margin-top:8px}.ctl{font-size:11px}.ctv{font-size:16px}.sva{font-size:36px;font-weight:700;margin:8px 0}.svp{font-size:20px;margin-bottom:6px;font-weight:600}.svl{font-size:10px;opacity:.9}.svs{font-size:9px;opacity:.75;margin-top:6px}table{width:100%;border-collapse:collapse;margin-bottom:24px}thead{background:#0386FE}th{padding:10px 8px;font-size:9px;font-weight:700;text-transform:uppercase}td{padding:8px;font-size:10px;border-bottom:1px solid rgba(71,85,105,.3)}tr:nth-child(even){background:rgba(15,20,25,.4)}.bar{margin-bottom:24px}.bi{display:flex;align-items:center;margin-bottom:10px}.bl{width:110px;font-size:11px;font-weight:600}.bt{flex:1;height:24px;background:rgba(15,20,25,.6);border-radius:4px;overflow:hidden}.bf{height:100%;background:#0386FE;border-radius:4px}.bv{width:100px;text-align:right;font-size:11px;font-weight:600;margin-left:10px}.bk{background:rgba(9,19,50,.6);border:1.5px solid #0386FE;border-radius:8px;padding:14px;margin-bottom:12px}.bkt{font-size:12px;font-weight:700;margin-bottom:6px}.bkv{font-size:20px;font-weight:700;color:#0386FE;float:right}.bkd{font-size:9px;color:#94a3b8;margin-top:6px;clear:both}.rec{background:rgba(9,19,50,.6);border:2px solid;border-radius:8px;padding:14px;margin-bottom:12px;position:relative}.rec.hi{border-color:#ef4444}.rec.md{border-color:#f59e0b}.badge{position:absolute;top:12px;right:12px;padding:4px 10px;border-radius:4px;font-size:8px;font-weight:700;text-transform:uppercase}.badge.hi{background:rgba(127,29,29,.8);color:#ef4444}.badge.md{background:rgba(120,53,15,.8);color:#f59e0b}.rt{font-size:13px;font-weight:700;margin-bottom:8px;padding-right:100px}.rd{font-size:10px;color:#94a3b8;line-height:1.5}.mg{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:16px;background:#1a1f2e;border-radius:6px}.mc{background:linear-gradient(135deg,#0386FE,#0066cc);border-radius:6px;padding:10px;text-align:center}</style></head><body>
<div class="page">${logoBase64?`<img src="${logoBase64}" class="logo" alt="AMZ Prep">`:'<div style="font-size:18px;font-weight:700;margin-bottom:24px">amz prep</div>'}<div class="brand">${brandName.toUpperCase()}</div><div class="sub">FBA Shipping Analysis Report</div><div class="date">${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div><h2>Key Metrics</h2><div class="grid4"><div class="card"><div class="lbl">Total Shipments</div><div class="val">${(data.totalShipments||0).toLocaleString()}</div><div class="sub2">${(m.totalUnits||0).toLocaleString()} units</div></div><div class="card"><div class="lbl">Total Pallets</div><div class="val">${(m.totalPallets||0).toLocaleString()}</div><div class="sub2">${Math.round(cuft).toLocaleString()} cuft</div></div><div class="card ${isInc?'red':'green'}"><div class="lbl ${isInc?'red':'green'}">${isInc?'Additional Cost':'Savings'}</div><div class="val">$${svAmt.toLocaleString()}</div><div class="sub2">${svPct.toFixed(1)}% ${isInc?'increase':'savings'}</div></div><div class="card"><div class="lbl">Transit Time</div><div class="val sm">${tCur}d → ${tAmz}d</div><div class="sub2" style="color:#10b981">-${tImp} days</div></div></div><h2>Cost Comparison</h2><div class="grid3"><div class="cost gray"><div class="ct">Current Provider</div><div class="cr"><span class="crl">Freight:</span><span class="crv">$${ccFreight.toLocaleString()}</span></div><div class="cr"><span class="crl">Placement:</span><span class="crv">$${ccPlace.toLocaleString()}</span></div><div class="cd"></div><div class="ct2"><span class="ctl">Total:</span><span class="ctv">$${ccTotal.toLocaleString()}</span></div><div class="cr" style="margin-top:8px"><span class="crl">Cost/Cuft:</span><span class="crv" style="color:#fbbf24;font-weight:700">$${ccPerCuft.toFixed(2)}</span></div></div><div class="cost blue"><div class="ct blue">AMZ Prep</div><div class="cr"><span class="crl">Middle Mile:</span><span class="crv">${pcPat}</span></div><div class="cr"><span class="crl">Internal Transfer:</span><span class="crv">$${pcInt.toLocaleString()}</span></div><div class="cd" style="border-color:rgba(3,134,254,.3)"></div><div class="ct2"><span class="ctl" style="color:#0386FE">Total:</span><span class="ctv" style="color:#0386FE">$${pcTotal.toLocaleString()}</span></div><div class="cr" style="margin-top:8px"><span class="crl">Cost/Cuft:</span><span class="crv" style="color:#0386FE;font-weight:700">$${pcPerCuft.toFixed(2)}</span></div></div><div class="cost save"><div class="ct">${isInc?'Additional Cost':'Your Savings'}</div><div class="sva">$${svAmt.toLocaleString()}</div><div class="svp">${svPct.toFixed(1)}%</div><div class="svl">vs current provider</div><div class="svs">Cuft Rate: ${isInc?'+':'-'}$${Math.abs(cfRate).toFixed(2)}</div></div></div>${monthly.length>0?`<h2>Monthly Breakdown</h2><table><thead><tr><th>MONTH</th><th style="text-align:center">#</th><th style="text-align:right">UNITS</th><th style="text-align:right">CUFT</th><th style="text-align:right">CLIENT</th><th style="text-align:right">MM</th></tr></thead><tbody>${monthly.map(x=>`<tr><td style="font-weight:600">${x.month}</td><td style="text-align:center">${x.shipmentCount}</td><td style="text-align:right">${(x.qty||0).toLocaleString()}</td><td style="text-align:right">${Math.round(x.totalCuft||0).toLocaleString()}</td><td style="text-align:right;font-weight:600">$${Math.round(x.clientTotalFees||0).toLocaleString()}</td><td style="text-align:right;color:#0386FE;font-weight:600">$${Math.round(x.mmCost||0).toLocaleString()}</td></tr>`).join('')}</tbody></table>`:''}
</div><div class="page">${fromZip.length>0?`<h2>From Zip Distribution</h2><div class="bar">${fromZip.map(z=>{const max=Math.max(...fromZip.map(x=>x.clientTotalFees||0));const pct=max>0?((z.clientTotalFees/max)*100):0;return`<div class="bi"><div class="bl">${z.fromZip} (${z.state})</div><div class="bt"><div class="bf" style="width:${pct}%"></div></div><div class="bv">$${(z.clientTotalFees||0).toLocaleString()}</div></div>`;}).join('')}</div>`:''}<h2>Summary</h2><div class="grid3"><div class="card ${isInc?'red':'green'}"><div class="lbl ${isInc?'red':'green'}">Avg Monthly</div><div class="val md">$${Math.abs(avgMo).toFixed(0)}</div><div class="sub2">${isInc?'+':'-'}$${Math.abs(ccPerCuft-pcPerCuft).toFixed(2)}/cuft</div></div><div class="card red"><div class="lbl red">YoY</div><div class="val md">${isInc?'+':'-'}${svPct.toFixed(1)}%</div><div class="sub2">${isInc?'increase':'savings'}</div></div><div class="card blue"><div class="lbl">Cost/Cuft</div><div class="val md">$${pcPerCuft.toFixed(2)}</div><div class="sub2">$${ccPerCuft.toFixed(2)} current</div></div></div>${states.length>0?`<h2>USA Volume</h2><div style="background:rgba(15,20,25,.6);border-radius:8px;padding:18px;margin-bottom:24px"><div class="mg">${states.map(s=>`<div class="mc"><div style="font-size:16px;font-weight:700;margin-bottom:2px">${s.code}</div><div style="font-size:20px;font-weight:700;margin-bottom:2px">${s.percentage}%</div><div style="font-size:9px;opacity:.8">$${s.avgCost}</div></div>`).join('')}</div></div><h2>Top States</h2><div class="bar">${states.map(s=>{const pct=parseFloat(s.percentage);return`<div class="bi"><div class="bl">${s.code}</div><div class="bt"><div class="bf" style="width:${pct}%"></div></div><div class="bv">${s.percentage}% <span style="color:#94a3b8;font-size:9px">($${s.avgCost})</span></div></div>`;}).join('')}</div>`:''}
</div><div class="page"><h2>AMZ Prep Costs</h2><div class="bk"><div class="bkt">Middle Mile</div><div class="bkv">$${pcMM.toLocaleString()}</div><div class="bkd">$2.75/Cuft cross-docking</div></div><div class="bk"><div class="bkt">Internal Transfer</div><div class="bkv">$${pcInt.toLocaleString()}</div><div class="bkd">H1, FBA 2 FBA 1.25</div></div><div class="bk"><div class="bkt">Total Freight</div><div class="bkv">$${pcTotal.toLocaleString()}</div><div class="bkd">MM + Internal Transfer</div></div>
</div><div class="page"><h2>Recommendations</h2><div class="rec hi"><div class="badge hi">High Impact</div><div class="rt">Faster Transit Times</div><div class="rd">Reduce transit from ${tCur} to ${tAmz} days - ${tImp>0&&tCur>0?((tImp/tCur)*100).toFixed(1):60}% improvement. Products reach Amazon ${tImp} days faster.</div></div><div class="rec hi"><div class="badge hi">High Impact</div><div class="rt">Reduced Prep Time</div><div class="rd">Streamlined process reduces prep time through optimized labor, bulk processing, and coordination for faster turnaround.</div></div><div class="rec md"><div class="badge md">Medium Impact</div><div class="rt">Geographic Optimization</div><div class="rd">Strategic warehouse placement near high-volume origins optimizes routes and reduces costs by $${Math.abs(cfRate).toFixed(2)}/cuft.</div></div><div class="rec md"><div class="badge md">Medium Impact</div><div class="rt">Volume Discounts</div><div class="rd">Current volume of ${(data.totalShipments||0).toLocaleString()} shipments qualifies for volume discounts. Contact for custom pricing.</div></div>
</div></body></html>`;

      // ========== LAUNCH BROWSER (OPTIMIZED) ==========
      console.log('🌐 Launching browser...');
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-extensions',
          '--disable-dev-tools',
          '--no-first-run',
          '--no-zygote',
          '--single-process'  // ✅ Faster startup
        ]
      });

      const page = await browser.newPage();

      // ✅ Faster settings
      await page.setRequestInterception(false);  // No network interception
      page.setDefaultTimeout(60000);

      console.log('📝 Setting content...');
      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      console.log('📄 Generating PDF...');
      await page.pdf({
        path: outputPath,
        format: 'LETTER',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        preferCSSPageSize: false  // ✅ Faster
      });

      await browser.close();

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ PDF generated in ${elapsed}s`);
      resolve(outputPath);

    } catch (error) {
      console.error('❌ PDF error:', error.message);
      if (browser) {
        try { await browser.close(); } catch (e) {}
      }
      reject(error);
    }
  });
}

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Initiate Google OAuth
app.get('/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

// Google OAuth callback
app.get('/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`
  }),
  (req, res) => {
    console.log('Auth callback - user authenticated:', req.user.email);

    // Generate JWT token
    const token = jwt.sign(
      {
        id: req.user._id.toString(),
        email: req.user.email,
        name: req.user.name,
        picture: req.user.picture,
        role: req.user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('JWT token generated for:', req.user.email);

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }
);

// Logout
app.post('/auth/logout', (req, res) => {
  const email = req.user?.email;
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    console.log('User logged out:', email);
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Get current user info
app.get('/auth/user', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-__v');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Error fetching user data' });
  }
});

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log('Token verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Export middleware for use in other routes
export { authenticateToken };

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AMZ Prep Analytics API is running' });
});

app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {

    // ADD THESE LINES:
    const uploadType = req.body.uploadType || 'amazon'; // 'amazon' or 'shopify'
    const rateType = req.body.rateType || 'prep'; // rate type selected

    console.log(`📁 Upload Type: ${uploadType}, Rate Type: ${rateType}`);

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('📤 File upload from user:', req.user.email);

    console.log('\n📦 ===============================================');
    console.log('   FILE UPLOAD RECEIVED');
    console.log('===============================================');
    console.log(`   File: ${req.file.originalname}`);
    console.log(`   Size: ${(req.file.size / 1024).toFixed(2)} KB`);
    console.log(`   User: ${req.user.email}`);

    // 🆕 Extract cost config from request
    let costConfig = {};
    if (req.body.costConfig) {
      try {
        costConfig = typeof req.body.costConfig === 'string'
          ? JSON.parse(req.body.costConfig)
          : req.body.costConfig;
        console.log('📊 Cost Config received:', costConfig);
      } catch (e) {
        console.warn('⚠️ Could not parse costConfig, using defaults');
      }
    }

    const filePath = req.file.path;
    const { hazmatFilter } = req.body; // NEW - Get filter from request
    const shipments = await parseExcelFile(filePath, hazmatFilter, costConfig || 'all');

    console.log(`   Upload Type: ${uploadType}`);
    console.log(`   Rate Type: ${rateType}`);
    console.log(`   Hazmat Filter: ${hazmatFilter}`);
    console.log('===============================================\n');

    console.log('🔍 Hazmat filter:', hazmatFilter || 'all'); // NEW

    if (shipments.length === 0) {
      // Clean up uploaded file
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'No valid data found in file' });
    }

    const analysis = analyzeShipments(shipments);  // ✅ This should work now

    // ← NEW: Save to MongoDB
    const report = new Report({
      userId: req.user.id,
      userEmail: req.user.email,
      filename: req.file.originalname,
      uploadDate: new Date(),
      uploadType,
      rateType,
      ...analysis,
      // 🆕 Save cost configuration for audit trail
      costConfig: costConfig
    });

    await report.save();
    console.log('✅ Report saved to MongoDB:', report._id);

    // Clean up uploaded file after processing
    setTimeout(() => {
    try {
      // Clean up original file
      fs.unlinkSync(filePath);
      console.log('🗑️  Cleaned up uploaded file:', req.file.filename);

      // Clean up enhanced file if it exists
      const enhancedPath = filePath.replace('.xlsx', '_enhanced.xlsx');
      if (fs.existsSync(enhancedPath)) {
        fs.unlinkSync(enhancedPath);
        console.log('🗑️  Cleaned up enhanced file');
      }
    } catch (err) {
      console.error('Error cleaning up files:', err);
    }
  }, 5000);

    res.json({
      success: true,
      data: analysis,
      reportId: report._id.toString()  // ← NEW: MongoDB _id
    });

  } catch (error) {
    console.error('Upload error:', error);

    // Clean up file on error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {}
    }

    res.status(500).json({ error: 'Error processing file: ' + error.message });
  }
});

app.get('/api/reports', authenticateToken, async (req, res) => {
  try {
    console.log('📋 Fetching reports for user:', req.user.email);

    // Fetch reports sorted by upload date (newest first)
    const reports = await Report.find({ userId: req.user.id })
      .sort({ uploadDate: -1 })
      .select('_id filename uploadDate totalShipments avgCost analysisMonths uploadType')  // ✅ Add uploadType
      .lean();

    console.log(`✅ Found ${reports.length} reports`);

    // Format reports for response
    const reportSummaries = reports.map(r => ({
      id: r._id.toString(),
      filename: r.filename,
      uploadDate: r.uploadDate,
      totalShipments: r.totalShipments,
      avgCost: r.avgCost,
      analysisMonths: r.analysisMonths,
      uploadType: r.uploadType || 'amazon'  // ✅ Add uploadType with default
    }));

    res.json({ reports: reportSummaries });

  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Error fetching reports: ' + error.message });
  }
});

app.get('/api/reports/:id', authenticateToken, async (req, res) => {
  try {
    const reportId = req.params.id;
    console.log('📄 Fetching report:', reportId, 'for user:', req.user.email);

    const report = await Report.findOne({
      _id: reportId,
      userId: req.user.id  // Security: ensure user owns this report
    }).lean();

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    console.log('✅ Report found and sent');

    // Remove MongoDB specific fields
    const { _id, userId, userEmail, __v, createdAt, updatedAt, ...reportData } = report;

    res.json({
      id: _id.toString(),
      ...reportData
    });

  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ error: 'Error fetching report: ' + error.message });
  }
});

// Delete specific report
app.delete('/api/reports/:id', authenticateToken, async (req, res) => {
  try {
    const reportId = req.params.id;
    console.log('🗑️  Deleting report:', reportId, 'for user:', req.user.email);

    const report = await Report.findOneAndDelete({
      _id: reportId,
      userId: req.user.id  // Security: ensure user owns this report
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    console.log('✅ Report deleted successfully');

    res.json({
      success: true,
      message: 'Report deleted successfully',
      deletedReportId: reportId
    });

  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: 'Error deleting report: ' + error.message });
  }
});

app.get('/api/export/pdf/:id', authenticateToken, async (req, res) => {
  try {
    const reportId = req.params.id;
    console.log('📑 Exporting PDF for report:', reportId);

    const report = await Report.findOne({  // ← NEW: MongoDB query
      _id: reportId,
      userId: req.user.id
    }).lean();

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const pdfPath = path.join(uploadsDir, `report-${reportId}-${Date.now()}.pdf`);

    // Remove MongoDB specific fields before PDF generation
    const { _id, userId, userEmail, __v, createdAt, updatedAt, ...reportData } = report;

    // ✅ DEBUG: Check if hazmat data exists
    console.log('\n' + '='.repeat(60));
    console.log('📄 PDF EXPORT DATA CHECK');
    console.log('='.repeat(60));
    console.log('Report ID:', reportId);
    console.log('Report Filename:', report.filename);
    console.log('Total Shipments:', reportData.totalShipments);
    console.log('\n🔥 HAZMAT DATA STATUS:');
    console.log('Has hazmat field:', !!reportData.hazmat);

    if (reportData.hazmat) {
      console.log('✅ Hazmat data IS present');
      console.log('\n📊 Hazmat Overview:');
      if (reportData.hazmat.overview) {
        console.log('  - Total Products:', reportData.hazmat.overview.totalProducts);
        console.log('  - Hazmat Products:', reportData.hazmat.overview.totalHazmatProducts,
          `(${reportData.hazmat.overview.hazmatPercentage}%)`);
        console.log('  - Hazmat Shipments:', reportData.hazmat.overview.totalHazmatShipments,
          `(${reportData.hazmat.overview.shipmentHazmatPercentage}%)`);
      } else {
        console.log('  ⚠️  Overview missing');
      }

      console.log('\n📋 Hazmat Details:');
      console.log('  - Type Breakdown:', reportData.hazmat.typeBreakdown?.length || 0, 'types');
      console.log('  - Geographic Data:', reportData.hazmat.geographic?.topStates?.length || 0, 'states');
      console.log('  - Compliance Alerts:', reportData.hazmat.compliance?.length || 0, 'alerts');
      console.log('  - Sample Products:', reportData.hazmat.sampleProducts?.length || 0, 'products');

      console.log('\n✨ PDF will include 4 pages (2 normal + 2 hazmat pages)');
    } else {
      console.log('❌ Hazmat data is MISSING!');
      console.log('\n⚠️  PDF will only have 2 pages (no hazmat section)');
      console.log('\n🔍 Available report keys:', Object.keys(reportData).slice(0, 20).join(', '));
      console.log('\n💡 To fix:');
      console.log('   1. Verify SmashFoodsIntegration returns hazmat data');
      console.log('   2. Check Report model schema includes hazmat field');
      console.log('   3. Re-upload file to save with hazmat data');
    }

    console.log('='.repeat(60) + '\n');

    await generatePDF(reportData, pdfPath);

    res.download(pdfPath, `AMZ-Prep-Analytics-Report-${reportId}.pdf`, (err) => {
      if (err) {
        console.error('Error sending PDF:', err);
      }
      setTimeout(() => {
        fs.unlink(pdfPath, (unlinkErr) => {
          if (unlinkErr) console.error('Error deleting PDF:', unlinkErr);
        });
      }, 5000);
    });

  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Error generating PDF: ' + error.message });
  }
});

app.use('/api/rates', ratesRouter);

app.use('/api/upload', uploadEnhancedRoutes);

// Admin rate management (requires admin role)
app.use('/api/admin/rates', adminRateUploadRoutes);

app.use('/api/admin', adminUserManagementRoutes);

app.use('/api/admin/fba-zoning', adminFBAZoningRoutes);

// ============================================================================
// PUBLIC TEMPLATE ROUTES - No authentication required
// IMPORTANT: These must be defined BEFORE the catch-all /api route below
// ============================================================================

// Download MM Rate Template (PUBLIC - no auth)
app.get('/api/templates/mm-rate-template', (req, res) => {
  try {
    const templatePath = path.join(__dirname, 'templates', 'rates', 'MM-Rate-Sample-Template.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      // Try alternative path
      const altPath = path.join(__dirname, 'templates', 'MM-Rate-Sample-Template.xlsx');
      if (fs.existsSync(altPath)) {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=MM-Rate-Sample-Template.xlsx');
        const fileStream = fs.createReadStream(altPath);
        return fileStream.pipe(res);
      }

      console.error('Template not found at:', templatePath, 'or', altPath);
      return res.status(404).json({
        success: false,
        error: 'Template file not found'
      });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=MM-Rate-Sample-Template.xlsx');

    // Stream the file
    const fileStream = fs.createReadStream(templatePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error downloading template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download template'
    });
  }
});

// Get list of available templates (PUBLIC - no auth)
app.get('/api/templates', (req, res) => {
  try {
    const templates = [
      {
        id: 'mm-rate-template',
        name: 'MM Rate Template',
        description: 'Sample rate template for shipping cost analysis',
        filename: 'MM-Rate-Sample-Template.xlsx',
        downloadUrl: '/api/templates/mm-rate-template'
      }
      // Add more templates here as needed
    ];

    res.json({ success: true, templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates'
    });
  }
});

// ============================================================================
// CATCH-ALL AUTHENTICATED ROUTES - Must be AFTER public routes
// ============================================================================
app.use('/api', authenticateToken, separateUploadRoutes);

app.listen(PORT, () => {
  console.log(`🚀 AMZ Prep Analytics API running on http://localhost:${PORT}`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
});

export { parseExcelFile, analyzeShipments };
