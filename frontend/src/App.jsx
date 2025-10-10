import React, { useState, useEffect } from 'react';
import { Upload, BarChart3, Package, DollarSign, Download, Settings, LogOut, AlertCircle, CheckCircle, MapPin, FileText, TruckIcon } from 'lucide-react';
import axios from 'axios';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import amzprepLogo from './assets/amz-prep-logo-resized.png';


//const API_URL = 'http://localhost:5000/api';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const geoUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

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

const ShippingAnalytics = () => {
  const [activeView, setActiveView] = useState('dashboard');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [reports, setReports] = useState([]);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [currentReportId, setCurrentReportId] = useState(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await axios.get(`${API_URL}/reports`);
      setReports(response.data.reports);
    } catch (err) {
      console.error('Error fetching reports:', err);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadedFile(file);
    setLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        const dataWithCodes = {
          ...response.data.data,
          topStates: response.data.data.topStates.map(state => ({
            ...state,
            code: state.code || stateNameToCode[state.name] || state.name.substring(0, 2).toUpperCase()
          }))
        };

        setDashboardData(dataWithCodes);
        setCurrentReportId(response.data.reportId);
        setSuccess('File uploaded and processed successfully!');
        setActiveView('dashboard');
        fetchReports();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error uploading file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    if (!currentReportId) {
      setError('No report available to export. Please upload data first.');
      return;
    }

    setExportingPDF(true);
    setError(null);

    try {
      const response = await axios.get(`${API_URL}/export/pdf/${currentReportId}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `AmzPrep-Analytics-Report-${currentReportId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);

      setSuccess('PDF report downloaded successfully!');
    } catch (err) {
      console.error('PDF export error:', err);
      setError('Error generating PDF. Please try again.');
    } finally {
      setExportingPDF(false);
    }
  };

  const loadReport = async (reportId) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/reports/${reportId}`);
      setDashboardData(response.data);
      setCurrentReportId(reportId);
      setActiveView('dashboard');
    } catch (err) {
      setError('Error loading report');
    } finally {
      setLoading(false);
    }
  };

  const Header = () => (
    <header className="bg-[#1a1f2e] border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
        <img
          src={amzprepLogo}
          alt="AmzPrep Logo"
          className="h-10 w-auto object-contain"
          />
          <div>
            <h1 className="text-white font-bold text-lg">AMZ Prep</h1>
            <p className="text-gray-400 text-xs">Shipping Analytics</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={() => setActiveView('upload')}
          className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-[#242936]"
        >
          <Upload size={20} />
          <span className="text-sm">Upload New</span>
        </button>
        <button className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-[#242936]">
          <Settings size={20} />
        </button>
        <button className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-[#242936]">
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );

  const Alert = ({ type, message, onClose }) => {
    const isError = type === 'error';
    return (
      <div className={`rounded-lg p-4 mb-6 flex items-start gap-3 animate-fadeIn ${
        isError ? 'bg-red-500/10 border border-red-500/50' : 'bg-green-500/10 border border-green-500/50'
      }`}>
        {isError ? (
          <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
        ) : (
          <CheckCircle className="text-green-500 flex-shrink-0" size={20} />
        )}
        <div className={`flex-1 ${isError ? 'text-red-400' : 'text-green-400'}`}>
          {message}
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
        )}
      </div>
    );
  };

  const UploadView = () => (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-6">
      <div className="bg-[#1a1f2e] rounded-xl p-12 max-w-2xl w-full border border-gray-800 shadow-2xl">
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
        {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

        <div className="text-center">
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/20">
            <Upload size={40} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Upload Shipping Data</h2>
          <p className="text-gray-400 mb-8 text-lg">
            Upload your Excel file with shipping data to generate comprehensive analytics and warehouse optimization reports.
          </p>

          <label className="inline-block">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              disabled={loading}
              className="hidden"
            />
            <span className={`bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-lg cursor-pointer inline-flex items-center gap-3 transition-all transform hover:scale-105 shadow-lg ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}>
              <Upload size={20} />
              <span className="font-semibold">{loading ? 'Processing...' : 'Choose Excel File'}</span>
            </span>
          </label>

          {uploadedFile && (
            <div className="mt-6 text-sm text-gray-400 bg-[#0f1419] p-4 rounded-lg">
              <FileText className="inline mr-2" size={16} />
              Selected: <span className="text-blue-400 font-semibold">{uploadedFile.name}</span>
            </div>
          )}

          <div className="mt-10 text-left bg-[#0f1419] p-6 rounded-lg">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <FileText size={18} className="text-blue-400" />
              Expected Excel Format
            </h3>
            <ul className="text-sm text-gray-400 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span><strong className="text-gray-300">State</strong> - State name or abbreviation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span><strong className="text-gray-300">Weight</strong> - Package weight in pounds</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span><strong className="text-gray-300">Cost</strong> or <strong className="text-gray-300">Shipping_Cost</strong> - Shipping cost in dollars</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span><strong className="text-gray-300">Shipping_Method</strong> - Service type</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span><strong className="text-gray-300">Optional:</strong> Zone, Transit_Time, Zip_Code, Date, Country</span>
              </li>
            </ul>
          </div>

          {reports.length > 0 && (
            <div className="mt-8 text-left">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Recent Reports:</h3>
              <div className="space-y-2">
                {reports.slice(0, 5).map((report) => (
                  <div
                    key={report.id}
                    className="bg-[#0f1419] p-3 rounded-lg text-sm flex items-center justify-between hover:bg-[#1a1f2e] transition-colors"
                  >
                    <div>
                      <div className="text-white">{report.totalShipments.toLocaleString()} shipments</div>
                      <div className="text-gray-500 text-xs">
                        {new Date(report.uploadDate).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => loadReport(report.id)}
                      className="text-blue-500 hover:text-blue-400 font-semibold"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const MetricCard = ({ icon: Icon, label, value, subtitle, color = "blue" }) => (
    <div className="bg-[#1a1f2e] rounded-xl p-6 border border-gray-800 hover:border-gray-700 transition-all">
      <div className="flex items-center justify-center mb-3">
        <Icon size={32} className={`text-${color}-400`} />
      </div>
      <div className="text-gray-400 text-xs text-center mb-2">{label}</div>
      {subtitle && <div className="text-gray-500 text-xs text-center mb-1">{subtitle}</div>}
      <div className="text-white text-3xl font-bold text-center">{value}</div>
    </div>
  );

  const USAHeatMap = ({ states, title, dataType = "volume" }) => {
    const [hoveredState, setHoveredState] = useState(null);
    const [tooltipContent, setTooltipContent] = useState('');

    const stateCodeToFIPS = {
      'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06', 'CO': '08', 'CT': '09',
      'DE': '10', 'FL': '12', 'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18',
      'IA': '19', 'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23', 'MD': '24', 'MA': '25',
      'MI': '26', 'MN': '27', 'MS': '28', 'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32',
      'NH': '33', 'NJ': '34', 'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38', 'OH': '39',
      'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44', 'SC': '45', 'SD': '46', 'TN': '47',
      'TX': '48', 'UT': '49', 'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54', 'WI': '55',
      'WY': '56', 'DC': '11'
    };

    const stateDataMap = {};
    states.forEach(state => {
      const code = state.code || stateNameToCode[state.name];
      if (code) {
        const fipsCode = stateCodeToFIPS[code];
        if (fipsCode) {
          stateDataMap[fipsCode] = state;
        }
      }
    });

    const getColorByPercentage = (percentage) => {
      if (!percentage || percentage === 0) return '#1a1f2e';
      if (percentage >= 15) return '#1e40af';
      if (percentage >= 10) return '#2563eb';
      if (percentage >= 5) return '#3b82f6';
      return '#60a5fa';
    };

    const getColorByCost = (cost) => {
      if (!cost) return '#1a1f2e';
      if (cost >= 16) return '#dc2626';
      if (cost >= 14) return '#f97316';
      if (cost >= 12) return '#fbbf24';
      return '#34d399';
    };

    return (
      <div className="bg-[#1a1f2e] rounded-xl p-6 border border-gray-800">
        <h3 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
          <MapPin className="text-blue-400" size={20} />
          {title}
        </h3>

        <div className="bg-[#0f1419] p-6 rounded-lg relative">
          <ComposableMap projection="geoAlbersUsa" className="w-full h-auto">
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const fipsCode = geo.id;
                  const stateData = stateDataMap[fipsCode];
                  const isHovered = hoveredState === fipsCode;

                  const fillColor = stateData
                    ? (dataType === "volume" ? getColorByPercentage(stateData.percentage) : getColorByCost(stateData.avgCost))
                    : '#1a1f2e';

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fillColor}
                      stroke="#374151"
                      strokeWidth={isHovered ? 1.5 : 0.5}
                      style={{
                        default: { outline: 'none' },
                        hover: {
                          fill: dataType === "volume" ? '#60a5fa' : '#fbbf24',
                          outline: 'none',
                          cursor: 'pointer'
                        },
                        pressed: { outline: 'none' }
                      }}
                      onMouseEnter={() => {
                        setHoveredState(fipsCode);
                        if (stateData) {
                          const content = dataType === "volume"
                            ? `${stateData.name}: ${stateData.volume.toLocaleString()} shipments (${stateData.percentage}%)`
                            : `${stateData.name}: Avg Cost $${stateData.avgCost}`;
                          setTooltipContent(content);
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredState(null);
                        setTooltipContent('');
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>

          {tooltipContent && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg z-10 pointer-events-none whitespace-nowrap">
              {tooltipContent}
            </div>
          )}

          <div className="mt-6 flex items-center flex-wrap gap-4">
            <span className="text-gray-400 text-sm">
              {dataType === "volume" ? "Shipping Volume:" : "Average Cost:"}
            </span>
            {dataType === "volume" ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 rounded" style={{ backgroundColor: '#60a5fa' }}></div>
                  <span className="text-gray-500 text-xs">Low (1-4%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
                  <span className="text-gray-500 text-xs">Medium (5-9%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 rounded" style={{ backgroundColor: '#2563eb' }}></div>
                  <span className="text-gray-500 text-xs">High (10-14%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 rounded" style={{ backgroundColor: '#1e40af' }}></div>
                  <span className="text-gray-500 text-xs">Very High (15%+)</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 rounded" style={{ backgroundColor: '#34d399' }}></div>
                  <span className="text-gray-500 text-xs">Low ($0-12)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 rounded" style={{ backgroundColor: '#fbbf24' }}></div>
                  <span className="text-gray-500 text-xs">Medium ($12-14)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 rounded" style={{ backgroundColor: '#f97316' }}></div>
                  <span className="text-gray-500 text-xs">High ($14-16)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 rounded" style={{ backgroundColor: '#dc2626' }}></div>
                  <span className="text-gray-500 text-xs">Very High ($16+)</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const DomesticVsInternational = ({ data }) => {
    if (!data) return null;
    const total = parseInt(data.domestic) + parseInt(data.international);
    const domesticPercent = (parseInt(data.domestic) / total * 100).toFixed(0);

    return (
      <div className="bg-[#1a1f2e] rounded-xl p-6 border border-gray-800">
        <h3 className="text-white text-lg font-semibold mb-6">International vs Domestic</h3>
        <div className="relative pt-1">
          <div className="flex items-center justify-center mb-4">
            <div className="w-48 h-48 relative">
              <svg className="transform -rotate-90" width="192" height="192">
                <circle
                  cx="96"
                  cy="96"
                  r="80"
                  stroke="#34D399"
                  strokeWidth="32"
                  fill="none"
                  strokeDasharray={`${domesticPercent * 5.03} ${(100 - domesticPercent) * 5.03}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <div className="text-3xl font-bold text-white">{domesticPercent}%</div>
                <div className="text-xs text-gray-400">Domestic</div>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-gray-300">US Domestic</span>
              </div>
              <span className="text-white font-semibold">{data.domestic.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                <span className="text-gray-300">International</span>
              </div>
              <span className="text-white font-semibold">{data.international.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const WelcomeScreen = () => (
  <div className="relative min-h-[calc(100vh-200px)] p-6 overflow-hidden">
    {/* Animated background with moving gradients */}
    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 animate-gradient-shift"></div>

    {/* Animated geometric shapes */}
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute w-96 h-96 bg-blue-500/20 rounded-full blur-3xl -top-48 -left-48 animate-float"></div>
      <div className="absolute w-96 h-96 bg-purple-500/20 rounded-full blur-3xl -bottom-48 -right-48 animate-float-delayed"></div>
      <div className="absolute w-64 h-64 bg-pink-500/20 rounded-full blur-3xl top-1/3 right-1/4 animate-float-slow"></div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000,transparent)]"></div>
    </div>

    <div className="relative flex flex-col items-center justify-center min-h-[calc(100vh-250px)] max-w-6xl mx-auto">

      {/* Main content card */}
      <div className="w-full backdrop-blur-xl bg-[#1a1f2e]/60 rounded-3xl p-12 border border-gray-700/50 shadow-2xl shadow-blue-500/10 animate-fade-in-up">

        {/* Hero Section */}
        <div className="text-center mb-12">
          {/* Animated logo/icon */}
          <div className="relative inline-block mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl blur-3xl opacity-50 animate-pulse-slow"></div>
            <div className="relative bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 rounded-3xl w-40 h-40 flex items-center justify-center shadow-2xl shadow-blue-500/40 animate-float p-8">
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent animate-shine rounded-3xl"></div>
              <img
                src={amzprepLogo}
                alt="AMZ Prep Logo"
                className="w-full h-full object-contain drop-shadow-2xl relative z-10"
              />
            </div>
          </div>

          {/* Title with animated gradient */}
          <h1 className="text-6xl font-black mb-6 animate-fade-in">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 animate-gradient-text">
              Welcome to AMZ Prep
            </span>
          </h1>

          <p className="text-2xl text-gray-300 mb-4 animate-fade-in-delayed">
            Intelligent Shipping Analytics Platform
          </p>

          <p className="text-lg text-gray-400 max-w-3xl mx-auto animate-fade-in-more-delayed">
            Transform your shipping data into actionable insights. Optimize warehouse locations, reduce costs, and improve delivery times with our advanced analytics engine.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">

          {/* Feature 1 */}
          <div className="group relative bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/30 rounded-2xl p-6 hover:border-blue-400/60 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/30 animate-fade-in-stagger-1">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <div className="bg-blue-500/20 w-16 h-16 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <BarChart3 size={32} className="text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Advanced Analytics</h3>
              <p className="text-gray-400 leading-relaxed">
                Comprehensive insights on shipping costs, volumes, zones, and delivery performance metrics
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="group relative bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/30 rounded-2xl p-6 hover:border-purple-400/60 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/30 animate-fade-in-stagger-2">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-purple-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <div className="bg-purple-500/20 w-16 h-16 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <TruckIcon size={32} className="text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Warehouse Optimization</h3>
              <p className="text-gray-400 leading-relaxed">
                AI-powered recommendations for optimal warehouse configurations to minimize costs
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="group relative bg-gradient-to-br from-pink-500/10 to-pink-600/10 border border-pink-500/30 rounded-2xl p-6 hover:border-pink-400/60 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-pink-500/30 animate-fade-in-stagger-3">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/0 to-pink-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <div className="bg-pink-500/20 w-16 h-16 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <MapPin size={32} className="text-pink-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Geographic Insights</h3>
              <p className="text-gray-400 leading-relaxed">
                Interactive heat maps and state-level analysis for strategic decision making
              </p>
            </div>
          </div>
        </div>

        {/* Stats Banner */}
        <div className="bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 border border-gray-700/50 rounded-2xl p-8 mb-10 animate-fade-in-stagger-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
            <div className="group hover:scale-110 transition-transform duration-300">
              <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600 mb-2">
                100K+
              </div>
              <div className="text-gray-400 text-sm font-semibold">Shipments Analyzed</div>
            </div>
            <div className="group hover:scale-110 transition-transform duration-300">
              <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600 mb-2">
                $2M+
              </div>
              <div className="text-gray-400 text-sm font-semibold">Cost Savings Identified</div>
            </div>
            <div className="group hover:scale-110 transition-transform duration-300">
              <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-pink-600 mb-2">
                50+
              </div>
              <div className="text-gray-400 text-sm font-semibold">States Covered</div>
            </div>
            <div className="group hover:scale-110 transition-transform duration-300">
              <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-600 mb-2">
                24/7
              </div>
              <div className="text-gray-400 text-sm font-semibold">Real-time Processing</div>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="text-center animate-fade-in-stagger-5">
          <button
            onClick={() => setActiveView('upload')}
            className="group relative inline-flex items-center gap-4 px-12 py-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl text-white font-bold text-xl shadow-2xl shadow-blue-500/40 hover:shadow-blue-500/60 transition-all duration-500 hover:scale-105 overflow-hidden"
          >
            {/* Animated shine effect */}
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></span>

            <Upload size={28} className="group-hover:rotate-12 transition-transform duration-300 relative z-10" />
            <span className="relative z-10">Get Started - Upload Data</span>
            <svg className="w-6 h-6 group-hover:translate-x-2 transition-transform duration-300 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>

          <p className="text-gray-500 text-sm mt-6">
            No credit card required • Upload your data securely • Generate reports instantly
          </p>
        </div>

      </div>

      {/* Floating elements */}
      <div className="absolute top-20 left-10 w-20 h-20 bg-blue-500/10 rounded-lg backdrop-blur-sm border border-blue-500/20 animate-float-element-1 hidden lg:block"></div>
      <div className="absolute bottom-20 right-10 w-24 h-24 bg-purple-500/10 rounded-lg backdrop-blur-sm border border-purple-500/20 animate-float-element-2 hidden lg:block"></div>
      <div className="absolute top-1/2 right-20 w-16 h-16 bg-pink-500/10 rounded-lg backdrop-blur-sm border border-pink-500/20 animate-float-element-3 hidden lg:block"></div>

    </div>

    <style>{`
      @keyframes gradient-shift {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }

      @keyframes float {
        0%, 100% { transform: translateY(0px) translateX(0px); }
        50% { transform: translateY(-20px) translateX(10px); }
      }

      @keyframes float-delayed {
        0%, 100% { transform: translateY(0px) translateX(0px); }
        50% { transform: translateY(20px) translateX(-10px); }
      }

      @keyframes float-slow {
        0%, 100% { transform: translateY(0px) scale(1); }
        50% { transform: translateY(-30px) scale(1.1); }
      }

      @keyframes pulse-slow {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 0.8; }
      }

      @keyframes shine {
        from { transform: translateX(-100%) skewX(-15deg); }
        to { transform: translateX(200%) skewX(-15deg); }
      }

      @keyframes fade-in {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes fade-in-up {
        from { opacity: 0; transform: translateY(40px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes gradient-text {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }

      @keyframes float-element-1 {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(-15px) rotate(5deg); }
      }

      @keyframes float-element-2 {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(15px) rotate(-5deg); }
      }

      @keyframes float-element-3 {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(-10px) rotate(3deg); }
      }

      .animate-gradient-shift {
        background-size: 200% 200%;
        animation: gradient-shift 15s ease infinite;
      }

      .animate-float {
        animation: float 6s ease-in-out infinite;
      }

      .animate-float-delayed {
        animation: float-delayed 8s ease-in-out infinite;
      }

      .animate-float-slow {
        animation: float-slow 10s ease-in-out infinite;
      }

      .animate-pulse-slow {
        animation: pulse-slow 4s ease-in-out infinite;
      }

      /*.animate-shine {
        animation: shine 3s ease-in-out infinite;
      }*/

      .animate-fade-in {
        animation: fade-in 1s ease-out;
      }

      .animate-fade-in-up {
        animation: fade-in-up 1s ease-out;
      }

      .animate-fade-in-delayed {
        animation: fade-in 1s ease-out 0.2s both;
      }

      .animate-fade-in-more-delayed {
        animation: fade-in 1s ease-out 0.4s both;
      }

      .animate-fade-in-stagger-1 {
        animation: fade-in-up 0.8s ease-out 0.2s both;
      }

      .animate-fade-in-stagger-2 {
        animation: fade-in-up 0.8s ease-out 0.4s both;
      }

      .animate-fade-in-stagger-3 {
        animation: fade-in-up 0.8s ease-out 0.6s both;
      }

      .animate-fade-in-stagger-4 {
        animation: fade-in-up 0.8s ease-out 0.8s both;
      }

      .animate-fade-in-stagger-5 {
        animation: fade-in-up 0.8s ease-out 1s both;
      }

      .animate-gradient-text {
        background-size: 200% 200%;
        animation: gradient-text 3s ease infinite;
      }

      .animate-float-element-1 {
        animation: float-element-1 5s ease-in-out infinite;
      }

      .animate-float-element-2 {
        animation: float-element-2 6s ease-in-out infinite;
      }

      .animate-float-element-3 {
        animation: float-element-3 7s ease-in-out infinite;
      }
    `}</style>
  </div>
);

    const DashboardView = () => {
    if (!dashboardData) {
      return <WelcomeScreen />;
    }

    return (
      <div className="space-y-6 p-6">
        {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

        <div className="bg-[#1a1f2e] rounded-xl p-6 border border-gray-800">
          <h2 className="text-2xl font-bold text-white mb-2">AMZ Prep Shipping Analysis</h2>
          <p className="text-gray-400">
            Generated on {new Date().toLocaleDateString()} • Analysis Period: {dashboardData.analysisMonths} {dashboardData.analysisMonths > 1 ? 'months' : 'month'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard
            icon={Package}
            label="Total Shipments Analyzed"
            subtitle={`(${dashboardData.analysisMonths} months)`}
            value={dashboardData.totalShipments.toLocaleString()}
            color="blue"
          />
          <MetricCard
            icon={DollarSign}
            label="Current Average Shipping Cost"
            value={typeof dashboardData.avgCost === 'number' ? `$${dashboardData.avgCost}` : dashboardData.avgCost}
            color="green"
          />
          <MetricCard
            icon={BarChart3}
            label="Average Weight (lbs)"
            value={dashboardData.avgWeight}
            color="purple"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#1a1f2e] rounded-xl p-6 border border-gray-800">
            <h3 className="text-white text-lg font-semibold mb-6">Shipping Method Split</h3>
            <div className="space-y-4">
              {dashboardData.shippingMethods.map((method, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-2 text-sm">
                    <span className="text-gray-300">{method.name}</span>
                    <span className="text-white font-bold">{method.count.toLocaleString()}</span>
                  </div>
                  <div className="bg-[#0f1419] rounded-full h-8 overflow-hidden relative">
                    <div
                      className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${method.percentage}%` }}
                    >
                      {method.percentage > 5 && (
                        <span className="text-xs text-white font-semibold">{method.percentage}%</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#1a1f2e] rounded-xl p-6 border border-gray-800">
            <h3 className="text-white text-lg font-semibold mb-6">Weight Split</h3>
            <div className="space-y-4">
              {dashboardData.weightDistribution.map((weight, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-2 text-sm">
                    <span className="text-gray-300">{weight.range}</span>
                    <span className="text-white font-bold">{weight.count.toLocaleString()}</span>
                  </div>
                  <div className="bg-[#0f1419] rounded-full h-8 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-cyan-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${(weight.count / dashboardData.totalShipments) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DomesticVsInternational data={dashboardData.domesticVsInternational} />
        </div>

        {dashboardData.warehouseComparison.find(w => w.recommended) && (
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 border border-blue-500 shadow-2xl shadow-blue-500/20">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex-1 min-w-[300px]">
                <div className="flex items-center gap-2 mb-2">
                  <TruckIcon size={24} className="text-white" />
                  <h3 className="text-white text-xl font-bold">Suggested Warehouse</h3>
                </div>
                <p className="text-white text-4xl font-black mb-4">
                  {dashboardData.warehouseComparison.find(w => w.recommended).name}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-white">
                  <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
                    <span className="text-sm opacity-80 block mb-1">Average Cost per Order</span>
                    <div className="text-2xl font-bold">
                      ${(dashboardData.warehouseComparison.find(w => w.recommended).cost / dashboardData.totalShipments).toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
                    <span className="text-sm opacity-80 block mb-1">Total Savings</span>
                    <div className="text-2xl font-bold text-green-300">
                      ${dashboardData.warehouseComparison.find(w => w.recommended).savings?.toLocaleString() || '0'}
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
                    <span className="text-sm opacity-80 block mb-1">Recommended</span>
                    <div className="text-2xl font-bold">
                      {dashboardData.warehouseComparison.find(w => w.recommended).savingsPercent}% Savings
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#1a1f2e] rounded-xl p-6 border border-gray-800">
            <h3 className="text-white text-lg font-semibold mb-6">Top 7 States</h3>
            <div className="space-y-3">
              {dashboardData.topStates.map((state, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <span className="text-gray-300">{state.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-blue-400 font-bold text-lg">{state.percentage}%</span>
                    <span className="text-gray-500 text-sm">${state.avgCost}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            <USAHeatMap states={dashboardData.topStates} title="USA Shipping Heat Map (Volume)" dataType="volume" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          <USAHeatMap states={dashboardData.topStates} title="Average Cost per Order by State" dataType="cost" />
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-2 mb-6">
            <TruckIcon className="text-blue-400" size={24} />
            <h3 className="text-white text-xl font-semibold">Warehouse Comparison</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold text-sm">Warehouse</th>
                  <th className="text-center py-3 px-4 text-gray-400 font-semibold text-sm">Shipments</th>
                  <th className="text-center py-3 px-4 text-gray-400 font-semibold text-sm">Cost</th>
                  <th className="text-center py-3 px-4 text-gray-400 font-semibold text-sm">Avg Zone</th>
                  <th className="text-center py-3 px-4 text-gray-400 font-semibold text-sm">Avg Transit Time</th>
                  <th className="text-center py-3 px-4 text-gray-400 font-semibold text-sm">Savings %</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-semibold text-sm">Savings</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.warehouseComparison.map((wh, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-gray-800 last:border-0 ${
                      wh.recommended ? 'bg-blue-500/10' : 'hover:bg-[#242936]'
                    } transition-colors`}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        {wh.recommended && <span className="text-xs bg-green-500 text-white px-2 py-1 rounded font-bold">✓ RECOMMENDED</span>}
                        <span className="text-white font-semibold">{wh.name}</span>
                      </div>
                    </td>
                    <td className="text-center py-4 px-4 text-gray-300">{wh.shipments.toLocaleString()}</td>
                    <td className="text-center py-4 px-4 text-white font-semibold">${wh.cost.toLocaleString()}</td>
                    <td className="text-center py-4 px-4 text-gray-300">{wh.avgZone}</td>
                    <td className="text-center py-4 px-4 text-gray-300">{wh.transitTime} days</td>
                    <td className="text-center py-4 px-4">
                      {wh.savingsPercent ? (
                        <span className="text-green-400 font-bold">{wh.savingsPercent}%</span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="text-right py-4 px-4">
                      {wh.savings ? (
                        <span className="text-green-400 font-bold">${wh.savings.toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-600">n/a</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <button
            onClick={exportToPDF}
            disabled={exportingPDF || !currentReportId}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-lg flex items-center gap-3 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            <Download size={20} />
            {exportingPDF ? 'Generating PDF...' : 'Export PDF Report'}
          </button>
          <button
            onClick={() => setActiveView('upload')}
            className="bg-[#1a1f2e] hover:bg-[#242936] text-white px-8 py-4 rounded-lg flex items-center gap-3 border border-gray-800 hover:border-gray-700 transition-all font-semibold"
          >
            <Upload size={20} />
            Upload New Data
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0f1419]">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>

      <Header />

      <div className="max-w-7xl mx-auto">
        <div className="p-6 pb-4">
          <h1 className="text-4xl font-black text-white mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Shipping Analytics Dashboard
          </h1>
          <p className="text-gray-400 text-lg">
            Comprehensive shipping cost analysis and warehouse optimization
          </p>
        </div>

        {activeView === 'upload' ? <UploadView /> : <DashboardView />}
      </div>
    </div>
  );
};

export default ShippingAnalytics;
