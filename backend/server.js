import express from 'express';
import multer from 'multer';
import cors from 'cors';
import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
//const PORT = 5000;

const PORT = process.env.PORT || 5000;

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

let reports = [];
let reportIdCounter = 1;

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

function calculateWarehouseComparison(shipments) {
  const baseCost = shipments.reduce((sum, s) => sum + s.cost, 0);

  const warehouses = [
    { name: 'Kentucky', costMultiplier: 1.0, avgZone: 5.1, transitTime: 4.5 },
    { name: 'Nevada', costMultiplier: 1.21, avgZone: 6.2, transitTime: 5.4 },
    { name: 'Florida', costMultiplier: 1.15, avgZone: 6.0, transitTime: 4.9 },
    { name: 'KY+NV+FL (3)', costMultiplier: 0.85, avgZone: 3.9, transitTime: 4.1, recommended: true },
    { name: 'KY+NV (2)', costMultiplier: 0.86, avgZone: 4.1, transitTime: 4.1 },
    { name: 'NV+FL (2)', costMultiplier: 0.98, avgZone: 4.8, transitTime: 4.5 }
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
      yPos += 30;

      // Two maps side by side
      const mapWidth = (doc.page.width - 120) / 2;
      const mapHeight = 200;

      // Map 1: Volume Heat Map
      doc.roundedRect(50, yPos, mapWidth, mapHeight, 8)
         .lineWidth(1).fillAndStroke('#1a1f2e', '#2d3748');
      doc.fontSize(11).fillColor('#ffffff').font('Helvetica-Bold')
         .text('Shipping Volume Heat Map', 60, yPos + 12);
      doc.fontSize(8).fillColor('#64748b').font('Helvetica')
         .text('Distribution by state volume', 60, yPos + 28);

      let mapItemY = yPos + 48;
      data.topStates.slice(0, 5).forEach((state) => {
        const barMaxWidth = mapWidth - 80;
        const barWidth = (state.percentage / 100) * barMaxWidth;
        const color = state.percentage >= 15 ? '#1e40af' :
                     state.percentage >= 10 ? '#2563eb' :
                     state.percentage >= 5 ? '#3b82f6' : '#60a5fa';

        doc.fontSize(9).fillColor('#e2e8f0').font('Helvetica')
           .text(state.code, 60, mapItemY);
        doc.roundedRect(90, mapItemY - 2, barWidth, 16, 4).fill(color);
        doc.fontSize(8).fillColor('#ffffff').font('Helvetica-Bold')
           .text(`${state.percentage}%`, 95, mapItemY + 2);
        mapItemY += 26;
      });

      // Legend for Volume Map
      const legendY = yPos + mapHeight - 30;
      doc.fontSize(7).fillColor('#94a3b8').font('Helvetica').text('Legend:', 60, legendY);
      const legendItems = [
        { color: '#60a5fa', label: 'Low' },
        { color: '#3b82f6', label: 'Med' },
        { color: '#2563eb', label: 'High' },
        { color: '#1e40af', label: 'V.High' }
      ];
      let legendX = 60;
      legendItems.forEach((item) => {
        doc.circle(legendX, legendY + 13, 4).fill(item.color);
        doc.fontSize(6).fillColor('#cbd5e1').font('Helvetica')
           .text(item.label, legendX + 8, legendY + 10);
        legendX += 45;
      });

      // Map 2: Average Cost Heat Map
      const map2X = 50 + mapWidth + 20;
      doc.roundedRect(map2X, yPos, mapWidth, mapHeight, 8)
         .lineWidth(1).fillAndStroke('#1a1f2e', '#2d3748');
      doc.fontSize(11).fillColor('#ffffff').font('Helvetica-Bold')
         .text('Average Cost Heat Map', map2X + 10, yPos + 12);
      doc.fontSize(8).fillColor('#64748b').font('Helvetica')
         .text('Distribution by avg shipping cost', map2X + 10, yPos + 28);

      mapItemY = yPos + 48;
      const maxCost = Math.max(...data.topStates.map(s => s.avgCost || 0));

      data.topStates.slice(0, 5).forEach((state) => {
        const cost = state.avgCost || 0;
        const barMaxWidth = mapWidth - 80;
        const barWidth = (cost / maxCost) * barMaxWidth;
        const color = cost >= 16 ? '#dc2626' :
                     cost >= 14 ? '#f97316' :
                     cost >= 12 ? '#fbbf24' : '#34d399';

        doc.fontSize(9).fillColor('#e2e8f0').font('Helvetica')
           .text(state.code, map2X + 10, mapItemY);
        doc.roundedRect(map2X + 40, mapItemY - 2, barWidth, 16, 4).fill(color);
        doc.fontSize(8).fillColor('#ffffff').font('Helvetica-Bold')
           .text(`$${state.avgCost}`, map2X + 45, mapItemY + 2);
        mapItemY += 26;
      });

      // Legend for Cost Map
      const legend2Y = yPos + mapHeight - 30;
      doc.fontSize(7).fillColor('#94a3b8').font('Helvetica').text('Legend:', map2X + 10, legend2Y);
      const legend2Items = [
        { color: '#34d399', label: 'Low' },
        { color: '#fbbf24', label: 'Med' },
        { color: '#f97316', label: 'High' },
        { color: '#dc2626', label: 'V.High' }
      ];
      let legend2X = map2X + 10;
      legend2Items.forEach((item) => {
        doc.circle(legend2X, legend2Y + 13, 4).fill(item.color);
        doc.fontSize(6).fillColor('#cbd5e1').font('Helvetica')
           .text(item.label, legend2X + 8, legend2Y + 10);
        legend2X += 45;
      });

      yPos += mapHeight + 25;

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AMZ Prep Analytics API is running' });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const shipments = parseExcelFile(filePath);

    if (shipments.length === 0) {
      return res.status(400).json({ error: 'No valid data found in file' });
    }

    const analysis = analyzeShipments(shipments);

    const report = {
      id: reportIdCounter++,
      uploadDate: new Date().toISOString(),
      filename: req.file.originalname,
      ...analysis
    };

    reports.push(report);

    if (reports.length > 50) {
      reports = reports.slice(-50);
    }

    res.json({
      success: true,
      data: analysis,
      reportId: report.id
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Error processing file: ' + error.message });
  }
});

app.get('/api/reports', (req, res) => {
  const reportSummaries = reports.map(r => ({
    id: r.id,
    uploadDate: r.uploadDate,
    filename: r.filename,
    totalShipments: r.totalShipments
  }));

  res.json({ reports: reportSummaries });
});

app.get('/api/reports/:id', (req, res) => {
  const reportId = parseInt(req.params.id);
  const report = reports.find(r => r.id === reportId);

  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  res.json(report);
});

app.get('/api/export/pdf/:id', async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);
    const report = reports.find(r => r.id === reportId);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const pdfPath = path.join(uploadsDir, `report-${reportId}-${Date.now()}.pdf`);

    await generatePDF(report, pdfPath);

    res.download(pdfPath, `AmzPrep-Analytics-Report-${reportId}.pdf`, (err) => {
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
