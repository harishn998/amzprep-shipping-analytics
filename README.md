# 📦 AMZ Prep Shipping Analytics

A comprehensive full-stack shipping analytics platform that helps businesses analyze shipping costs, optimize warehouse configurations, and visualize geographic distribution of shipments.

![Deployment](https://img.shields.io/badge/deployment-live-brightgreen) ![Platform](https://img.shields.io/badge/platform-Render-blueviolet) ![Status](https://img.shields.io/badge/status-active-success) ![AmzPrep Analytics](https://img.shields.io/badge/React-18.3.1-blue) ![Node.js](https://img.shields.io/badge/Node.js-Express-green) ![License](https://img.shields.io/badge/license-MIT-blue)

## 🌐 Live Demo

**Try it now:** [https://amzprep-shipping-analytics.onrender.com/](https://amzprep-shipping-analytics.onrender.com/)

Upload your shipping data and get instant analytics with warehouse optimization recommendations!

## 🌟 Features

### Analytics Dashboard
- **Real-time Data Processing** - Upload and analyze Excel/CSV files instantly
- **Interactive Visualizations** - Heat maps, bar charts, and distribution graphs
- **Warehouse Optimization** - Compare multiple warehouse configurations
- **Cost Analysis** - Track average shipping costs and weight distributions
- **Geographic Insights** - USA heat maps showing volume and cost by state
- **PDF Export** - Generate professional 2-page PDF reports

### Key Metrics
- Total shipments analysis
- Average shipping cost per order
- Weight distribution analysis
- Shipping method breakdown
- Domestic vs International split
- Top destination states
- Zone-based analysis

## 🚀 Tech Stack

### Frontend
- **React 18.3** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **Lucide React** - Icons
- **React Simple Maps** - Interactive USA maps

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **Multer** - File upload handling
- **XLSX** - Excel file parsing
- **PDFKit** - PDF generation
- **CORS** - Cross-origin resource sharing

## 📋 Prerequisites

- Node.js 16.x or higher
- npm or yarn package manager
- Modern web browser

## 🛠️ Installation

### Clone the Repository
```bash
git clone https://github.com/yourusername/amzprep-shipping-analytics.git
cd amzprep-shipping-analytics
```

### Backend Setup
```bash
cd backend
npm install
npm start
```
The backend will run on `http://localhost:5000`

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The frontend will run on `http://localhost:3000`

## 📁 Project Structure

```
amzprep-shipping-analytics/
├── backend/
│   ├── node_modules/
│   ├── uploads/
│   ├── amzprep_white_logo.png
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── node_modules/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js
└── README.md
```

## 📊 Excel File Format

Your Excel/CSV file should include these columns:

| Column | Description | Required |
|--------|-------------|----------|
| State | State name or code | ✅ Yes |
| Weight | Package weight (lbs) | ✅ Yes |
| Cost | Shipping cost ($) | ✅ Yes |
| Shipping_Method | Service type | ✅ Yes |
| Zone | Shipping zone | ⚪ Optional |
| Transit_Time | Days in transit | ⚪ Optional |
| Zip_Code | Destination ZIP | ⚪ Optional |
| Date | Shipment date | ⚪ Optional |
| Country | Destination country | ⚪ Optional |

### Example Data
```csv
State,Weight,Cost,Shipping_Method,Zone
California,2.5,14.50,Ground,8
Texas,1.2,8.75,Priority,5
New York,3.1,16.25,Ground,7
```

## 🎨 Screenshots

### Dashboard Overview
Comprehensive analytics with key metrics, warehouse recommendations, and interactive visualizations.

### Heat Maps
Interactive USA maps showing shipping volume and average cost by state.

### PDF Reports
Professional 2-page PDF reports with detailed analytics and recommendations.

## 🔧 API Endpoints

### Upload File
```http
POST /api/upload
Content-Type: multipart/form-data
```

### Get All Reports
```http
GET /api/reports
```

### Get Specific Report
```http
GET /api/reports/:id
```

### Export PDF
```http
GET /api/export/pdf/:id
```

### Health Check
```http
GET /api/health
```

## 🌐 Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=5000
NODE_ENV=production
UPLOAD_LIMIT=50mb
```

## 📦 Deployment

### Render Deployment 

1. Push code to GitHub
2. Create new Web Service on Render
3. Configure build commands
4. Deploy backend and frontend separately

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch 
3. Commit your changes 
4. Push to the branch 
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 👥 Authors

- **Harishnath** - *Initial work* - [YourGitHub](https://github.com/harishn998)

## 🙏 Acknowledgments

- AMZ Prep team 
- Open source community for amazing libraries
- Contributors and testers

## 📧 Contact

For questions or support, please contact:
- Email: harishnath@amzprep.com
- GitHub Issues: [Create an issue](https://github.com/harishn998/amzprep-shipping-analytics/issues)

## 🔮 Future Enhancements

- [ ] Real-time tracking integration
- [ ] Multi-user authentication
- [ ] Historical data comparison
- [ ] Advanced forecasting models
- [ ] Mobile app version
- [ ] API rate limiting
- [ ] Database integration (PostgreSQL/MongoDB)
- [ ] Email report scheduling

---

Made with ❤️ by AMZ Prep Team
