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
import passport from './config/passport.js';
import jwt from 'jsonwebtoken';
import { zipToState, calculateZone, estimateTransitTime } from './utils/zipToState.js';
import connectDB from './config/database.js';
import User from './models/User.js';
import Report from './models/Report.js';
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
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true in production
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

function parseExcelFile(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet);

  console.log(`📊 Parsing ${data.length} rows from Excel file`);

  // Detect format type
  const firstRow = data[0];
  const isMuscleMacFormat = firstRow.hasOwnProperty('Amazon Partnered Carrier Cost') ||
                            firstRow.hasOwnProperty('Ship To Postal Code');

  console.log(`📋 Detected format: ${isMuscleMacFormat ? 'MUSCLE MAC (Real User Data)' : 'Simple Format'}`);

  if (isMuscleMacFormat) {
    return parseMuscleMacFormat(data);
  } else {
    return parseSimpleFormat(data);
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
function parseMuscleMacFormat(data) {
  console.log('🔄 Parsing MUSCLE MAC format...');

  const shipments = [];
  let skippedRows = 0;

  // Warehouse origin ZIP (Charlotte, NC warehouse)
  const warehouseZip = '28601'; // Hickory, NC

  data.forEach((row, index) => {
    try {
      // Extract and clean ZIP code
      const rawZip = row['Ship To Postal Code'];
      if (!rawZip) {
        skippedRows++;
        return;
      }

      const zipCode = String(rawZip).split('-')[0].trim();

      // Get state from ZIP
      const stateInfo = zipToState(zipCode);
      if (!stateInfo) {
        console.log(`⚠️  Row ${index + 1}: Could not determine state for ZIP ${zipCode}`);
        skippedRows++;
        return;
      }

      // Calculate total cost
      const carrierCost = parseFloat(row['Amazon Partnered Carrier Cost'] || 0);
      const placementFee = parseFloat(row['Chosen Placement Fee'] || 0);
      const totalCost = carrierCost + placementFee;

      // Get weight
      const weight = parseFloat(row['Total Weight (lbs)'] || 0);

      // Skip if no valid data
      if (totalCost === 0 && weight === 0) {
        skippedRows++;
        return;
      }

      // Get shipping method
      const shippingMethod = row['Ship Method'] || row['Carrier'] || 'Ground';

      // Calculate zone
      const zone = calculateZone(warehouseZip, zipCode);

      // Estimate transit time
      const transitTime = estimateTransitTime(shippingMethod, zone);

      // Parse date
      let date = new Date().toISOString();
      if (row['Created Date']) {
        try {
          const parsedDate = new Date(row['Created Date']);
          if (!isNaN(parsedDate.getTime())) {
            date = parsedDate.toISOString();
          }
        } catch (e) {
          // Use default date
        }
      }

      shipments.push({
        state: stateInfo.state,
        weight: weight || 1, // Default to 1 lb if 0
        cost: totalCost,
        shippingMethod: shippingMethod,
        zone: zone,
        transitTime: transitTime,
        zipCode: zipCode,
        date: date,
        country: row['Ship To Country Code'] || 'US'
      });

    } catch (error) {
      console.error(`❌ Error parsing row ${index + 1}:`, error.message);
      skippedRows++;
    }
  });

  console.log(`✅ Successfully parsed ${shipments.length} shipments`);
  console.log(`⚠️  Skipped ${skippedRows} rows (missing data or errors)`);

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

async function generateUSMapVisualization(topStates, mapType = 'volume') {
  // HIGH RESOLUTION for crystal clarity
  const width = 1024;   // Double resolution
  const height = 400;   // Double resolution

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // CRITICAL: Disable all smoothing for sharp rendering
  ctx.imageSmoothingEnabled = false;
  ctx.textRendering = 'geometricPrecision';

  // Background
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#1e293b');
  gradient.addColorStop(1, '#0f172a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // CRISP HEADERS - Larger fonts for clarity
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px Arial';
  ctx.textBaseline = 'top';
  ctx.textRendering = 'optimizeLegibility';
  const title = mapType === 'volume' ? 'Shipping Volume Heat Map' : 'Average Cost Heat Map';
  ctx.fillText(title, 30, 20);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px Arial';
  const subtitle = mapType === 'volume'
    ? 'Distribution by state volume'
    : 'Distribution by avg shipping cost';
  ctx.fillText(subtitle, 30, 48);

  // REALISTIC US MAP - Better state positions (doubled coordinates)
  const statePositions = {
    // West Coast - Clear positioning
    'WA': { x: 130, y: 100 },
    'OR': { x: 130, y: 140 },
    'CA': { x: 116, y: 200 },

    // Mountain West
    'ID': { x: 176, y: 126 },
    'MT': { x: 224, y: 100 },
    'WY': { x: 230, y: 140 },
    'NV': { x: 156, y: 180 },
    'UT': { x: 196, y: 180 },
    'CO': { x: 240, y: 174 },
    'AZ': { x: 176, y: 226 },
    'NM': { x: 224, y: 234 },

    // Plains States
    'ND': { x: 300, y: 100 },
    'SD': { x: 304, y: 134 },
    'NE': { x: 304, y: 166 },
    'KS': { x: 310, y: 200 },
    'OK': { x: 310, y: 234 },
    'TX': { x: 300, y: 280 },

    // Upper Midwest
    'MN': { x: 356, y: 106 },
    'IA': { x: 356, y: 146 },
    'MO': { x: 356, y: 186 },
    'AR': { x: 360, y: 220 },
    'LA': { x: 364, y: 266 },

    // Great Lakes
    'WI': { x: 396, y: 120 },
    'IL': { x: 396, y: 160 },
    'MI': { x: 430, y: 126 },
    'IN': { x: 416, y: 166 },
    'OH': { x: 450, y: 160 },

    // Southeast
    'MS': { x: 396, y: 246 },
    'AL': { x: 420, y: 246 },
    'TN': { x: 430, y: 210 },
    'KY': { x: 440, y: 186 },
    'WV': { x: 474, y: 174 },
    'VA': { x: 504, y: 180 },
    'NC': { x: 494, y: 206 },
    'SC': { x: 480, y: 230 },
    'GA': { x: 454, y: 240 },
    'FL': { x: 480, y: 290 },

    // Mid-Atlantic
    'PA': { x: 514, y: 154 },
    'MD': { x: 514, y: 174 },
    'DE': { x: 528, y: 166 },
    'NJ': { x: 534, y: 154 },
    'NY': { x: 534, y: 134 },

    // New England
    'CT': { x: 554, y: 144 },
    'RI': { x: 564, y: 146 },
    'MA': { x: 568, y: 136 },
    'VT': { x: 548, y: 120 },
    'NH': { x: 560, y: 120 },
    'ME': { x: 580, y: 106 }
  };

  // DETAILED US OUTLINE - More map-like appearance
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 8;
  ctx.beginPath();

  // Complete US border path
  // West Coast
  ctx.moveTo(110, 94);
  ctx.lineTo(106, 120);
  ctx.quadraticCurveTo(100, 150, 104, 180);
  ctx.lineTo(108, 210);
  ctx.lineTo(112, 236);

  // Southern border
  ctx.lineTo(160, 250);
  ctx.lineTo(210, 260);
  ctx.lineTo(270, 300);
  ctx.lineTo(330, 310);
  ctx.lineTo(380, 304);
  ctx.lineTo(430, 294);

  // Florida
  ctx.lineTo(464, 300);
  ctx.lineTo(490, 320);
  ctx.lineTo(494, 306);
  ctx.lineTo(490, 280);
  ctx.lineTo(484, 260);

  // East Coast
  ctx.lineTo(494, 240);
  ctx.lineTo(508, 220);
  ctx.lineTo(520, 194);
  ctx.lineTo(534, 170);
  ctx.lineTo(548, 150);
  ctx.lineTo(564, 134);
  ctx.lineTo(580, 116);
  ctx.lineTo(590, 104);

  // Northeast
  ctx.lineTo(584, 100);
  ctx.lineTo(564, 104);

  // Great Lakes
  ctx.quadraticCurveTo(534, 106, 504, 114);
  ctx.quadraticCurveTo(474, 106, 444, 104);
  ctx.quadraticCurveTo(414, 96, 384, 100);

  // Northern border
  ctx.lineTo(356, 94);
  ctx.lineTo(304, 90);
  ctx.lineTo(250, 94);
  ctx.lineTo(196, 90);
  ctx.lineTo(150, 90);
  ctx.closePath();

  ctx.stroke();
  ctx.shadowBlur = 0;

  // State data map
  const stateDataMap = {};
  topStates.forEach(state => {
    stateDataMap[state.code] = state;
  });

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
      if (state.percentage >= 15) return 40;
      if (state.percentage >= 10) return 32;
      if (state.percentage >= 5) return 26;
      return 20;
    } else {
      const cost = state.avgCost || 0;
      if (cost >= 16) return 40;
      if (cost >= 14) return 32;
      if (cost >= 12) return 26;
      return 20;
    }
  }

  // Draw ONLY active states - CRISP rendering
  Object.entries(statePositions).forEach(([code, pos]) => {
    const stateData = stateDataMap[code];

    if (stateData) {
      const color = getColor(stateData, mapType);
      const size = getSize(stateData, mapType);

      // Outer glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 30;

      ctx.fillStyle = color + '30';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size / 2 + 8, 0, Math.PI * 2);
      ctx.fill();

      // Middle glow
      ctx.fillStyle = color + '60';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size / 2 + 4, 0, Math.PI * 2);
      ctx.fill();

      // Main circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;

      // CRISP state code
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(code, pos.x, pos.y);
    }
  });

  // PROPERLY FORMATTED LEGEND
  const legendY = height - 35;

  // Dark background bar
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(20, legendY - 22, width - 40, 40);

  // Legend title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Legend:', 36, legendY);

  // Legend items with proper spacing
  let legendX = 140;
  const legendSpacing = 190;

  if (mapType === 'volume') {
    const volumeLegend = [
      { color: '#60a5fa', label: 'Low', range: '(1-4%)', size: 20 },
      { color: '#3b82f6', label: 'Med', range: '(5-9%)', size: 26 },
      { color: '#2563eb', label: 'High', range: '(10-14%)', size: 32 },
      { color: '#1e40af', label: 'V.High', range: '(15%+)', size: 40 }
    ];

    volumeLegend.forEach(item => {
      // Circle
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(legendX, legendY, item.size / 2, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, legendX + 28, legendY - 2);

      // Range
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px Arial';
      ctx.fillText(item.range, legendX + 28, legendY + 12);

      legendX += legendSpacing;
    });
  } else {
    const costLegend = [
      { color: '#34d399', label: 'Low', range: '($0-12)', size: 20 },
      { color: '#fbbf24', label: 'Med', range: '($12-14)', size: 26 },
      { color: '#f97316', label: 'High', range: '($14-16)', size: 32 },
      { color: '#dc2626', label: 'V.High', range: '($16+)', size: 40 }
    ];

    costLegend.forEach(item => {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(legendX, legendY, item.size / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, legendX + 28, legendY - 2);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px Arial';
      ctx.fillText(item.range, legendX + 28, legendY + 12);

      legendX += legendSpacing;
    });
  }

  // PROPERLY SPACED TOP 5 TABLE
  const panelX = width - 200;
  const panelY = 90;
  const rowHeight = 32;

  // Table background
  ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
  ctx.fillRect(panelX - 15, panelY, 185, 180);

  // Table header
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Top 5 States:', panelX, panelY + 20);

  let listY = panelY + 50;

  topStates.slice(0, 5).forEach((state, idx) => {
    const color = getColor(state, mapType);
    const value = mapType === 'volume' ? `${state.percentage}%` : `$${state.avgCost}`;

    // Rank circle
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(panelX + 10, listY, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${idx + 1}`, panelX + 10, listY + 1);

    // State code
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(state.code, panelX + 32, listY + 1);

    // Value with color
    ctx.fillStyle = color;
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(value, panelX + 155, listY + 1);

    listY += rowHeight;
  });

  return canvas.toBuffer('image/png', { compressionLevel: 0, filters: canvas.PNG_FILTER_NONE });
}

async function generatePDF(data, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 40, bottom: 40, left: 50, right: 50 },
        bufferPages: false,
        autoFirstPage: false
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Load logo - Try JPG/PNG formats
      let logoBuffer = null;
      const logoFormats = ['amzprep_white_logo.jpg', 'amzprep_white_logo.png', 'amzprep_white_logo.jpeg'];

      for (const logoFile of logoFormats) {
        try {
          const logoPath = path.join(__dirname, logoFile);
          if (fs.existsSync(logoPath)) {
            logoBuffer = fs.readFileSync(logoPath);
            console.log(`Logo loaded successfully: ${logoFile}`);
            break;
          }
        } catch (err) {
          console.log(`Failed to load ${logoFile}:`, err.message);
        }
      }

      // ========== PAGE 1 ==========
      doc.addPage();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0a0e1a');

      let yPos = 45;

      // Header with logo
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 50, yPos, { width: 110, height: 28 });
          console.log('Logo rendered successfully');
        } catch (imgErr) {
          console.log('Logo rendering failed:', imgErr.message);
          doc.fontSize(22).fillColor('#ffffff').font('Helvetica-Bold').text('AMZ Prep', 50, yPos);
        }
      } else {
        doc.fontSize(22).fillColor('#ffffff').font('Helvetica-Bold').text('AMZ Prep', 50, yPos);
      }

      // Header right info
      doc.fontSize(10).fillColor('#94a3b8').font('Helvetica-Bold')
         .text('Shipping Analytics Report', doc.page.width - 190, 47, { width: 140, align: 'right' });
      doc.fontSize(8).fillColor('#64748b').font('Helvetica')
         .text(`${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
               doc.page.width - 190, 60, { width: 140, align: 'right' });
      doc.fontSize(7).fillColor('#64748b')
         .text(`Analysis: ${data.analysisMonths} month${data.analysisMonths > 1 ? 's' : ''}`,
               doc.page.width - 190, 72, { width: 140, align: 'right' });

      yPos = 95;

      // Title
      doc.fontSize(19).fillColor('#ffffff').font('Helvetica-Bold')
         .text('Shipping Analytics Dashboard', 50, yPos);
      yPos += 28;
      doc.fontSize(9).fillColor('#94a3b8').font('Helvetica')
         .text('Comprehensive shipping cost analysis and warehouse optimization', 50, yPos);
      yPos += 32;

      // Key Metrics - 3 boxes
      const boxWidth = 160;
      const boxHeight = 70;
      const boxSpacing = 15;

      // Box 1: Total Shipments
      doc.roundedRect(50, yPos, boxWidth, boxHeight, 8)
         .lineWidth(1.5).fillAndStroke('#1a1f2e', '#3b82f6');
      doc.fontSize(9).fillColor('#94a3b8').font('Helvetica-Bold')
         .text('Total Shipments', 60, yPos + 12, { width: boxWidth - 20, align: 'center' });
      doc.fontSize(26).fillColor('#60a5fa').font('Helvetica-Bold')
         .text(data.totalShipments.toLocaleString(), 60, yPos + 30, { width: boxWidth - 20, align: 'center' });
      doc.fontSize(7).fillColor('#64748b').font('Helvetica')
         .text(`${data.analysisMonths} month${data.analysisMonths > 1 ? 's' : ''}`, 60, yPos + 58, { width: boxWidth - 20, align: 'center' });

      // Box 2: Average Cost
      const box2X = 50 + boxWidth + boxSpacing;
      doc.roundedRect(box2X, yPos, boxWidth, boxHeight, 8)
         .lineWidth(1.5).fillAndStroke('#1a1f2e', '#34d399');
      doc.fontSize(9).fillColor('#94a3b8').font('Helvetica-Bold')
         .text('Avg Shipping Cost', box2X + 10, yPos + 12, { width: boxWidth - 20, align: 'center' });
      const avgCostDisplay = typeof data.avgCost === 'number' ? `$${data.avgCost}` : 'N/A';
      doc.fontSize(26).fillColor('#34d399').font('Helvetica-Bold')
         .text(avgCostDisplay, box2X + 10, yPos + 30, { width: boxWidth - 20, align: 'center' });
      doc.fontSize(7).fillColor('#64748b').font('Helvetica')
         .text('Per shipment', box2X + 10, yPos + 58, { width: boxWidth - 20, align: 'center' });

      // Box 3: Average Weight
      const box3X = box2X + boxWidth + boxSpacing;
      doc.roundedRect(box3X, yPos, boxWidth, boxHeight, 8)
         .lineWidth(1.5).fillAndStroke('#1a1f2e', '#a78bfa');
      doc.fontSize(9).fillColor('#94a3b8').font('Helvetica-Bold')
         .text('Avg Weight', box3X + 10, yPos + 12, { width: boxWidth - 20, align: 'center' });
      doc.fontSize(26).fillColor('#a78bfa').font('Helvetica-Bold')
         .text(`${data.avgWeight}`, box3X + 10, yPos + 30, { width: boxWidth - 20, align: 'center' });
      doc.fontSize(7).fillColor('#64748b').font('Helvetica')
         .text('pounds', box3X + 10, yPos + 58, { width: boxWidth - 20, align: 'center' });

      yPos += boxHeight + 20;

      // Recommended Warehouse Banner
      const recommended = data.warehouseComparison.find(w => w.recommended);
      if (recommended) {
        const bannerHeight = 85;
        doc.roundedRect(50, yPos, doc.page.width - 100, bannerHeight, 10)
           .fillAndStroke('#1e3a8a', '#3b82f6');
        doc.fontSize(8).fillColor('#bfdbfe').font('Helvetica-Bold')
           .text('★ RECOMMENDED WAREHOUSE', 70, yPos + 12);
        doc.fontSize(20).fillColor('#ffffff').font('Helvetica-Bold')
           .text(recommended.name, 70, yPos + 30);

        const metricStartX = 70;
        const metricY = yPos + 60;
        const metricSpacing = 160;

        doc.fontSize(7).fillColor('#bfdbfe').font('Helvetica')
           .text('Avg Cost/Order', metricStartX, metricY);
        doc.fontSize(13).fillColor('#ffffff').font('Helvetica-Bold')
           .text(`$${(recommended.cost / data.totalShipments).toFixed(2)}`, metricStartX, metricY + 9);

        doc.fontSize(7).fillColor('#bfdbfe').font('Helvetica')
           .text('Total Savings', metricStartX + metricSpacing, metricY);
        doc.fontSize(13).fillColor('#34d399').font('Helvetica-Bold')
           .text(`$${recommended.savings?.toLocaleString() || '0'}`, metricStartX + metricSpacing, metricY + 9);

        doc.fontSize(7).fillColor('#bfdbfe').font('Helvetica')
           .text('Savings', metricStartX + (metricSpacing * 2), metricY);
        doc.fontSize(13).fillColor('#fbbf24').font('Helvetica-Bold')
           .text(`${recommended.savingsPercent}%`, metricStartX + (metricSpacing * 2), metricY + 9);

        yPos += bannerHeight + 20;
      }

      // Three column section
      const col1Width = 160;
      const col2Width = 160;
      const col3Width = 160;
      const colSpacing = 15;
      const sectionHeight = 170;

      // Column 1: Shipping Method Split
      doc.roundedRect(50, yPos, col1Width, sectionHeight, 8)
         .lineWidth(1).fillAndStroke('#1a1f2e', '#2d3748');
      doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold')
         .text('Shipping Method', 60, yPos + 12, { width: col1Width - 20, align: 'center' });

      let methodY = yPos + 35;
      data.shippingMethods.slice(0, 3).forEach((method) => {
        doc.fontSize(8).fillColor('#e2e8f0').font('Helvetica')
           .text(method.name, 60, methodY, { width: col1Width - 80 });
        doc.fontSize(8).fillColor('#60a5fa').font('Helvetica-Bold')
           .text(`${method.percentage}%`, col1Width - 30, methodY, { width: 50, align: 'right' });

        const barWidth = col1Width - 20;
        const barFillWidth = (method.percentage / 100) * barWidth;
        doc.rect(60, methodY + 12, barWidth, 6).fill('#0f172a');
        doc.rect(60, methodY + 12, barFillWidth, 6).fill('#34d399');
        methodY += 32;
      });

      // Column 2: Weight Split
      const col2X = 50 + col1Width + colSpacing;
      doc.roundedRect(col2X, yPos, col2Width, sectionHeight, 8)
         .lineWidth(1).fillAndStroke('#1a1f2e', '#2d3748');
      doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold')
         .text('Weight Split', col2X + 10, yPos + 12, { width: col2Width - 20, align: 'center' });

      let weightY = yPos + 35;
      data.weightDistribution.forEach((weight) => {
        const percentage = (weight.count / data.totalShipments * 100);
        doc.fontSize(8).fillColor('#e2e8f0').font('Helvetica')
           .text(weight.range, col2X + 10, weightY, { width: 80 });
        doc.fontSize(8).fillColor('#60a5fa').font('Helvetica-Bold')
           .text(`${percentage.toFixed(0)}%`, col2X + col2Width - 40, weightY, { width: 30, align: 'right' });

        const barWidth = col2Width - 20;
        const barFillWidth = percentage / 100 * barWidth;
        doc.rect(col2X + 10, weightY + 12, barWidth, 6).fill('#0f172a');
        if (barFillWidth > 0) {
          doc.rect(col2X + 10, weightY + 12, barFillWidth, 6).fill('#06b6d4');
        }
        weightY += 32;
      });

      // Column 3: Top 7 States
      const col3X = col2X + col2Width + colSpacing;
      doc.roundedRect(col3X, yPos, col3Width, sectionHeight, 8)
         .lineWidth(1).fillAndStroke('#1a1f2e', '#2d3748');
      doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold')
         .text('Top 7 States', col3X + 10, yPos + 12, { width: col3Width - 20, align: 'center' });

      let stateY = yPos + 35;
      data.topStates.forEach((state, idx) => {
        doc.fontSize(8).fillColor('#e2e8f0').font('Helvetica')
           .text(state.name, col3X + 10, stateY, { width: 70 });
        doc.fontSize(8).fillColor('#60a5fa').font('Helvetica-Bold')
           .text(`${state.percentage}%`, col3X + 85, stateY);
        doc.fontSize(7).fillColor('#94a3b8').font('Helvetica')
           .text(`$${state.avgCost}`, col3X + 120, stateY + 1);
        stateY += 20;
      });

      yPos += sectionHeight + 20;

      // Warehouse Comparison Table
      doc.fontSize(13).fillColor('#ffffff').font('Helvetica-Bold')
         .text('Warehouse Configuration Analysis', 50, yPos);
      yPos += 22;

      const tableWidth = doc.page.width - 100;
      const rowHeight = 23;

      // Table Header
      doc.rect(50, yPos, tableWidth, rowHeight).fill('#0f172a');
      const headers = ['Warehouse', 'Ships', 'Cost', 'Zone', 'Transit', 'Save%', 'Save$'];
      const colPositions = [60, 170, 230, 285, 340, 395, 460];

      doc.fontSize(8).fillColor('#94a3b8').font('Helvetica-Bold');
      headers.forEach((header, idx) => {
        const align = idx === 0 ? 'left' : 'center';
        const width = idx === 0 ? 100 : 45;
        doc.text(header, colPositions[idx], yPos + 8, { width, align });
      });
      yPos += rowHeight;

      // Table Rows
      const maxRows = 6;
      data.warehouseComparison.slice(0, maxRows).forEach((wh, idx) => {
        const rowColor = wh.recommended ? '#1e3a8a' : (idx % 2 === 0 ? '#1a1f2e' : '#0a0e1a');
        doc.rect(50, yPos, tableWidth, rowHeight).fill(rowColor);
        if (wh.recommended) {
          doc.rect(50, yPos, tableWidth, rowHeight).lineWidth(1).stroke('#3b82f6');
        }

        doc.fontSize(7).fillColor('#e2e8f0').font('Helvetica-Bold');
        const whName = wh.recommended ? `★ ${wh.name}` : wh.name;
        doc.text(whName, colPositions[0], yPos + 8, { width: 100 });

        doc.fontSize(7).fillColor('#cbd5e1').font('Helvetica');
        doc.text(wh.shipments.toLocaleString(), colPositions[1], yPos + 8, { width: 45, align: 'center' });
        doc.text(`$${wh.cost.toLocaleString()}`, colPositions[2], yPos + 8, { width: 45, align: 'center' });
        doc.text(wh.avgZone.toFixed(1), colPositions[3], yPos + 8, { width: 45, align: 'center' });
        doc.text(`${wh.transitTime}d`, colPositions[4], yPos + 8, { width: 45, align: 'center' });

        if (wh.savingsPercent) {
          doc.fillColor('#34d399').font('Helvetica-Bold');
          doc.text(`${wh.savingsPercent}%`, colPositions[5], yPos + 8, { width: 45, align: 'center' });
        } else {
          doc.fillColor('#475569');
          doc.text('-', colPositions[5], yPos + 8, { width: 45, align: 'center' });
        }

        if (wh.savings) {
          doc.fillColor('#34d399').font('Helvetica-Bold');
          doc.text(`$${wh.savings.toLocaleString()}`, colPositions[6], yPos + 8, { width: 50, align: 'center' });
        } else {
          doc.fillColor('#475569');
          doc.text('-', colPositions[6], yPos + 8, { width: 50, align: 'center' });
        }

        yPos += rowHeight;
      });

      // CRITICAL FIX: Footer Page 1 - Save current position first
      doc.save();
      const footerY = doc.page.height - 35;

      // Draw footer line
      doc.moveTo(50, footerY).lineTo(doc.page.width - 50, footerY)
         .strokeColor('#2d3748').lineWidth(1).stroke();

      // Footer text line 1
      doc.fontSize(8).fillColor('#64748b').font('Helvetica-Bold');
      const footerText1 = 'AMZ Prep Shipping Analytics';
      const footerWidth1 = doc.widthOfString(footerText1);
      const footerX1 = (doc.page.width - footerWidth1) / 2;
      doc.text(footerText1, footerX1, footerY + 8, { lineBreak: false });

      // Footer text line 2
      doc.fontSize(7).fillColor('#475569').font('Helvetica');
      const footerText2 = 'Confidential Report - For Internal Use Only';
      const footerWidth2 = doc.widthOfString(footerText2);
      const footerX2 = (doc.page.width - footerWidth2) / 2;
      doc.text(footerText2, footerX2, footerY + 20, { lineBreak: false });

      doc.restore();

      // ========== PAGE 2 ==========
      doc.addPage();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0a0e1a');
      yPos = 45;

      // Page 2 Title
      doc.fontSize(17).fillColor('#ffffff').font('Helvetica-Bold')
         .text('Geographic Analysis', 50, yPos);
      yPos += 35;

      // Generate CRISP maps
      const volumeMapBuffer = await generateUSMapVisualization(data.topStates, 'volume');
      const costMapBuffer = await generateUSMapVisualization(data.topStates, 'cost');

      // CRITICAL: Use exact dimensions - no scaling
      const mapWidth = 512;
      const mapHeight = 200;

      // Map 1: Volume Heat Map
      doc.roundedRect(50, yPos, mapWidth, mapHeight, 8)
         .lineWidth(1).fillAndStroke('#1a1f2e', '#2d3748');

      if (volumeMapBuffer) {
        try {
          // Place image at exact size - NO SCALING
          doc.image(volumeMapBuffer, 50, yPos, {
            width: mapWidth,
            height: mapHeight,
            fit: [mapWidth, mapHeight],
            align: 'center',
            valign: 'center'
          });
        } catch (err) {
          console.error('Volume map error:', err);
        }
      }

      yPos += mapHeight + 15;

      // Map 2: Average Cost Heat Map
      doc.roundedRect(50, yPos, mapWidth, mapHeight, 8)
         .lineWidth(1).fillAndStroke('#1a1f2e', '#2d3748');

      if (costMapBuffer) {
        try {
          // Place image at exact size - NO SCALING
          doc.image(costMapBuffer, 50, yPos, {
            width: mapWidth,
            height: mapHeight,
            fit: [mapWidth, mapHeight],
            align: 'center',
            valign: 'center'
          });
        } catch (err) {
          console.error('Cost map error:', err);
        }
      }

      yPos += mapHeight + 20;

      // Additional Insights Section
      doc.fontSize(15).fillColor('#ffffff').font('Helvetica-Bold')
         .text('Key Insights', 50, yPos);
      yPos += 25;

      // Three insight boxes
      const insightWidth = 160;
      const insightHeight = 70;
      const insightSpacing = 15;

      // Insight 1: Domestic vs International
      const domesticPercent = parseFloat(data.domesticVsInternational.domesticPercent);
      doc.roundedRect(50, yPos, insightWidth, insightHeight, 8)
         .lineWidth(1).fillAndStroke('#1a1f2e', '#2d3748');
      doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold')
         .text('Domestic vs Int\'l', 60, yPos + 12, { width: insightWidth - 20, align: 'center' });
      doc.fontSize(22).fillColor('#34d399').font('Helvetica-Bold')
         .text(`${domesticPercent.toFixed(0)}%`, 60, yPos + 28, { width: insightWidth - 20, align: 'center' });
      doc.fontSize(8).fillColor('#94a3b8').font('Helvetica')
         .text('Domestic Shipments', 60, yPos + 55, { width: insightWidth - 20, align: 'center' });

      // Insight 2: Top State
      const topState = data.topStates[0];
      const insight2X = 50 + insightWidth + insightSpacing;
      doc.roundedRect(insight2X, yPos, insightWidth, insightHeight, 8)
         .lineWidth(1).fillAndStroke('#1a1f2e', '#2d3748');
      doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold')
         .text('Top Destination', insight2X + 10, yPos + 12, { width: insightWidth - 20, align: 'center' });
      doc.fontSize(17).fillColor('#60a5fa').font('Helvetica-Bold')
         .text(topState.name, insight2X + 10, yPos + 28, { width: insightWidth - 20, align: 'center' });
      doc.fontSize(8).fillColor('#94a3b8').font('Helvetica')
         .text(`${topState.percentage}% of shipments`, insight2X + 10, yPos + 50, { width: insightWidth - 20, align: 'center' });

      // Insight 3: Primary Method
      const topMethod = data.shippingMethods[0];
      const insight3X = insight2X + insightWidth + insightSpacing;
      doc.roundedRect(insight3X, yPos, insightWidth, insightHeight, 8)
         .lineWidth(1).fillAndStroke('#1a1f2e', '#2d3748');
      doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold')
         .text('Primary Method', insight3X + 10, yPos + 12, { width: insightWidth - 20, align: 'center' });
      doc.fontSize(17).fillColor('#a78bfa').font('Helvetica-Bold')
         .text(topMethod.name, insight3X + 10, yPos + 28, { width: insightWidth - 20, align: 'center' });
      doc.fontSize(8).fillColor('#94a3b8').font('Helvetica')
         .text(`${topMethod.percentage}% of shipments`, insight3X + 10, yPos + 50, { width: insightWidth - 20, align: 'center' });

      yPos += insightHeight + 25;

      // Summary Box
      doc.roundedRect(50, yPos, doc.page.width - 100, 80, 8)
         .lineWidth(1).fillAndStroke('#1a1f2e', '#2d3748');
      doc.fontSize(11).fillColor('#ffffff').font('Helvetica-Bold')
         .text('Executive Summary', 70, yPos + 12);

      const summaryText = `This report analyzes ${data.totalShipments.toLocaleString()} shipments over ${data.analysisMonths} month${data.analysisMonths > 1 ? 's' : ''}. The recommended warehouse configuration (${recommended?.name || 'N/A'}) could save approximately $${recommended?.savings?.toLocaleString() || '0'} (${recommended?.savingsPercent || '0'}%) compared to current operations. Top shipping destination is ${topState.name} with ${topState.percentage}% of total volume.`;

      doc.fontSize(9).fillColor('#cbd5e1').font('Helvetica')
         .text(summaryText, 70, yPos + 30, { width: doc.page.width - 140 });

      // CRITICAL FIX: Footer Page 2 - Same method
      doc.save();
      const footer2Y = doc.page.height - 35;

      // Draw footer line
      doc.moveTo(50, footer2Y).lineTo(doc.page.width - 50, footer2Y)
         .strokeColor('#2d3748').lineWidth(1).stroke();

      // Footer text line 1
      doc.fontSize(8).fillColor('#64748b').font('Helvetica-Bold');
      const footer2Text1 = 'AMZ Prep Shipping Analytics';
      const footer2Width1 = doc.widthOfString(footer2Text1);
      const footer2X1 = (doc.page.width - footer2Width1) / 2;
      doc.text(footer2Text1, footer2X1, footer2Y + 8, { lineBreak: false });

      // Footer text line 2
      doc.fontSize(7).fillColor('#475569').font('Helvetica');
      const footer2Text2 = 'Confidential Report - For Internal Use Only';
      const footer2Width2 = doc.widthOfString(footer2Text2);
      const footer2X2 = (doc.page.width - footer2Width2) / 2;
      doc.text(footer2Text2, footer2X2, footer2Y + 20, { lineBreak: false });

      doc.restore();

      // Properly finalize document
      doc.end();

      stream.on('finish', () => {
        console.log('PDF generated successfully:', outputPath);
        resolve(outputPath);
      });

      stream.on('error', (err) => {
        console.error('Stream error:', err);
        reject(err);
      });

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
        picture: req.user.picture
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
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('📤 File upload from user:', req.user.email);

    const filePath = req.file.path;
    const shipments = parseExcelFile(filePath);

    if (shipments.length === 0) {
      // Clean up uploaded file
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'No valid data found in file' });
    }

    const analysis = analyzeShipments(shipments);

    // ← NEW: Save to MongoDB
    const report = new Report({
      userId: req.user.id,
      userEmail: req.user.email,
      filename: req.file.originalname,
      uploadDate: new Date(),
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

app.listen(PORT, () => {
  console.log(`🚀 AMZ Prep Analytics API running on http://localhost:${PORT}`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
});
