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

//app.use(cors());

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600, // lazy session update (seconds)
    crypto: {
      secret: process.env.SESSION_SECRET
    }
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

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

async function parseExcelFile(filePath, hazmatFilter = 'all') {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet);

  console.log(`📊 Parsing ${data.length} rows from Excel file`);

  const firstRow = data[0];
  if (!firstRow) {
    console.error('❌ No data found in file');
    return [];
  }

  // Detect format
  const detection = detectFileFormat(firstRow);

  console.log(`📋 Detected format: ${getFormatDisplayName(detection.format).toUpperCase()} (${detection.confidence}% confidence)`);

  if (detection.indicators && detection.indicators.length > 0) {
    console.log(`📋 Key indicators:`, detection.indicators.join(', '));
  }

  // Route to appropriate parser
  switch (detection.format) {
    case 'smash_foods':
      return await parseSmashFoodsFormat(filePath, hazmatFilter || 'all');  // ✓ Uses filePath

    case 'muscle_mac':
      return await parseMuscleMacFormat(filePath, hazmatFilter || 'all');  // ✅ FIXED - now uses filePath with await

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
async function parseMuscleMacFormat(filePath, hazmatFilter = 'all') {
  console.log('🔄 Processing Muscle Mac (Inv Water) format...');
  console.log('   File path:', filePath);
  console.log('   Using Smash Foods integration with Muscle Mac column mapping');
  console.log(`   Hazmat filter: ${hazmatFilter}`);

  try {
    const integration = new SmashFoodsIntegration();

    // Muscle Mac uses same calculation logic as Smash Foods
    // Just different column names in Data sheet
    const analysis = await integration.analyzeSmashFoodsFile(
      filePath,
      'combined',  // rate type
      0.10,       // 10% markup
      hazmatFilter // Pass filter here too
    );

    console.log('✅ Muscle Mac analysis complete');
    console.log(`   Total Shipments: ${analysis.totalShipments}`);
    console.log(`   Total Pallets: ${analysis.totalPallets}`);
    console.log(`   Total Cuft: ${analysis.totalCuft?.toFixed(2)}`);
    console.log(`   Savings: $${analysis.savings?.amount?.toFixed(2)}`);

    // Return with special flag (same as Smash Foods)
    return [{
      __smashFoodsAnalysis: true,
      analysis: {
        ...analysis,
        // Mark as Muscle Mac format for frontend
        metadata: {
          ...analysis.metadata,
          dataFormat: 'muscle_mac_actual',
          originalFormat: 'muscle_mac'
        },
        executiveSummary: {
          ...analysis.executiveSummary,
          title: 'Inv Water Freight Analysis'  // Different title
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
async function parseSmashFoodsFormat(filePath, hazmatFilter = 'all') {
  console.log('🚀 Processing Smash Foods format with FULL AUTOMATION...');
  console.log(`   File path: ${filePath}`);
  console.log(`   Hazmat filter: ${hazmatFilter}`); // NEW
  console.log('   Using Smash Foods integration');

  try {
    const integration = new SmashFoodsIntegration();

    // Run complete automated analysis using Analysis (Pallet) sheet formulas
    const analysis = await integration.analyzeSmashFoodsFile(
      filePath,
      'combined', // rate type
      0.10, // 10% markup
      hazmatFilter // NEW PARAMETER
    );

    console.log('✅ Smash Foods analysis complete');
    console.log(`   Total Shipments: ${analysis.totalShipments}`);
    console.log(`   Total Pallets: ${analysis.totalPallets}`);
    console.log(`   Total Cuft: ${analysis.totalCuft?.toFixed(2)}`);
    console.log(`   Hazmat Products: ${analysis.hazmat.products.hazmat}`);
    console.log(`   Current Total: $${analysis.currentCosts?.totalCost?.toFixed(2)}`);
    console.log(`   AMZ Prep Total: $${analysis.proposedCosts?.combined?.totalCost?.toFixed(2)}`);
    console.log(`   Savings: $${analysis.savings?.amount?.toFixed(2)} (${analysis.savings?.amount >= 0 ? 'SAVINGS' : 'INCREASE'})`);

    // IMPORTANT: Return a special marker object that tells analyzeShipments()
    // that this is already a complete Smash Foods analysis
    return [{
      __smashFoodsAnalysis: true,
      analysis: {
        ...analysis,
        metadata: {
          ...analysis.metadata,
          dataFormat: 'smash_foods_actual',
          originalFormat: 'smash_foods',
          hazmatFilter // Track filter in metadata
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

  // Proposed costs
  const proposedTotalCost = safeNumber(analysis.proposedCosts?.combined?.totalCost, 0);
  const patternCost = safeNumber(analysis.proposedCosts?.combined?.patternCost, 0);
  const internalCost = safeNumber(analysis.proposedCosts?.combined?.internalCost, 0);
  const amzPrepCost = safeNumber(analysis.proposedCosts?.combined?.amzPrepCost, 0);

  // Savings
  const savingsAmount = safeNumber(analysis.savings?.amount, 0);
  const savingsPercent = safeNumber(analysis.savings?.percent, 0);

  // Transit times
  const avgTransitTime = safeNumber(analysis.avgTransitTime, 0);
  const amzPrepTransitTime = safeNumber(analysis.amzPrepTransitTime, 6);
  const transitImprovement = safeNumber(analysis.transitImprovement, 0);

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

    // Domestic vs International (all domestic for Smash Foods)
    domesticVsInternational: {
      domestic: totalShipments,
      international: 0,
      domesticPercent: '100%',
      internationalPercent: '0%'
    },

    // Top states (from Smash Foods geographic analysis)
    topStates: (analysis.topStates || []).map(state => ({
      name: state.state || 'Unknown',
      code: state.state || 'XX',
      volume: safeNumber(state.count, 1),
      percentage: safeNumber(state.percentage, 0),
      avgCost: safeNumber(state.count, 1) > 0
        ? Math.round(safeNumber(state.currentCost, 0) / safeNumber(state.count, 1))
        : 0
    })),

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

    // Shipping methods (from carrier analysis)
    shippingMethods: (analysis.carriers || []).map(carrier => ({
      name: carrier.name || 'Unknown',
      count: safeNumber(carrier.count, 0),
      percentage: safeNumber(carrier.percentage, 0)
    })),

    // Weight distribution (estimated)
    weightDistribution: [
      { range: '0-10 lbs', count: Math.round(totalShipments * 0.3) },
      { range: '10-50 lbs', count: Math.round(totalShipments * 0.4) },
      { range: '50-150 lbs', count: Math.round(totalShipments * 0.2) },
      { range: '150+ lbs', count: Math.round(totalShipments * 0.1) }
    ],

    // Zone distribution (from state data)
    zoneDistribution: [
      { zone: 4, count: Math.round(totalShipments * 0.2), percentage: '20%' },
      { zone: 5, count: Math.round(totalShipments * 0.3), percentage: '30%' },
      { zone: 6, count: Math.round(totalShipments * 0.3), percentage: '30%' },
      { zone: 7, count: Math.round(totalShipments * 0.2), percentage: '20%' }
    ],

    hazmat: analysis.hazmat || null,

    // ENHANCED METADATA - Store complete Smash Foods analysis
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

      // Proposed costs with detailed breakdown using Analysis sheet formulas
      proposedCosts: {
        combined: {
          patternCost: Math.round(patternCost),
          internalCost: Math.round(internalCost),
          freightOnlyCost: Math.round(safeNumber(analysis.proposedCosts?.combined?.freightOnlyCost, 0)),
          amzPrepCost: Math.round(amzPrepCost),
          totalCost: Math.round(proposedTotalCost),
          costPerCuft: safeNumber(analysis.proposedCosts?.combined?.costPerCuft, 0),
          costPerUnit: safeNumber(analysis.proposedCosts?.combined?.costPerUnit, 0),
          costPerPallet: safeNumber(analysis.proposedCosts?.combined?.costPerPallet, 0),
          breakdown: (analysis.proposedCosts?.combined?.breakdown || []).map(item => ({
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

      // Recommendations
      recommendations: (analysis.recommendations || []).map(rec => ({
        type: rec.type || 'general',
        title: rec.title || 'Recommendation',
        description: rec.description || '',
        impact: rec.impact || 'medium',
        savings: rec.savings ? Math.round(safeNumber(rec.savings, 0)) : undefined,
        improvement: rec.improvement ? safeNumber(rec.improvement, 0) : undefined
      })),

      // Carrier information
      carriers: (analysis.carriers || []).map(carrier => ({
        name: carrier.name || 'Unknown',
        count: safeNumber(carrier.count, 0),
        percentage: safeNumber(carrier.percentage, 0)
      })),

      // Timeline metrics
      avgPrepTime: safeNumber(analysis.avgPrepTime, 0),
      avgTransitTime: Math.round(avgTransitTime),
      amzPrepTransitTime: amzPrepTransitTime,
      transitImprovement: transitImprovement,
      transitImprovementPercent: safeNumber(analysis.transitImprovementPercent, 0),

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
      executiveSummary: analysis.executiveSummary || {
        title: 'Smash Foods Freight Analysis',
        subtitle: `${totalShipments} Shipments | ${totalUnits.toLocaleString()} Units | ${totalPallets} Pallets`,
        keyFindings: []
      }
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
   const currentTotalCost = safeNumber(analysis.currentCosts?.totalCost, 0);
   const proposedTotalCost = safeNumber(analysis.proposedCosts?.combined?.totalCost, 0);
   const savingsAmount = safeNumber(analysis.savings?.amount, 0);
   const savingsPercent = safeNumber(analysis.savings?.percent, 0);
   const avgTransitTime = safeNumber(analysis.avgTransitTime, 0);
   const amzPrepTransitTime = safeNumber(analysis.amzPrepTransitTime, 6);

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

     // Domestic vs International (all domestic for Smash Foods)
     domesticVsInternational: {
       domestic: totalShipments,
       international: 0,
       domesticPercent: '100%',
       internationalPercent: '0%'
     },

     // Top states (from Smash Foods geographic analysis)
     topStates: (analysis.topStates || []).map(state => {
       const stateCount = safeNumber(state.count, 1);
       const stateCost = safeNumber(state.currentCost, 0);

       return {
         name: state.state || 'Unknown',
         code: state.state || 'XX',
         volume: stateCount,
         percentage: safeNumber(state.percentage, 0),
         avgCost: stateCount > 0 ? Math.round(stateCost / stateCount) : 0
       };
     }),

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

     // Shipping methods (from carrier analysis)
     shippingMethods: (analysis.carriers || []).map(carrier => ({
       name: carrier.name || 'Unknown',
       count: safeNumber(carrier.count, 0),
       percentage: safeNumber(carrier.percentage, 0)
     })),

     // Weight distribution (estimated)
     weightDistribution: [
       { range: '0-10 lbs', count: Math.round(totalShipments * 0.3) },
       { range: '10-50 lbs', count: Math.round(totalShipments * 0.4) },
       { range: '50-150 lbs', count: Math.round(totalShipments * 0.2) },
       { range: '150+ lbs', count: Math.round(totalShipments * 0.1) }
     ],

     // Zone distribution (from state data)
     zoneDistribution: [
       { zone: 4, count: Math.round(totalShipments * 0.2), percentage: '20%' },
       { zone: 5, count: Math.round(totalShipments * 0.3), percentage: '30%' },
       { zone: 6, count: Math.round(totalShipments * 0.3), percentage: '30%' },
       { zone: 7, count: Math.round(totalShipments * 0.2), percentage: '20%' }
     ],

     hazmat: analysis.hazmat || null,

     // ENHANCED METADATA - Store complete Smash Foods analysis
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

       // Proposed costs with detailed breakdown
       proposedCosts: {
         combined: {
           palletCost: Math.round(safeNumber(analysis.proposedCosts?.combined?.palletCost, 0)),
           cuftCost: Math.round(safeNumber(analysis.proposedCosts?.combined?.cuftCost, 0)),
           prepCost: Math.round(safeNumber(analysis.proposedCosts?.combined?.prepCost, 0)),
           middleMileCost: Math.round(safeNumber(analysis.proposedCosts?.combined?.middleMileCost, 0)),
           totalCost: Math.round(proposedTotalCost),
           costPerCuft: safeNumber(analysis.proposedCosts?.combined?.costPerCuft, 0),
           costPerUnit: safeNumber(analysis.proposedCosts?.combined?.costPerUnit, 0),
           costPerPallet: safeNumber(analysis.proposedCosts?.combined?.costPerPallet, 0),
           breakdown: (analysis.proposedCosts?.combined?.breakdown || []).map(item => ({
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

       // Recommendations
       recommendations: (analysis.recommendations || []).map(rec => ({
         type: rec.type || 'general',
         title: rec.title || 'Recommendation',
         description: rec.description || '',
         impact: rec.impact || 'medium',
         savings: rec.savings ? Math.round(safeNumber(rec.savings, 0)) : undefined,
         improvement: rec.improvement ? safeNumber(rec.improvement, 0) : undefined
       })),

       // Carrier information
       carriers: (analysis.carriers || []).map(carrier => ({
         name: carrier.name || 'Unknown',
         count: safeNumber(carrier.count, 0),
         percentage: safeNumber(carrier.percentage, 0)
       })),

       // Timeline metrics
       avgPrepTime: safeNumber(analysis.avgPrepTime, 0),
       avgTransitTime: Math.round(avgTransitTime),
       amzPrepTransitTime: amzPrepTransitTime,
       transitImprovement: safeNumber(analysis.transitImprovement, 0),
       transitImprovementPercent: safeNumber(analysis.transitImprovementPercent, 0),

       // Shipment splitting analysis
       splitShipments: safeNumber(analysis.splitShipments, 0),
       splitShipmentRate: safeNumber(analysis.splitShipmentRate, 0),

       // Additional metrics
       totalUnits: safeNumber(totalUnits, 0),
       totalPallets: safeNumber(analysis.totalPallets, 0),
       totalCuft: safeNumber(analysis.totalCuft, 0),
       totalWeight: safeNumber(totalWeight, 0),

       // State-level details
       stateDetails: analysis.stateBreakdown || {},

       // Executive summary
       executiveSummary: analysis.executiveSummary || {
         title: 'Smash Foods Freight Analysis',
         subtitle: `${totalShipments} Shipments`,
         keyFindings: []
       }
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

async function generatePDF(data, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      function safeNumber(value, decimals = 2) {
        const num = parseFloat(value);
        if (isNaN(num)) return '0' + (decimals > 0 ? '.' + '0'.repeat(decimals) : '');
        return num.toFixed(decimals);
      }

      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        bufferPages: true,
        autoFirstPage: false
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const pageHeight = 792;
      const pageWidth = 612;
      const footerSpace = 70;

      function addFooter() {
        const footerY = pageHeight - 50;
        doc.moveTo(40, footerY).lineTo(pageWidth - 40, footerY)
          .strokeColor('#334155').lineWidth(1).stroke();

        doc.fontSize(8).fillColor('#64748b').font('Helvetica-Bold');
        const text1 = 'AMZ Prep Shipping Analytics';
        const w1 = doc.widthOfString(text1);
        doc.text(text1, (pageWidth - w1) / 2, footerY + 10, { lineBreak: false });

        doc.fontSize(7).fillColor('#475569').font('Helvetica');
        const text2 = 'Confidential Report';
        const w2 = doc.widthOfString(text2);
        doc.text(text2, (pageWidth - w2) / 2, footerY + 22, { lineBreak: false });
      }

      // Load logo
      let logoBuffer = null;
      const logoFormats = ['amzprep_white_logo.jpg', 'amzprep_white_logo.png', 'amzprep_white_logo.jpeg'];
      for (const logoFile of logoFormats) {
        try {
          const logoPath = path.join(__dirname, logoFile);
          if (fs.existsSync(logoPath)) {
            logoBuffer = fs.readFileSync(logoPath);
            break;
          }
        } catch (err) {}
      }

      // ========== PAGE 1 ==========
      doc.addPage();
      doc.rect(0, 0, pageWidth, pageHeight).fill('#0a0e1a');

      let yPos = 40;

      // Header
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 40, yPos, { width: 110, height: 28 });
        } catch {
          doc.fontSize(22).fillColor('#ffffff').font('Helvetica-Bold');
          doc.text('AMZ Prep', 40, yPos, { lineBreak: false });
        }
      } else {
        doc.fontSize(22).fillColor('#ffffff').font('Helvetica-Bold');
        doc.text('AMZ Prep', 40, yPos, { lineBreak: false });
      }

      doc.fontSize(10).fillColor('#94a3b8').font('Helvetica-Bold');
      doc.text('Shipping Analytics Report', pageWidth - 180, 42, {
        width: 140,
        align: 'right',
        lineBreak: false
      });

      doc.fontSize(8).fillColor('#64748b').font('Helvetica');
      doc.text(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        pageWidth - 180, 56, {
          width: 140,
          align: 'right',
          lineBreak: false
        });

      yPos = 90;

      // Title
      doc.fontSize(20).fillColor('#ffffff').font('Helvetica-Bold');
      doc.text('Shipping Analytics Dashboard', 40, yPos, { lineBreak: false });

      yPos += 30;

      doc.fontSize(9).fillColor('#94a3b8').font('Helvetica');
      doc.text('Comprehensive analysis and optimization recommendations', 40, yPos, {
        width: 450,
        lineBreak: false
      });

      yPos += 25;

      // ✨ Define variables that will be used throughout
      const totalShipments = parseInt(data.totalShipments) || 0;
      const analysisMonths = parseInt(data.analysisMonths) || 1;

      // ✨ Check if we have rich Smash Foods metadata
      const hasMetadata = data.metadata && data.metadata.dataFormat === 'smash_foods_actual';

      if (hasMetadata) {
        // ========== RICH SMASH FOODS METRICS (4 BOXES) ==========
        const boxWidth = 130;
        const boxHeight = 70;
        const boxGap = 8;
        const meta = data.metadata;

        // Box 1: Total Shipments with Units
        doc.roundedRect(40, yPos, boxWidth, boxHeight, 8)
          .lineWidth(2).fillAndStroke('#1a1f2e', '#3b82f6');

        doc.fontSize(8).fillColor('#94a3b8').font('Helvetica-Bold');
        doc.text('TOTAL SHIPMENTS', 50, yPos + 12, {
          width: boxWidth - 20,
          align: 'center',
          lineBreak: false
        });

        doc.fontSize(24).fillColor('#60a5fa').font('Helvetica-Bold');
        doc.text(totalShipments.toLocaleString(), 50, yPos + 28, {
          width: boxWidth - 20,
          align: 'center',
          lineBreak: false
        });

        doc.fontSize(7).fillColor('#64748b').font('Helvetica');
        doc.text(`${(meta.totalUnits || 0).toLocaleString()} units`, 50, yPos + 54, {
          width: boxWidth - 20,
          align: 'center',
          lineBreak: false
        });

        // Box 2: Total Pallets with Cuft
        const box2X = 40 + boxWidth + boxGap;
        doc.roundedRect(box2X, yPos, boxWidth, boxHeight, 8)
          .lineWidth(2).fillAndStroke('#1a1f2e', '#a78bfa');

        doc.fontSize(8).fillColor('#94a3b8').font('Helvetica-Bold');
        doc.text('TOTAL PALLETS', box2X + 10, yPos + 12, {
          width: boxWidth - 20,
          align: 'center',
          lineBreak: false
        });

        doc.fontSize(24).fillColor('#a78bfa').font('Helvetica-Bold');
        doc.text((meta.totalPallets || 0).toString(), box2X + 10, yPos + 28, {
          width: boxWidth - 20,
          align: 'center',
          lineBreak: false
        });

        doc.fontSize(7).fillColor('#64748b').font('Helvetica');
        doc.text(`${safeNumber(meta.totalCuft, 2)} cuft`, box2X + 10, yPos + 54, {
          width: boxWidth - 20,
          align: 'center',
          lineBreak: false
        });

        // Box 3: Potential Savings
        const box3X = box2X + boxWidth + boxGap;
        const savings = meta.savings || {};
        const isSavings = (savings.amount || 0) > 0;
        const savingsColor = isSavings ? '#34d399' : '#ef4444';

        doc.roundedRect(box3X, yPos, boxWidth, boxHeight, 8)
          .lineWidth(2).fillAndStroke('#1a1f2e', savingsColor);

        doc.fontSize(8).fillColor('#94a3b8').font('Helvetica-Bold');
        doc.text(isSavings ? 'POTENTIAL SAVINGS' : 'ADDITIONAL COST', box3X + 10, yPos + 12, {
          width: boxWidth - 20,
          align: 'center',
          lineBreak: false
        });

        doc.fontSize(20).fillColor(savingsColor).font('Helvetica-Bold');
        const savingsAmount = Math.abs(savings.amount || 0);
        doc.text(`$${savingsAmount.toLocaleString()}`, box3X + 10, yPos + 28, {
          width: boxWidth - 20,
          align: 'center',
          lineBreak: false
        });

        doc.fontSize(7).fillColor('#64748b').font('Helvetica');
        const savingsPercent = safeNumber(Math.abs(savings.percent || 0), 1);
        doc.text(`${savingsPercent}% ${isSavings ? 'savings' : 'increase'}`,
          box3X + 10, yPos + 54, {
          width: boxWidth - 20,
          align: 'center',
          lineBreak: false
        });

        // Box 4: Transit Time
        const box4X = box3X + boxWidth + boxGap;
        doc.roundedRect(box4X, yPos, boxWidth, boxHeight, 8)
          .lineWidth(2).fillAndStroke('#1a1f2e', '#fbbf24');

        doc.fontSize(8).fillColor('#94a3b8').font('Helvetica-Bold');
        doc.text('TRANSIT TIME', box4X + 10, yPos + 12, {
          width: boxWidth - 20,
          align: 'center',
          lineBreak: false
        });

        const currentTransit = meta.avgTransitTime || meta.transitImprovement?.currentTransitDays || 0;
        const amzTransit = meta.amzPrepTransitTime || meta.transitImprovement?.amzPrepTransitDays || 0;
        const improvement = Math.abs(meta.transitImprovement?.improvementDays || (currentTransit - amzTransit) || 0);

        doc.fontSize(18).fillColor('#fbbf24').font('Helvetica-Bold');
        doc.text(`${currentTransit} → ${amzTransit} days`, box4X + 10, yPos + 28, {
          width: boxWidth - 20,
          align: 'center',
          lineBreak: false
        });

        doc.fontSize(7).fillColor('#34d399').font('Helvetica');
        doc.text(`-${improvement} days faster`, box4X + 10, yPos + 54, {
          width: boxWidth - 20,
          align: 'center',
          lineBreak: false
        });

        yPos += boxHeight + 18;

        // ========== COST COMPARISON SECTION ==========
        doc.fontSize(14).fillColor('#ffffff').font('Helvetica-Bold');
        doc.text('Cost Comparison Analysis', 40, yPos, { lineBreak: false });

        yPos += 20;

        const compBoxW = (pageWidth - 110) / 3;
        const compBoxH = 95;
        const compGap = 10;

        // Current Provider Box
        doc.roundedRect(40, yPos, compBoxW, compBoxH, 8)
          .lineWidth(1).fillAndStroke('#1a1f2e', '#334155');

        doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold');
        doc.text('Current Provider', 50, yPos + 10, {
          width: compBoxW - 20,
          align: 'center',
          lineBreak: false
        });

        const current = meta.currentCosts || {};
        const currentFreight = parseInt(current.totalFreight || 0);
        const currentPlacement = parseInt(current.totalPlacementFees || 0);
        const currentTotal = parseInt(current.totalCost || 0);

        doc.fontSize(8).fillColor('#94a3b8').font('Helvetica');
        doc.text('Freight:', 50, yPos + 28, { lineBreak: false });
        doc.fillColor('#e2e8f0');
        doc.text(`$${currentFreight.toLocaleString()}`, 50 + compBoxW - 90, yPos + 28, {
          width: 70,
          align: 'right',
          lineBreak: false
        });

        doc.fillColor('#94a3b8');
        doc.text('Placement Fees:', 50, yPos + 42, { lineBreak: false });
        doc.fillColor('#e2e8f0');
        doc.text(`$${currentPlacement.toLocaleString()}`, 50 + compBoxW - 90, yPos + 42, {
          width: 70,
          align: 'right',
          lineBreak: false
        });

        doc.moveTo(50, yPos + 56).lineTo(40 + compBoxW - 10, yPos + 56)
          .strokeColor('#475569').lineWidth(1).stroke();

        doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold');
        doc.text('Total:', 50, yPos + 62, { lineBreak: false });
        doc.text(`$${currentTotal.toLocaleString()}`, 50 + compBoxW - 90, yPos + 62, {
          width: 70,
          align: 'right',
          lineBreak: false
        });

        // AMZ Prep Solution Box
        const box2CompX = 40 + compBoxW + compGap;
        doc.roundedRect(box2CompX, yPos, compBoxW, compBoxH, 8)
          .lineWidth(2).fillAndStroke('#1a1f2e', '#3b82f6');

        doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold');
        doc.text('AMZ Prep Solution', box2CompX + 10, yPos + 10, {
          width: compBoxW - 20,
          align: 'center',
          lineBreak: false
        });

        const proposed = meta.proposedCosts?.combined || {};
        const patternCost = parseInt(proposed.patternCost || 0);
        const internalCost = parseInt(proposed.internalCost || 0);
        const proposedTotal = parseInt(proposed.totalCost || 0);

        doc.fontSize(8).fillColor('#94a3b8').font('Helvetica');
        doc.text('Pattern (DC→FBA):', box2CompX + 10, yPos + 28, { lineBreak: false });
        doc.fillColor('#60a5fa');
        doc.text(`$${patternCost.toLocaleString()}`, box2CompX + compBoxW - 80, yPos + 28, {
          width: 60,
          align: 'right',
          lineBreak: false
        });

        doc.fillColor('#94a3b8');
        doc.text('Internal (Whse→DC):', box2CompX + 10, yPos + 42, { lineBreak: false });
        doc.fillColor('#60a5fa');
        doc.text(`$${internalCost.toLocaleString()}`, box2CompX + compBoxW - 80, yPos + 42, {
          width: 60,
          align: 'right',
          lineBreak: false
        });

        doc.fillColor('#94a3b8').fontSize(7);
        doc.text('After 9.86% discount:', box2CompX + 10, yPos + 52, { lineBreak: false });
        doc.fillColor('#34d399').fontSize(8);
        doc.text(`$${proposedTotal.toLocaleString()}`, box2CompX + compBoxW - 80, yPos + 52, {
          width: 60,
          align: 'right',
          lineBreak: false
        });

        doc.moveTo(box2CompX + 10, yPos + 62).lineTo(box2CompX + compBoxW - 10, yPos + 62)
          .strokeColor('#3b82f6').lineWidth(1).stroke();

        doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold');
        doc.text('Total:', box2CompX + 10, yPos + 68, { lineBreak: false });
        doc.fillColor('#60a5fa');
        doc.text(`$${proposedTotal.toLocaleString()}`, box2CompX + compBoxW - 80, yPos + 68, {
          width: 60,
          align: 'right',
          lineBreak: false
        });

        // Your Savings Box
        const box3CompX = box2CompX + compBoxW + compGap;
        const savingsBoxColor = isSavings ? '#34d399' : '#ef4444';
        const savingsBoxBg = isSavings ? '#064e3b' : '#7f1d1d';

        doc.roundedRect(box3CompX, yPos, compBoxW, compBoxH, 8)
          .lineWidth(2).fillAndStroke(savingsBoxBg, savingsBoxColor);

        doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold');
        doc.text('Your Savings', box3CompX + 10, yPos + 10, {
          width: compBoxW - 20,
          align: 'center',
          lineBreak: false
        });

        doc.fontSize(28).fillColor(savingsBoxColor).font('Helvetica-Bold');
        doc.text(`$${savingsAmount.toLocaleString()}`, box3CompX + 10, yPos + 32, {
          width: compBoxW - 20,
          align: 'center',
          lineBreak: false
        });

        doc.fontSize(18).fillColor(savingsBoxColor).font('Helvetica-Bold');
        doc.text(`${savingsPercent}%`, box3CompX + 10, yPos + 62, {
          width: compBoxW - 20,
          align: 'center',
          lineBreak: false
        });

        doc.fontSize(7).fillColor('#94a3b8').font('Helvetica');
        doc.text('Potential savings', box3CompX + 10, yPos + 82, {
          width: compBoxW - 20,
          align: 'center',
          lineBreak: false
        });

        yPos += compBoxH + 18;

      } else {
        // ========== FALLBACK: ORIGINAL 3 BOXES (for non-Smash Foods data) ==========
        const boxWidth = 170;
        const boxHeight = 75;
        const boxGap = 10;

        // Box 1: Total Shipments
        doc.roundedRect(40, yPos, boxWidth, boxHeight, 8)
          .lineWidth(2).fillAndStroke('#1a1f2e', '#3b82f6');

        doc.fontSize(9).fillColor('#94a3b8').font('Helvetica-Bold');
        doc.text('TOTAL SHIPMENTS', 50, yPos + 14, {
          width: boxWidth - 20,
          align: 'center',
          lineBreak: false
        });

        doc.fontSize(28).fillColor('#60a5fa').font('Helvetica-Bold');
        doc.text(totalShipments.toLocaleString(), 50, yPos + 32, {
          width: boxWidth - 20,
          align: 'center',
          lineBreak: false
        });

        doc.fontSize(7).fillColor('#64748b').font('Helvetica');
        doc.text(`${analysisMonths} month analysis`, 50, yPos + 60, {
          width: boxWidth - 20,
          align: 'center',
          lineBreak: false
        });

        // Box 2: Avg Cost
        const box2X = 40 + boxWidth + boxGap;
        doc.roundedRect(box2X, yPos, boxWidth, boxHeight, 8)
          .lineWidth(2).fillAndStroke('#1a1f2e', '#34d399');

        doc.fontSize(9).fillColor('#94a3b8').font('Helvetica-Bold');
        doc.text('AVG COST/SHIPMENT', box2X + 10, yPos + 14, {
          width: boxWidth - 20,
          align: 'center',
          lineBreak: false
        });

        doc.fontSize(28).fillColor('#34d399').font('Helvetica-Bold');
        doc.text(`$${safeNumber(data.avgCost, 2)}`, box2X + 10, yPos + 32, {
          width: boxWidth - 20,
          align: 'center',
          lineBreak: false
        });

        doc.fontSize(7).fillColor('#64748b').font('Helvetica');
        doc.text('Per shipment', box2X + 10, yPos + 60, {
          width: boxWidth - 20,
          align: 'center',
          lineBreak: false
        });

        // Box 3: Avg Weight
        const box3X = box2X + boxWidth + boxGap;
        doc.roundedRect(box3X, yPos, boxWidth, boxHeight, 8)
          .lineWidth(2).fillAndStroke('#1a1f2e', '#a78bfa');

        doc.fontSize(9).fillColor('#94a3b8').font('Helvetica-Bold');
        doc.text('AVG WEIGHT', box3X + 10, yPos + 14, {
          width: boxWidth - 20,
          align: 'center',
          lineBreak: false
        });

        doc.fontSize(28).fillColor('#a78bfa').font('Helvetica-Bold');
        doc.text(`${safeNumber(data.avgWeight, 1)}`, box3X + 10, yPos + 32, {
          width: boxWidth - 20,
          align: 'center',
          lineBreak: false
        });

        doc.fontSize(7).fillColor('#64748b').font('Helvetica');
        doc.text('pounds (lbs)', box3X + 10, yPos + 60, {
          width: boxWidth - 20,
          align: 'center',
          lineBreak: false
        });

        yPos += boxHeight + 18;
      }

      // Recommendation Banner
      const recommended = data.warehouseComparison.find(w => w.recommended);
      if (recommended) {
        doc.roundedRect(40, yPos, pageWidth - 80, 75, 10)
          .fillAndStroke('#1e40af', '#3b82f6');

        doc.fontSize(8).fillColor('#bfdbfe').font('Helvetica-Bold');
        doc.text('★ RECOMMENDED WAREHOUSE', 60, yPos + 12, { lineBreak: false });

        doc.fontSize(20).fillColor('#ffffff').font('Helvetica-Bold');
        doc.text(recommended.name || 'N/A', 60, yPos + 28, { lineBreak: false });

        // Three metrics side by side
        doc.fontSize(7).fillColor('#bfdbfe').font('Helvetica');
        doc.text('Avg Cost', 60, yPos + 54, { lineBreak: false });

        const recCost = totalShipments > 0 ? safeNumber(recommended.cost / totalShipments, 2) : '0.00';
        doc.fontSize(13).fillColor('#ffffff').font('Helvetica-Bold');
        doc.text(`$${recCost}`, 60, yPos + 62, { lineBreak: false });

        doc.fontSize(7).fillColor('#bfdbfe').font('Helvetica');
        doc.text('Savings', 200, yPos + 54, { lineBreak: false });

        const recSavings = parseInt(recommended.savings) || 0;
        doc.fontSize(13).fillColor('#34d399').font('Helvetica-Bold');
        doc.text(`$${recSavings.toLocaleString()}`, 200, yPos + 62, { lineBreak: false });

        doc.fontSize(7).fillColor('#bfdbfe').font('Helvetica');
        doc.text('Percentage', 340, yPos + 54, { lineBreak: false });

        const recPercent = safeNumber(recommended.savingsPercent, 1);
        doc.fontSize(13).fillColor('#fbbf24').font('Helvetica-Bold');
        doc.text(`${recPercent}%`, 340, yPos + 62, { lineBreak: false });

        yPos += 75 + 18;
      }

      // Three Columns
      const colW = 170;
      const colH = 145;
      const colGap = 10;

      // Column 1
      doc.roundedRect(40, yPos, colW, colH, 8)
        .lineWidth(1).fillAndStroke('#1a1f2e', '#334155');

      doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold');
      doc.text('Shipping Methods', 50, yPos + 12, {
        width: colW - 20,
        align: 'center',
        lineBreak: false
      });

      let methodY = yPos + 35;
      const methods = Array.isArray(data.shippingMethods) ? data.shippingMethods.slice(0, 3) : [];
      methods.forEach((method) => {
        const methodName = (method.name || 'Unknown').substring(0, 18);
        const methodPct = safeNumber(method.percentage, 1);

        doc.fontSize(8).fillColor('#e2e8f0').font('Helvetica');
        doc.text(methodName, 50, methodY, { width: colW - 70, lineBreak: false });

        doc.fontSize(8).fillColor('#60a5fa').font('Helvetica-Bold');
        doc.text(`${methodPct}%`, 50 + colW - 60, methodY, { width: 50, align: 'right', lineBreak: false });

        const barW = colW - 20;
        const fillW = (parseFloat(methodPct) / 100) * barW;

        doc.roundedRect(50, methodY + 12, barW, 6, 3).fill('#0f172a');
        if (fillW > 0) {
          doc.roundedRect(50, methodY + 12, fillW, 6, 3).fill('#34d399');
        }

        methodY += 33;
      });

      // Column 2
      const col2X = 40 + colW + colGap;
      doc.roundedRect(col2X, yPos, colW, colH, 8)
        .lineWidth(1).fillAndStroke('#1a1f2e', '#334155');

      doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold');
      doc.text('Weight Distribution', col2X + 10, yPos + 12, {
        width: colW - 20,
        align: 'center',
        lineBreak: false
      });

      let weightY = yPos + 35;
      const weights = Array.isArray(data.weightDistribution) ? data.weightDistribution : [];
      weights.forEach((weight) => {
        const weightCount = parseInt(weight.count) || 0;
        const pct = totalShipments > 0 ? (weightCount / totalShipments * 100) : 0;

        doc.fontSize(8).fillColor('#e2e8f0').font('Helvetica');
        doc.text(weight.range || 'Unknown', col2X + 10, weightY, { width: 80, lineBreak: false });

        doc.fontSize(8).fillColor('#60a5fa').font('Helvetica-Bold');
        doc.text(`${pct.toFixed(0)}%`, col2X + colW - 50, weightY, { width: 40, align: 'right', lineBreak: false });

        const barW = colW - 20;
        const fillW = pct / 100 * barW;

        doc.roundedRect(col2X + 10, weightY + 12, barW, 6, 3).fill('#0f172a');
        if (fillW > 0) {
          doc.roundedRect(col2X + 10, weightY + 12, fillW, 6, 3).fill('#06b6d4');
        }

        weightY += 33;
      });

      // Column 3
      const col3X = col2X + colW + colGap;
      doc.roundedRect(col3X, yPos, colW, colH, 8)
        .lineWidth(1).fillAndStroke('#1a1f2e', '#334155');

      doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold');
      doc.text('Top 7 States', col3X + 10, yPos + 12, {
        width: colW - 20,
        align: 'center',
        lineBreak: false
      });

      let stateY = yPos + 35;
      const topStates = Array.isArray(data.topStates) ? data.topStates.slice(0, 7) : [];
      topStates.forEach((state) => {
        const stateName = (state.name || 'Unknown').substring(0, 12);
        const statePct = safeNumber(state.percentage, 1);
        const stateCost = safeNumber(state.avgCost, 2);

        doc.fontSize(8).fillColor('#e2e8f0').font('Helvetica');
        doc.text(stateName, col3X + 10, stateY, { width: 60, lineBreak: false });

        doc.fontSize(8).fillColor('#60a5fa').font('Helvetica-Bold');
        doc.text(`${statePct}%`, col3X + 75, stateY, { lineBreak: false });

        doc.fontSize(7).fillColor('#94a3b8').font('Helvetica');
        doc.text(`$${stateCost}`, col3X + 115, stateY + 1, { lineBreak: false });

        stateY += 19;
      });

      yPos += colH + 18;

      // Warehouse Table
      doc.fontSize(12).fillColor('#ffffff').font('Helvetica-Bold');
      doc.text('Warehouse Analysis', 40, yPos, { lineBreak: false });

      yPos += 20;

      const tblW = pageWidth - 80;
      const rowH = 20;

      doc.roundedRect(40, yPos, tblW, rowH, 5).fill('#1e293b');

      const headers = ['Warehouse', 'Ships', 'Cost', 'Zone', 'Days', 'Save%', 'Save$'];
      const colPos = [50, 200, 260, 315, 365, 420, 475];

      doc.fontSize(8).fillColor('#94a3b8').font('Helvetica-Bold');
      headers.forEach((h, i) => {
        doc.text(h, colPos[i], yPos + 7, {
          width: i === 0 ? 140 : 45,
          align: i === 0 ? 'left' : 'center',
          lineBreak: false
        });
      });

      yPos += rowH;

      const warehouses = Array.isArray(data.warehouseComparison) ? data.warehouseComparison.slice(0, 6) : [];
      warehouses.forEach((wh, idx) => {
        const rowColor = wh.recommended ? '#1e3a8a' : (idx % 2 === 0 ? '#1a1f2e' : '#0f172a');

        doc.roundedRect(40, yPos, tblW, rowH, 3).fill(rowColor);

        if (wh.recommended) {
          doc.roundedRect(40, yPos, tblW, rowH, 3).lineWidth(1).stroke('#3b82f6');
        }

        const whName = (wh.name || 'Unknown').substring(0, 25);
        doc.fontSize(7).fillColor('#e2e8f0').font('Helvetica-Bold');
        doc.text(wh.recommended ? `★ ${whName}` : whName, colPos[0], yPos + 7, {
          width: 140,
          lineBreak: false
        });

        const whShips = parseInt(wh.shipments) || 0;
        const whCost = parseInt(wh.cost) || 0;
        const whZone = safeNumber(wh.avgZone, 1);
        const whDays = parseInt(wh.transitTime) || 0;

        doc.fontSize(7).fillColor('#cbd5e1').font('Helvetica');
        doc.text(whShips.toLocaleString(), colPos[1], yPos + 7, { width: 45, align: 'center', lineBreak: false });
        doc.text(`$${whCost.toLocaleString()}`, colPos[2], yPos + 7, { width: 45, align: 'center', lineBreak: false });
        doc.text(whZone, colPos[3], yPos + 7, { width: 45, align: 'center', lineBreak: false });
        doc.text(`${whDays}d`, colPos[4], yPos + 7, { width: 45, align: 'center', lineBreak: false });

        if (wh.savingsPercent) {
          const whSavePct = safeNumber(wh.savingsPercent, 1);
          const whSaveAmt = parseInt(wh.savings) || 0;

          doc.fillColor('#34d399').font('Helvetica-Bold');
          doc.text(`${whSavePct}%`, colPos[5], yPos + 7, { width: 45, align: 'center', lineBreak: false });
          doc.text(`$${whSaveAmt.toLocaleString()}`, colPos[6], yPos + 7, { width: 45, align: 'center', lineBreak: false });
        } else {
          doc.fillColor('#475569');
          doc.text('-', colPos[5], yPos + 7, { width: 45, align: 'center', lineBreak: false });
          doc.text('-', colPos[6], yPos + 7, { width: 45, align: 'center', lineBreak: false });
        }

        yPos += rowH;
      });

      addFooter();

      // ========== PAGE 2 ==========
      doc.addPage();
      doc.rect(0, 0, pageWidth, pageHeight).fill('#0a0e1a');

      yPos = 40;

      doc.fontSize(18).fillColor('#ffffff').font('Helvetica-Bold');
      doc.text('Geographic Analysis & Insights', 40, yPos, { lineBreak: false });

      yPos += 32;

      // Generate maps
      const volumeMapBuffer = await generateUSMapVisualization(data.topStates, 'volume');
      const costMapBuffer = await generateUSMapVisualization(data.topStates, 'cost');

      const mapW = 530;
      const mapH = 220;

      if (volumeMapBuffer) {
        doc.roundedRect(38, yPos - 2, mapW + 4, mapH + 4, 10)
          .lineWidth(2).stroke('#334155');
        doc.image(volumeMapBuffer, 40, yPos, { width: mapW, height: mapH });
      }

      yPos += mapH + 16;

      if (costMapBuffer) {
        doc.roundedRect(38, yPos - 2, mapW + 4, mapH + 4, 10)
          .lineWidth(2).stroke('#334155');
        doc.image(costMapBuffer, 40, yPos, { width: mapW, height: mapH });
      }

      yPos += mapH + 18;

      // Insights
      doc.fontSize(14).fillColor('#ffffff').font('Helvetica-Bold');
      doc.text('Key Insights', 40, yPos, { lineBreak: false });

      yPos += 22;

      const insightW = 170;
      const insightH = 68;
      const insightGap = 10;

      const domesticPct = safeNumber(data.domesticVsInternational?.domesticPercent || 0, 0);

      doc.roundedRect(40, yPos, insightW, insightH, 8)
        .lineWidth(1).fillAndStroke('#1a1f2e', '#334155');

      doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold');
      doc.text('Domestic vs Int\'l', 50, yPos + 10, {
        width: insightW - 20,
        align: 'center',
        lineBreak: false
      });

      doc.fontSize(24).fillColor('#34d399').font('Helvetica-Bold');
      doc.text(`${domesticPct}%`, 50, yPos + 26, {
        width: insightW - 20,
        align: 'center',
        lineBreak: false
      });

      doc.fontSize(8).fillColor('#94a3b8').font('Helvetica');
      doc.text('Domestic Orders', 50, yPos + 50, {
        width: insightW - 20,
        align: 'center',
        lineBreak: false
      });

      const topState = topStates[0] || { name: 'N/A', percentage: 0 };
      const ins2X = 40 + insightW + insightGap;

      doc.roundedRect(ins2X, yPos, insightW, insightH, 8)
        .lineWidth(1).fillAndStroke('#1a1f2e', '#334155');

      doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold');
      doc.text('Top Destination', ins2X + 10, yPos + 10, {
        width: insightW - 20,
        align: 'center',
        lineBreak: false
      });

      doc.fontSize(18).fillColor('#60a5fa').font('Helvetica-Bold');
      doc.text(topState.name, ins2X + 10, yPos + 26, {
        width: insightW - 20,
        align: 'center',
        lineBreak: false
      });

      doc.fontSize(8).fillColor('#94a3b8').font('Helvetica');
      doc.text(`${safeNumber(topState.percentage, 1)}% of shipments`, ins2X + 10, yPos + 48, {
        width: insightW - 20,
        align: 'center',
        lineBreak: false
      });

      const topMethod = methods[0] || { name: 'N/A', percentage: 0 };
      const ins3X = ins2X + insightW + insightGap;

      doc.roundedRect(ins3X, yPos, insightW, insightH, 8)
        .lineWidth(1).fillAndStroke('#1a1f2e', '#334155');

      doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold');
      doc.text('Primary Method', ins3X + 10, yPos + 10, {
        width: insightW - 20,
        align: 'center',
        lineBreak: false
      });

      doc.fontSize(16).fillColor('#a78bfa').font('Helvetica-Bold');
      doc.text(topMethod.name, ins3X + 10, yPos + 26, {
        width: insightW - 20,
        align: 'center',
        lineBreak: false
      });

      doc.fontSize(8).fillColor('#94a3b8').font('Helvetica');
      doc.text(`${safeNumber(topMethod.percentage, 1)}% of orders`, ins3X + 10, yPos + 48, {
        width: insightW - 20,
        align: 'center',
        lineBreak: false
      });

      yPos += insightH + 18;

      // Summary Box
      doc.roundedRect(40, yPos, pageWidth - 80, 75, 8)
        .lineWidth(1).fillAndStroke('#1a1f2e', '#334155');

      doc.fontSize(11).fillColor('#ffffff').font('Helvetica-Bold');
      doc.text('Executive Summary', 60, yPos + 10, { lineBreak: false });

      const recName = recommended?.name || 'N/A';
      const recSavings = parseInt(recommended?.savings) || 0;
      const recSavePct = safeNumber(recommended?.savingsPercent || 0, 1);

      const summary = `Analysis of ${totalShipments.toLocaleString()} shipments over ${analysisMonths} months. Recommended configuration: ${recName} with potential savings of $${recSavings.toLocaleString()} (${recSavePct}%). Top destination: ${topState.name} (${safeNumber(topState.percentage, 1)}%). Primary method: ${topMethod.name} (${safeNumber(topMethod.percentage, 1)}%).`;

      doc.fontSize(9).fillColor('#cbd5e1').font('Helvetica');
      doc.text(summary, 60, yPos + 28, {
        width: pageWidth - 120,
        align: 'left',
        lineGap: 1.5
      });

      addFooter();

      // ============================================================================
// CORRECTED HAZMAT PDF SECTION - Add after Page 2 in generatePDF()
// Location: After addFooter() on page 2, BEFORE doc.end()
// ============================================================================

// ========== PAGE 3: HAZMAT ANALYSIS ==========
if (data.hazmat && data.hazmat.overview) {
  doc.addPage();
  doc.rect(0, 0, pageWidth, pageHeight).fill('#0a0e1a');

  let hazmatY = 40;

  // Page Title
  doc.fontSize(18).fillColor('#ffffff').font('Helvetica-Bold');
  doc.text('Hazmat Analysis & Compliance', 40, hazmatY, { lineBreak: false });

  hazmatY += 32;

  // Overview Section with Dark Theme
  doc.roundedRect(40, hazmatY, pageWidth - 80, 100, 8)
    .lineWidth(1).fillAndStroke('#1a1f2e', '#f97316');

  doc.fontSize(12).fillColor('#ffffff').font('Helvetica-Bold');
  doc.text('Hazmat Overview', 60, hazmatY + 12, { lineBreak: false });

  const overview = data.hazmat.overview;

  // Left column
  doc.fontSize(8).fillColor('#94a3b8').font('Helvetica');
  doc.text('Total Products:', 60, hazmatY + 32, { lineBreak: false });
  doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold');
  doc.text((overview.totalProducts || 0).toLocaleString(), 60, hazmatY + 44, { lineBreak: false });

  doc.fontSize(8).fillColor('#94a3b8').font('Helvetica');
  doc.text('Hazmat Products:', 60, hazmatY + 60, { lineBreak: false });
  doc.fontSize(10).fillColor('#f97316').font('Helvetica-Bold');
  doc.text(`${overview.totalHazmatProducts || 0} (${safeNumber(overview.hazmatPercentage, 1)}%)`, 60, hazmatY + 72, { lineBreak: false });

  // Middle column
  doc.fontSize(8).fillColor('#94a3b8').font('Helvetica');
  doc.text('Shipments Analyzed:', 220, hazmatY + 32, { lineBreak: false });
  doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold');
  doc.text((overview.shipmentsAnalyzed || 0).toLocaleString(), 220, hazmatY + 44, { lineBreak: false });

  doc.fontSize(8).fillColor('#94a3b8').font('Helvetica');
  doc.text('Hazmat Shipments:', 220, hazmatY + 60, { lineBreak: false });
  doc.fontSize(10).fillColor('#f97316').font('Helvetica-Bold');
  doc.text(`${overview.totalHazmatShipments || 0} (${safeNumber(overview.shipmentHazmatPercentage, 1)}%)`, 220, hazmatY + 72, { lineBreak: false });

  // Right column
  doc.fontSize(8).fillColor('#94a3b8').font('Helvetica');
  doc.text('Non-Hazmat Products:', 380, hazmatY + 32, { lineBreak: false });
  doc.fontSize(10).fillColor('#34d399').font('Helvetica-Bold');
  doc.text((overview.totalNonHazmatProducts || 0).toLocaleString(), 380, hazmatY + 44, { lineBreak: false });

  doc.fontSize(8).fillColor('#94a3b8').font('Helvetica');
  doc.text('Non-Hazmat Shipments:', 380, hazmatY + 60, { lineBreak: false });
  doc.fontSize(10).fillColor('#34d399').font('Helvetica-Bold');
  doc.text((overview.totalNonHazmatShipments || 0).toLocaleString(), 380, hazmatY + 72, { lineBreak: false });

  hazmatY += 115;

  // Type Breakdown Section
  if (data.hazmat.typeBreakdown && data.hazmat.typeBreakdown.length > 0) {
    doc.fontSize(14).fillColor('#ffffff').font('Helvetica-Bold');
    doc.text('Hazmat Type Distribution', 40, hazmatY, { lineBreak: false });

    hazmatY += 22;

    data.hazmat.typeBreakdown.slice(0, 5).forEach((type) => {
      doc.roundedRect(40, hazmatY, pageWidth - 80, 26, 5)
        .lineWidth(1).fillAndStroke('#1a1f2e', '#334155');

      doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold');
      doc.text(type.type || 'Unknown', 50, hazmatY + 9, { lineBreak: false });

      doc.fontSize(9).fillColor('#f97316').font('Helvetica-Bold');
      doc.text(`${type.count || 0} products`, 250, hazmatY + 9, { lineBreak: false });

      doc.fontSize(9).fillColor('#94a3b8').font('Helvetica');
      doc.text(`${safeNumber(type.percentage, 1)}%`, 380, hazmatY + 9, { lineBreak: false });

      // Progress bar
      const barWidth = 120;
      const fillWidth = (parseFloat(type.percentage) / 100) * barWidth;

      doc.roundedRect(450, hazmatY + 8, barWidth, 10, 5).fill('#0f172a');
      if (fillWidth > 0) {
        doc.roundedRect(450, hazmatY + 8, fillWidth, 10, 5).fill('#f97316');
      }

      hazmatY += 32;
    });
  }

  // Geographic Distribution
  if (data.hazmat.geographic && data.hazmat.geographic.topStates && data.hazmat.geographic.topStates.length > 0) {
    hazmatY += 8;

    doc.fontSize(14).fillColor('#ffffff').font('Helvetica-Bold');
    doc.text('Top Hazmat States', 40, hazmatY, { lineBreak: false });

    hazmatY += 22;

    // Table Header
    doc.roundedRect(40, hazmatY, pageWidth - 80, 20, 5).fill('#1e293b');

    doc.fontSize(8).fillColor('#94a3b8').font('Helvetica-Bold');
    doc.text('State', 50, hazmatY + 7, { width: 60, lineBreak: false });
    doc.text('Shipments', 150, hazmatY + 7, { width: 80, align: 'center', lineBreak: false });
    doc.text('Units', 250, hazmatY + 7, { width: 80, align: 'center', lineBreak: false });
    doc.text('Cu.Ft', 350, hazmatY + 7, { width: 80, align: 'center', lineBreak: false });
    doc.text('% of Total', 450, hazmatY + 7, { width: 80, align: 'center', lineBreak: false });

    hazmatY += 20;

    // Table Rows
    data.hazmat.geographic.topStates.slice(0, 7).forEach((state, idx) => {
      const rowColor = idx % 2 === 0 ? '#1a1f2e' : '#0f172a';

      doc.roundedRect(40, hazmatY, pageWidth - 80, 18, 3).fill(rowColor);

      doc.fontSize(8).fillColor('#e2e8f0').font('Helvetica');
      doc.text(state.state || 'N/A', 50, hazmatY + 6, { width: 60, lineBreak: false });

      doc.fontSize(8).fillColor('#cbd5e1').font('Helvetica');
      doc.text((state.count || 0).toString(), 150, hazmatY + 6, { width: 80, align: 'center', lineBreak: false });
      doc.text((state.units || 0).toLocaleString(), 250, hazmatY + 6, { width: 80, align: 'center', lineBreak: false });
      doc.text(safeNumber(state.cuft, 1), 350, hazmatY + 6, { width: 80, align: 'center', lineBreak: false });

      doc.fontSize(8).fillColor('#f97316').font('Helvetica-Bold');
      doc.text(`${safeNumber(state.percentage, 1)}%`, 450, hazmatY + 6, { width: 80, align: 'center', lineBreak: false });

      hazmatY += 18;
    });
  }

  addFooter();

  // ========== PAGE 4: COMPLIANCE & METRICS ==========
  if ((data.hazmat.compliance && data.hazmat.compliance.length > 0) ||
      (data.hazmat.shipments && data.hazmat.shipments.hazmatMetrics)) {

    doc.addPage();
    doc.rect(0, 0, pageWidth, pageHeight).fill('#0a0e1a');

    let compY = 40;

    // Compliance Section
    if (data.hazmat.compliance && data.hazmat.compliance.length > 0) {
      doc.fontSize(18).fillColor('#ffffff').font('Helvetica-Bold');
      doc.text('Compliance Alerts & Recommendations', 40, compY, { lineBreak: false });

      compY += 28;

      data.hazmat.compliance.slice(0, 5).forEach((alert) => {
        const iconMap = { error: '❌', warning: '⚠️', info: 'ℹ️' };
        const icon = iconMap[alert.type] || '•';

        const colorMap = {
          error: '#dc2626',
          warning: '#f97316',
          info: '#3b82f6'
        };
        const borderColor = colorMap[alert.type] || '#334155';

        doc.roundedRect(40, compY, pageWidth - 80, 60, 8)
          .lineWidth(2).fillAndStroke('#1a1f2e', borderColor);

        doc.fontSize(11).fillColor('#ffffff').font('Helvetica-Bold');
        doc.text(`${icon} ${alert.title || 'Alert'}`, 60, compY + 12, {
          width: pageWidth - 120,
          lineBreak: false
        });

        doc.fontSize(8).fillColor('#cbd5e1').font('Helvetica');
        doc.text(alert.message || '', 60, compY + 28, {
          width: pageWidth - 120,
          lineGap: 1.2
        });

        compY += 68;
      });

      compY += 10;
    }

    // Metrics Comparison
    if (data.hazmat.shipments && data.hazmat.shipments.hazmatMetrics) {
      doc.fontSize(14).fillColor('#ffffff').font('Helvetica-Bold');
      doc.text('Hazmat vs Non-Hazmat Metrics', 40, compY, { lineBreak: false });

      compY += 22;

      const hMetrics = data.hazmat.shipments.hazmatMetrics || {};
      const nhMetrics = data.hazmat.shipments.nonHazmatMetrics || {};

      // Table Header
      doc.roundedRect(40, compY, pageWidth - 80, 24, 5).fill('#1e293b');

      doc.fontSize(9).fillColor('#94a3b8').font('Helvetica-Bold');
      doc.text('Metric', 50, compY + 9, { width: 120, lineBreak: false });
      doc.text('Hazmat Shipments', 200, compY + 9, { width: 150, align: 'center', lineBreak: false });
      doc.text('Non-Hazmat Shipments', 370, compY + 9, { width: 150, align: 'center', lineBreak: false });

      compY += 24;

      // Rows
      const metricsRows = [
        { label: 'Avg Units', hazmat: safeNumber(hMetrics.avgUnits, 0), nonHazmat: safeNumber(nhMetrics.avgUnits, 0) },
        { label: 'Avg Pallets', hazmat: safeNumber(hMetrics.avgPallets, 2), nonHazmat: safeNumber(nhMetrics.avgPallets, 2) },
        { label: 'Avg Cu.Ft', hazmat: safeNumber(hMetrics.avgCuft, 1), nonHazmat: safeNumber(nhMetrics.avgCuft, 1) },
        { label: 'Avg Cost', hazmat: `$${safeNumber(hMetrics.avgCost, 2)}`, nonHazmat: `$${safeNumber(nhMetrics.avgCost, 2)}` }
      ];

      metricsRows.forEach((row, idx) => {
        const rowColor = idx % 2 === 0 ? '#1a1f2e' : '#0f172a';

        doc.roundedRect(40, compY, pageWidth - 80, 22, 3).fill(rowColor);

        doc.fontSize(9).fillColor('#e2e8f0').font('Helvetica');
        doc.text(row.label, 50, compY + 8, { width: 120, lineBreak: false });

        doc.fontSize(9).fillColor('#f97316').font('Helvetica-Bold');
        doc.text(row.hazmat, 200, compY + 8, { width: 150, align: 'center', lineBreak: false });

        doc.fontSize(9).fillColor('#34d399').font('Helvetica-Bold');
        doc.text(row.nonHazmat, 370, compY + 8, { width: 150, align: 'center', lineBreak: false });

        compY += 22;
      });

      compY += 15;
    }

    // Sample Products
    if (data.hazmat.sampleProducts && data.hazmat.sampleProducts.length > 0) {
      doc.fontSize(14).fillColor('#ffffff').font('Helvetica-Bold');
      doc.text('Sample Hazmat Products', 40, compY, { lineBreak: false });

      compY += 22;

      data.hazmat.sampleProducts.slice(0, 5).forEach((product) => {
        doc.roundedRect(40, compY, pageWidth - 80, 32, 5)
          .lineWidth(1).fillAndStroke('#1a1f2e', '#334155');

        doc.fontSize(8).fillColor('#94a3b8').font('Helvetica');
        doc.text('ASIN:', 50, compY + 8, { lineBreak: false });

        doc.fontSize(8).fillColor('#ffffff').font('Helvetica-Bold');
        doc.text(product.asin || 'Unknown', 80, compY + 8, { lineBreak: false });

        const prodName = (product.productName || 'Unknown Product').substring(0, 45);
        doc.fontSize(8).fillColor('#cbd5e1').font('Helvetica');
        doc.text(prodName, 50, compY + 19, { width: pageWidth - 100, lineBreak: false });

        doc.fontSize(7).fillColor('#94a3b8').font('Helvetica');
        const typeText = `Type: ${product.type || 'N/A'} | Storage: ${product.storageType || 'N/A'} | Confidence: ${product.confidence || 'medium'}`;
        doc.text(typeText, 200, compY + 8, { width: 300, lineBreak: false });

        compY += 36;
      });
    }

    addFooter();
  }
}

      doc.end();

      stream.on('finish', () => {
        console.log('PDF generated successfully');
        resolve(outputPath);
      });

      stream.on('error', reject);

    } catch (error) {
      console.error('PDF generation error:', error);
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

    const filePath = req.file.path;
    const { hazmatFilter } = req.body; // NEW - Get filter from request
    const shipments = await parseExcelFile(filePath, hazmatFilter || 'all');

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
      ...analysis
    });

    await report.save();
    console.log('✅ Report saved to MongoDB:', report._id);

    // Clean up uploaded file after processing
    setTimeout(() => {
      try {
        fs.unlinkSync(filePath);
        console.log('🗑️  Cleaned up uploaded file:', req.file.filename);
      } catch (err) {
        console.error('Error cleaning up file:', err);
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
      .select('_id filename uploadDate totalShipments avgCost analysisMonths')
      .lean();

    console.log(`✅ Found ${reports.length} reports`);

    // Format reports for response
    const reportSummaries = reports.map(r => ({
      id: r._id.toString(),
      filename: r.filename,
      uploadDate: r.uploadDate,
      totalShipments: r.totalShipments,
      avgCost: r.avgCost,
      analysisMonths: r.analysisMonths
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

app.listen(PORT, () => {
  console.log(`🚀 AMZ Prep Analytics API running on http://localhost:${PORT}`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
});
