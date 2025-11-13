import React, { useState, useEffect } from 'react';
import { Upload, BarChart3, Package, DollarSign, Download, Settings, LogOut, AlertCircle, CheckCircle, MapPin, FileText, TruckIcon, ShoppingCart, Users, X } from 'lucide-react';
import axios from 'axios';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import amzprepLogo from './assets/amz-prep-logo-resized.png';
import { useAuth } from './contexts/AuthContext';
import amazonLogo from './assets/amazon-logo.png';
import shopifyLogo from './assets/shopify-logo.png';
import { SmashFoodsDashboard } from './SmashFoodsDashboardComponents';


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
  const { user, logout, getAuthHeader } = useAuth();

  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminRateType, setAdminRateType] = useState('prep');
  const [adminRateFile, setAdminRateFile] = useState(null);
  const [adminRateName, setAdminRateName] = useState('');
  const [adminEffectiveDate, setAdminEffectiveDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [adminUploading, setAdminUploading] = useState(false);
  const [adminMessage, setAdminMessage] = useState(null);
  const [showUserManagement, setShowUserManagement] = useState(false);

  const [deletingReportId, setDeletingReportId] = useState(null);
  const [activeView, setActiveView] = useState('dashboard');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [reports, setReports] = useState([]);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [currentReportId, setCurrentReportId] = useState(null);
  const [amazonFile, setAmazonFile] = useState(null);
  const [amazonRateType, setAmazonRateType] = useState('prep');
  const [amazonLoading, setAmazonLoading] = useState(false);
  const [shopifyFile, setShopifyFile] = useState(null);
  const [shopifyRateType, setShopifyRateType] = useState('orderUpdate');
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [hazmatFilter, setHazmatFilter] = useState('all');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await axios.get(`${API_URL}/reports`, {
      headers: getAuthHeader()  // ← ADD THIS
      });
      setReports(response.data.reports);
    } catch (err) {
      // Handle auth errors
      if (err.response?.status === 401 || err.response?.status === 403) {
      logout();
      window.location.href = '/login';
      return;
      }
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
    formData.append('rateType', rateType);
    formData.append('hazmatFilter', hazmatFilter);

    try {
      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...getAuthHeader()
       },
      });

      if (response.data.success) {
        const dataWithCodes = {
          ...response.data.data,
          topStates: response.data.data.topStates.map(state => ({
            ...state,
            code: state.code || stateNameToCode[state.name] || state.name.substring(0, 2).toUpperCase()
          })),
          // 🆕 Explicitly include hazmat data
          hazmat: response.data.data.hazmat || null,
          // 🆕 Include metadata to ensure it has hazmatFilter info
          metadata: response.data.data.metadata || {}
        };

        // 🔍 DEBUG LOG - Remove after confirming it works
        console.log('📊 Dashboard data with hazmat:', {
          hasHazmat: !!dataWithCodes.hazmat,
          hazmatProducts: dataWithCodes.hazmat?.products?.hazmat,
          hazmatTypes: dataWithCodes.hazmat?.typeBreakdown?.length
        });

        setDashboardData(dataWithCodes);
        setCurrentReportId(response.data.reportId);
        setSuccess('File uploaded and processed successfully!');
        setActiveView('dashboard');
        fetchReports();
      }
    } catch (err) {
      // Handle authentication errors
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Your session has expired. Please login again.');
        logout();
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

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
        responseType: 'blob',
        headers: getAuthHeader()
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

      // Handle auth errors
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Your session has expired. Please login again.');
        logout();
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      setError('Error generating PDF. Please try again.');
    } finally {
      setExportingPDF(false);
    }
  };

  const loadReport = async (reportId) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/reports/${reportId}`, {
      headers: getAuthHeader()  // ← ADD THIS
      });
      setDashboardData(response.data);
      setCurrentReportId(reportId);
      setActiveView('dashboard');
    } catch (err) {
      // Handle auth errors
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
        window.location.href = '/login';
        return;
      }
      setError('Error loading report');
    } finally {
      setLoading(false);
    }
  };

  const deleteReport = async (reportId) => {
  if (!window.confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
    return;
  }

  setDeletingReportId(reportId);

  try {
    await axios.delete(`${API_URL}/reports/${reportId}`, {
      headers: getAuthHeader()
    });

    // Remove report from list
    setReports(reports.filter(r => r.id !== reportId));

    // If deleted report was currently loaded, clear dashboard
    if (currentReportId === reportId) {
      setDashboardData(null);
      setCurrentReportId(null);
    }

    setSuccess('Report deleted successfully');
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      logout();
      window.location.href = '/login';
      return;
    }
    setError('Error deleting report: ' + (err.response?.data?.error || err.message));
  } finally {
    setDeletingReportId(null);
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

      {/* THIS IS THE NEW PART - User Info & Logout */}
      <div className="flex items-center gap-4">

        {/* User Profile Section */}
        <div className="flex items-center gap-3 bg-[#0f1419] px-4 py-2 rounded-lg border border-gray-700">
          {user.picture && (
            <img
              src={user.picture}
              alt={user.name}
              className="w-8 h-8 rounded-full border-2 border-blue-500"
            />
          )}
          <div className="text-sm">
            <div className="text-white font-medium">{user.name}</div>
            <div className="text-gray-400 text-xs">{user.email}</div>
          </div>
        </div>

        {/* Upload New Button (existing) */}
        <button
          onClick={() => setActiveView('upload')}
          className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-[#242936]"
        >
          <Upload size={20} />
          <span className="text-sm">Upload New</span>
        </button>

        {/* Admin Users Button - ADD THIS */}
            {user?.role === 'admin' && (
              <button
                onClick={() => setShowUserManagement(!showUserManagement)}
                className="text-gray-300 hover:text-white flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-700 transition-all"
                title="Manage Users"
              >
                <Users size={20} />
                <span className="hidden md:inline">Users</span>
              </button>
        )}

        {/* Settings Button (existing) */}
        <button className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-[#242936]">
          <Settings size={20} />
        </button>

        {/* NEW: Logout Button */}
        <button
          onClick={() => {
            logout();
            window.location.href = '/login';
          }}
          className="text-gray-400 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-[#242936]"
          title="Logout"
        >
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

  const UploadView = () => {
  // State for Amazon upload
  const [amazonFile, setAmazonFile] = useState(null);
  const [amazonRateType, setAmazonRateType] = useState('prep');
  const [amazonLoading, setAmazonLoading] = useState(false);

  // State for Shopify upload
  const [shopifyFile, setShopifyFile] = useState(null);
  const [shopifyRateType, setShopifyRateType] = useState('orderUpdate');
  const [shopifyLoading, setShopifyLoading] = useState(false);

  // Amazon upload handler
  const handleAmazonUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setAmazonFile(file);
    setAmazonLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadType', 'amazon');
    formData.append('rateType', amazonRateType);

    try {
      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...getAuthHeader()
        },
      });

      if (response.data.success) {
        const dataWithCodes = {
          ...response.data.data,
          topStates: response.data.data.topStates.map(state => ({
            ...state,
            code: state.code || stateNameToCode[state.name] || state.name.substring(0, 2).toUpperCase()
          })),
          // 🆕 Explicitly include hazmat data
            hazmat: response.data.data.hazmat || null,
            // 🆕 Include metadata
            metadata: response.data.data.metadata || {}
          };

          // 🔍 DEBUG LOG
          console.log('📊 Amazon upload - Dashboard data:', {
            hasHazmat: !!dataWithCodes.hazmat,
            hazmatProducts: dataWithCodes.hazmat?.products?.hazmat
          });

        setDashboardData(dataWithCodes);
        setCurrentReportId(response.data.reportId);
        setSuccess(`Amazon ${amazonRateType} file uploaded successfully!`);
        setActiveView('dashboard');
        fetchReports();
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Your session has expired. Please login again.');
        logout();
        return;
      }
      setError(err.response?.data?.message || 'Error uploading Amazon file. Please try again.');
    } finally {
      setAmazonLoading(false);
    }
  };

  // Shopify upload handler
  const handleShopifyUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setShopifyFile(file);
    setShopifyLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadType', 'shopify');
    formData.append('rateType', shopifyRateType);

    try {
      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...getAuthHeader()
        },
      });

      if (response.data.success) {
        const dataWithCodes = {
          ...response.data.data,
          topStates: response.data.data.topStates.map(state => ({
            ...state,
            code: state.code || stateNameToCode[state.name] || state.name.substring(0, 2).toUpperCase()
          })),
          // 🆕 Explicitly include hazmat data
            hazmat: response.data.data.hazmat || null,
            // 🆕 Include metadata
            metadata: response.data.data.metadata || {}
          };

          // 🔍 DEBUG LOG
          console.log('📊 Shopify upload - Dashboard data:', {
            hasHazmat: !!dataWithCodes.hazmat,
            hazmatProducts: dataWithCodes.hazmat?.products?.hazmat
          });

        setDashboardData(dataWithCodes);
        setCurrentReportId(response.data.reportId);
        setSuccess(`Shopify ${shopifyRateType} file uploaded successfully!`);
        setActiveView('dashboard');
        fetchReports();
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Your session has expired. Please login again.');
        logout();
        return;
      }
      setError(err.response?.data?.message || 'Error uploading Shopify file. Please try again.');
    } finally {
      setShopifyLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] p-6">
    {/* Show admin panel only for admin users */}
    {user?.role === 'admin' && <AdminRatePanel />}

      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-white mb-3">Upload Shipping Data</h2>
        <p className="text-gray-400 text-lg">
          Choose your platform and rate type to begin analysis
        </p>
      </div>

      {/* Alerts */}
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Dual Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">

        {/* ============== AMAZON UPLOAD CARD ============== */}
        <div className="bg-[#1a1f2e] rounded-xl p-8 border border-orange-500/30 hover:border-orange-400/60 transition-all shadow-2xl hover:shadow-orange-500/20">

          {/* Amazon Logo & Header */}
          <div className="text-center mb-6">
          <div className="bg-white rounded-2xl w-24 h-24 flex items-center justify-center mx-auto mb-4 shadow-lg">
            {/* ACTUAL LOGO IMAGE */}
            <img
              src={amazonLogo}
              alt="Amazon"
              className="w-full h-full object-contain"
              onError={(e) => {
                // Fallback to icon if image fails to load
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            {/* Fallback icon (hidden by default) */}
            <div className="hidden bg-gradient-to-br from-orange-500 to-orange-700 rounded-xl w-full h-full items-center justify-center">
              <Package size={48} className="text-white" />
            </div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Amazon Upload</h3>
            <p className="text-gray-400">Amazon FBA Data</p>
          </div>

          {/* Rate Type Dropdown */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Select Rate Type
            </label>
            <select
              value={amazonRateType}
              onChange={(e) => setAmazonRateType(e.target.value)}
              disabled={amazonLoading}
              className="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all disabled:opacity-50"
            >
              <option value="prep">Prep Services</option>
              <option value="middleMile">Middle Mile</option>
              <option value="fbaShipment">FBA Shipment</option>
              <option value="combined">Complete Solution</option>
            </select>
            <p className="text-xs text-gray-500 mt-2">
              {amazonRateType === 'prep' && 'Preparation & inspection services'}
              {amazonRateType === 'middleMile' && 'Warehouse to fulfillment center'}
              {amazonRateType === 'fbaShipment' && 'Fulfillment by Amazon shipping'}
              {amazonRateType === 'combined' && 'Complete Solution by Amazon shipping'}
            </p>
          </div>

          {/* Hazmat Filter Selection */}
          <div className="hazmat-filter-section" style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #dee2e6',
            marginBottom: '30px'
          }}>
            <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600' }}>
              Filter Shipments by Hazmat Status
            </h4>

            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                <input
                  type="radio"
                  name="hazmatFilter"
                  value="all"
                  checked={hazmatFilter === 'all'}
                  onChange={(e) => setHazmatFilter(e.target.value)}
                  style={{ marginRight: '8px' }}
                />
                <span>All Shipments</span>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                <input
                  type="radio"
                  name="hazmatFilter"
                  value="hazmat"
                  checked={hazmatFilter === 'hazmat'}
                  onChange={(e) => setHazmatFilter(e.target.value)}
                  style={{ marginRight: '8px' }}
                />
                <span>Hazmat Only</span>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                <input
                  type="radio"
                  name="hazmatFilter"
                  value="non-hazmat"
                  checked={hazmatFilter === 'non-hazmat'}
                  onChange={(e) => setHazmatFilter(e.target.value)}
                  style={{ marginRight: '8px' }}
                />
                <span>Non-Hazmat Only</span>
              </label>
            </div>

            {hazmatFilter !== 'all' && (
              <p style={{
                marginTop: '10px',
                fontSize: '12px',
                color: '#6c757d',
                fontStyle: 'italic'
              }}>
                ℹ️ Analysis will only include {hazmatFilter === 'hazmat' ? 'hazmat' : 'non-hazmat'} shipments
              </p>
            )}
          </div>

          {/* File Upload Button */}
          <label className="block">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleAmazonUpload}
              disabled={amazonLoading}
              className="hidden"
            />
            <span className={`w-full bg-gradient-to-r from-orange-500 to-orange-700 hover:from-orange-600 hover:to-orange-800 text-white px-6 py-4 rounded-lg cursor-pointer flex items-center justify-center gap-3 transition-all transform hover:scale-105 shadow-lg font-semibold ${
              amazonLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}>
              <Upload size={20} />
              {amazonLoading ? 'Processing...' : 'Choose Amazon File'}
            </span>
          </label>

          {/* Selected File Info */}
          {amazonFile && (
            <div className="mt-4 text-sm text-gray-400 bg-[#0f1419] p-4 rounded-lg border border-gray-800">
              <FileText className="inline mr-2" size={16} />
              <span className="text-orange-400 font-semibold">{amazonFile.name}</span>
            </div>
          )}

          {/* Format Guide */}
          <div className="mt-6 bg-[#0f1419] p-4 rounded-lg border border-gray-800">
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <FileText size={16} className="text-orange-400" />
              Expected Format
            </h4>
            <ul className="text-xs text-gray-400 space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-orange-400 mt-0.5">•</span>
                <span>Smash Foods CSV/Excel format</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-400 mt-0.5">•</span>
                <span>State, Weight, Cost columns required</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-400 mt-0.5">•</span>
                <span>Shipping method & zone optional</span>
              </li>
            </ul>
          </div>

          {/* Recent Amazon Reports */}
          <div className="mt-6">
            <h4 className="text-xs font-semibold text-gray-400 mb-2">Recent Amazon Reports</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {reports
                .filter(r => r.filename.toLowerCase().includes('amz') || r.filename.toLowerCase().includes('amazon'))
                .slice(0, 3)
                .map((report) => (
                  <div
                    key={report.id}
                    className="bg-[#0f1419] p-2 rounded text-xs flex items-center justify-between hover:bg-[#1a1f2e] transition-colors"
                  >
                    <span className="text-white truncate flex-1">{report.filename}</span>
                    <button
                      onClick={() => loadReport(report.id)}
                      className="text-orange-500 hover:text-orange-400 font-semibold ml-2"
                    >
                      View
                    </button>
                  </div>
                ))}
              {reports.filter(r => r.filename.toLowerCase().includes('amz') || r.filename.toLowerCase().includes('amazon')).length === 0 && (
                <p className="text-xs text-gray-600">No Amazon reports yet</p>
              )}
            </div>
          </div>
        </div>

        {/* ============== SHOPIFY UPLOAD CARD ============== */}
        <div className="bg-[#1a1f2e] rounded-xl p-8 border border-green-500/30 hover:border-green-400/60 transition-all shadow-2xl hover:shadow-green-500/20">

          {/* Shopify Logo & Header */}
          <div className="text-center mb-6">
          <div className="bg-white rounded-2xl w-24 h-24 flex items-center justify-center mx-auto mb-4 shadow-lg">
            {/* ACTUAL LOGO IMAGE */}
            <img
              src={shopifyLogo}
              alt="Shopify"
              className="w-full h-full object-contain"
              onError={(e) => {
                // Fallback to icon if image fails to load
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            {/* Fallback icon (hidden by default) */}
            <div className="hidden bg-gradient-to-br from-green-500 to-green-700 rounded-xl w-full h-full items-center justify-center">
              <ShoppingCart size={48} className="text-white" />
            </div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Shopify Upload</h3>
            <p className="text-gray-400">DTC & E-commerce Data</p>
          </div>

          {/* Rate Type Dropdown */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Select Rate Type
            </label>
            <select
              value={shopifyRateType}
              onChange={(e) => setShopifyRateType(e.target.value)}
              disabled={shopifyLoading}
              className="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-all disabled:opacity-50"
            >
              <option value="orderUpdate">Order Update</option>
              <option value="productUpdate">Product Update</option>
            </select>
            <p className="text-xs text-gray-500 mt-2">
              {shopifyRateType === 'orderUpdate' && 'Order fulfillment & shipping updates'}
              {shopifyRateType === 'productUpdate' && 'Product catalog & inventory updates'}
            </p>
          </div>

          {/* File Upload Button */}
          <label className="block">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleShopifyUpload}
              disabled={shopifyLoading}
              className="hidden"
            />
            <span className={`w-full bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white px-6 py-4 rounded-lg cursor-pointer flex items-center justify-center gap-3 transition-all transform hover:scale-105 shadow-lg font-semibold ${
              shopifyLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}>
              <Upload size={20} />
              {shopifyLoading ? 'Processing...' : 'Choose Shopify File'}
            </span>
          </label>

          {/* Selected File Info */}
          {shopifyFile && (
            <div className="mt-4 text-sm text-gray-400 bg-[#0f1419] p-4 rounded-lg border border-gray-800">
              <FileText className="inline mr-2" size={16} />
              <span className="text-green-400 font-semibold">{shopifyFile.name}</span>
            </div>
          )}

          {/* Format Guide */}
          <div className="mt-6 bg-[#0f1419] p-4 rounded-lg border border-gray-800">
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <FileText size={16} className="text-green-400" />
              Expected Format
            </h4>
            <ul className="text-xs text-gray-400 space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">•</span>
                <span>Shopify Orders CSV export</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">•</span>
                <span>Shipping Address, Line Items required</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">•</span>
                <span>Order weight & shipping cost</span>
              </li>
            </ul>
          </div>

          {/* Recent Shopify Reports */}
          <div className="mt-6">
            <h4 className="text-xs font-semibold text-gray-400 mb-2">Recent Shopify Reports</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {reports
                .filter(r => r.filename.toLowerCase().includes('shopify') || r.filename.toLowerCase().includes('dtc'))
                .slice(0, 3)
                .map((report) => (
                  <div
                    key={report.id}
                    className="bg-[#0f1419] p-2 rounded text-xs flex items-center justify-between hover:bg-[#1a1f2e] transition-colors"
                  >
                    <span className="text-white truncate flex-1">{report.filename}</span>
                    <button
                      onClick={() => loadReport(report.id)}
                      className="text-green-500 hover:text-green-400 font-semibold ml-2"
                    >
                      View
                    </button>
                  </div>
                ))}
              {reports.filter(r => r.filename.toLowerCase().includes('shopify') || r.filename.toLowerCase().includes('dtc')).length === 0 && (
                <p className="text-xs text-gray-600">No Shopify reports yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="max-w-7xl mx-auto mt-8 bg-[#1a1f2e] rounded-xl p-6 border border-blue-500/20">
        <h3 className="text-lg font-bold text-white mb-4">📘 Need Help?</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-400">
          <div>
            <h4 className="text-white font-semibold mb-2">Amazon Rate Types:</h4>
            <ul className="space-y-1">
              <li><strong className="text-orange-400">Prep:</strong> Prep center services & inspection</li>
              <li><strong className="text-orange-400">Middle Mile:</strong> Transport to fulfillment centers</li>
              <li><strong className="text-orange-400">FBA Shipment:</strong> Amazon fulfillment shipping</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-2">Shopify Rate Types:</h4>
            <ul className="space-y-1">
              <li><strong className="text-green-400">Order Update:</strong> Order fulfillment & delivery</li>
              <li><strong className="text-green-400">Product Update:</strong> Inventory & catalog changes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

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

  const handleAdminRateUpload = async (event) => {
  event.preventDefault();

  console.log('Upload attempt - File:', adminRateFile);
  console.log('Upload attempt - Rate Name:', adminRateName);
  console.log('Upload attempt - Rate Type:', adminRateType);

  if (!adminRateFile) {
    setAdminMessage({ type: 'error', text: 'Please select a file' });
    return;
  }

  if (!adminRateName || adminRateName.trim() === '') {
    setAdminMessage({ type: 'error', text: 'Please enter a rate name' });
    return;
  }

  setAdminUploading(true);
  setAdminMessage(null);

  const formData = new FormData();
  formData.append('file', adminRateFile);
  formData.append('rateName', adminRateName.trim());
  formData.append('effectiveDate', adminEffectiveDate);

  // Debug FormData
  for (let pair of formData.entries()) {
    console.log('FormData:', pair[0], pair[1]);
  }

  try {
    const token = localStorage.getItem('authToken');
    console.log('Auth token exists:', !!token);

    const response = await axios.post(
      `${API_URL}/admin/rates/upload/${adminRateType}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
      }
    );

    console.log('Upload response:', response.data);

    if (response.data.success) {
      setAdminMessage({
        type: 'success',
        text: `Rate "${adminRateName}" uploaded successfully!`
      });

      // Reset form
      setAdminRateFile(null);
      setAdminRateName('');
      setAdminEffectiveDate(new Date().toISOString().split('T')[0]);

      // Reset file input
      document.getElementById('admin-rate-file').value = '';
    }
  } catch (err) {
  console.error('Admin rate upload error:', err);
  console.error('Error response:', err.response);

  const errorMessage = err.response?.data?.error ||
                      err.response?.data?.message ||
                      err.response?.data?.details ||
                      'Upload failed. Please check backend logs.';

  setAdminMessage({
    type: 'error',
    text: errorMessage
  });
  } finally {
    setAdminUploading(false);
  }
};

const handleDownloadTemplate = () => {
  const url = `${API_URL}/admin/rates/template/${adminRateType}`;
  // Include auth token in download
  window.open(url + '?token=' + localStorage.getItem('authToken'), '_blank');
};

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

  const AdminRatePanel = () => {
    const rateTypeOptions = [
      { value: 'prep', label: 'Prep Services Rates' },
      { value: 'middleMile', label: 'Middle-Mile Transport Rates' },
      { value: 'fbaShipment', label: 'FBA Shipment Rates' }
    ];

  return (
    <div className="bg-[#1a1f2e] rounded-xl p-6 border border-gray-800 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-white text-2xl font-bold mb-2 flex items-center gap-2">
            <Settings className="text-blue-400" size={28} />
            Admin Rate Management
          </h3>
          <p className="text-gray-400">Upload Excel files with rate configurations</p>
        </div>
        <button
          onClick={() => setShowAdminPanel(!showAdminPanel)}
          className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg transition-colors"
        >
          {showAdminPanel ? 'Hide Panel' : 'Show Panel'}
        </button>
      </div>

      {showAdminPanel && (
        <form onSubmit={handleAdminRateUpload} className="space-y-6">
          {/* Rate Type Selection */}
          <div>
            <label className="block text-gray-300 font-semibold mb-2">
              Rate Type
            </label>
            <select
              value={adminRateType}
              onChange={(e) => setAdminRateType(e.target.value)}
              className="w-full bg-[#242936] text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-600"
            >
              {rateTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Rate Name */}
          <div>
            <label className="block text-gray-300 font-semibold mb-2">
              Rate Name *
            </label>
            <input
              type="text"
              value={adminRateName}
              onChange={(e) => setAdminRateName(e.target.value)}
              placeholder="e.g., Q2 2025 Prep Rates"
              className="w-full bg-[#242936] text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-600"
              required
            />
          </div>

          {/* Effective Date */}
          <div>
            <label className="block text-gray-300 font-semibold mb-2">
              Effective Date *
            </label>
            <input
              type="date"
              value={adminEffectiveDate}
              onChange={(e) => setAdminEffectiveDate(e.target.value)}
              className="w-full bg-[#242936] text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-600"
              required
            />
          </div>

          {/* File Upload - UPDATED WITHOUT REQUIRED ATTRIBUTE */}
          <div>
            <label className="block text-gray-300 font-semibold mb-2">
              Rate Configuration File *
            </label>
            <div className="relative">
              <input
                id="admin-rate-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const file = e.target.files[0];
                  console.log('File selected:', file); // Debug
                  setAdminRateFile(file);
                  // Auto-fill rate name from filename if empty
                  if (file && !adminRateName) {
                    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                    setAdminRateName(nameWithoutExt);
                  }
                }}
                className="w-full bg-[#242936] text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-700 file:text-white hover:file:bg-blue-800"
                // REMOVED: required
              />
              {adminRateFile && (
                <div className="mt-2 text-sm text-gray-400">
                  Selected: {adminRateFile.name}
                </div>
              )}
            </div>
          </div>

          {/* Message Display */}
          {adminMessage && (
            <div className={`rounded-lg p-4 border ${
              adminMessage.type === 'success'
                ? 'bg-green-900/20 border-green-500 text-green-400'
                : 'bg-red-900/20 border-red-500 text-red-400'
            }`}>
              {adminMessage.text}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
              disabled={adminUploading}
            >
              <Download size={20} />
              Download Template
            </button>

            <button
              type="submit"
              className="flex-1 bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={adminUploading || !adminRateFile}
            >
              <Upload size={20} />
              {adminUploading ? 'Uploading...' : 'Upload Rate Configuration'}
            </button>
          </div>

          {/* Help Text */}
          <div className="bg-[#242936] rounded-lg p-4 mt-4">
            <h4 className="text-white font-semibold mb-2">📖 How to Use</h4>
            <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
              <li>Download the template for your rate type</li>
              <li>Fill in your rate information in Excel</li>
              <li>Save the file and upload it here</li>
              <li>The new rate will become active on the effective date</li>
            </ol>
          </div>
        </form>
      )}
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
    {/* UPDATED: Pure blue animated background */}
    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-blue-700/20 to-blue-900/20 animate-gradient-shift"></div>

    {/* UPDATED: Blue floating orbs */}
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute w-96 h-96 bg-blue-500/20 rounded-full blur-3xl -top-48 -left-48 animate-float"></div>
      <div className="absolute w-96 h-96 bg-blue-600/20 rounded-full blur-3xl -bottom-48 -right-48 animate-float-delayed"></div>
      <div className="absolute w-64 h-64 bg-blue-400/20 rounded-full blur-3xl top-1/3 right-1/4 animate-float-slow"></div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000,transparent)]"></div>
    </div>

    <div className="relative flex flex-col items-center justify-center min-h-[calc(100vh-250px)] max-w-6xl mx-auto">

      {/* Main content card */}
      <div className="w-full backdrop-blur-xl bg-[#1a1f2e]/60 rounded-3xl p-12 border border-gray-700/50 shadow-2xl shadow-blue-500/10 animate-fade-in-up">

        {/* Hero Section */}
        <div className="text-center mb-12">
          {/* UPDATED: Pure blue gradient logo container */}
          <div className="relative inline-block mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-700 rounded-3xl blur-3xl opacity-50 animate-pulse-slow"></div>
            <div className="relative bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-3xl w-40 h-40 flex items-center justify-center shadow-2xl shadow-blue-500/40 animate-float p-4">
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent animate-shine rounded-3xl"></div>
              <img
                src={amzprepLogo}
                alt="AMZ Prep Logo"
                className="w-full h-full object-contain drop-shadow-2xl relative z-10"
              />
            </div>
          </div>

          {/* UPDATED: Pure blue gradient title */}
          <h1 className="text-6xl font-black mb-6 animate-fade-in">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 animate-gradient-text">
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

        {/* Feature Cards Grid - UPDATED to blue theme only */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">

          {/* Feature 1 - Light Blue */}
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

          {/* Feature 2 - Medium Blue */}
          <div className="group relative bg-gradient-to-br from-blue-600/10 to-blue-700/10 border border-blue-600/30 rounded-2xl p-6 hover:border-blue-500/60 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-blue-600/30 animate-fade-in-stagger-2">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/0 to-blue-600/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <div className="bg-blue-600/20 w-16 h-16 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <TruckIcon size={32} className="text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Warehouse Optimization</h3>
              <p className="text-gray-400 leading-relaxed">
                AI-powered recommendations for optimal warehouse configurations to minimize costs
              </p>
            </div>
          </div>

          {/* Feature 3 - Dark Blue */}
          <div className="group relative bg-gradient-to-br from-blue-700/10 to-blue-800/10 border border-blue-700/30 rounded-2xl p-6 hover:border-blue-600/60 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-blue-700/30 animate-fade-in-stagger-3">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-700/0 to-blue-700/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <div className="bg-blue-700/20 w-16 h-16 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <MapPin size={32} className="text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Geographic Insights</h3>
              <p className="text-gray-400 leading-relaxed">
                Interactive heat maps and state-level analysis for strategic decision making
              </p>
            </div>
          </div>
        </div>

        {/* Stats Banner - UPDATED pure blue theme */}
        <div className="bg-gradient-to-r from-blue-600/20 via-blue-700/20 to-blue-800/20 border border-gray-700/50 rounded-2xl p-8 mb-10 animate-fade-in-stagger-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
            <div className="group hover:scale-110 transition-transform duration-300">
              <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600 mb-2">
                100K+
              </div>
              <div className="text-gray-400 text-sm font-semibold">Shipments Analyzed</div>
            </div>
            <div className="group hover:scale-110 transition-transform duration-300">
              <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-blue-700 mb-2">
                $2M+
              </div>
              <div className="text-gray-400 text-sm font-semibold">Cost Savings Identified</div>
            </div>
            <div className="group hover:scale-110 transition-transform duration-300">
              <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-800 mb-2">
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

        {/* UPDATED: Pure Blue CTA Button - matches screenshot style */}
        <div className="text-center animate-fade-in-stagger-5">
          <button
            onClick={() => setActiveView('upload')}
            className="group relative inline-flex items-center gap-4 px-12 py-6 bg-gradient-to-r from-sky-500 via-blue-600 to-blue-700 rounded-2xl text-white font-bold text-xl shadow-2xl shadow-blue-500/40 hover:shadow-blue-500/60 transition-all duration-500 hover:scale-105 overflow-hidden"
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

      {/* UPDATED: Blue floating elements */}
      <div className="absolute top-20 left-10 w-20 h-20 bg-blue-500/10 rounded-lg backdrop-blur-sm border border-blue-500/20 animate-float-element-1 hidden lg:block"></div>
      <div className="absolute bottom-20 right-10 w-24 h-24 bg-blue-600/10 rounded-lg backdrop-blur-sm border border-blue-600/20 animate-float-element-2 hidden lg:block"></div>
      <div className="absolute top-1/2 right-20 w-16 h-16 bg-blue-700/10 rounded-lg backdrop-blur-sm border border-blue-700/20 animate-float-element-3 hidden lg:block"></div>

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

const WarehouseLocationMap = ({ warehouses }) => (
  <div className="bg-[#1a1f2e] rounded-xl p-6 border border-gray-800">
    <h3 className="text-white text-xl font-semibold mb-6 flex items-center gap-2">
      <MapPin className="text-blue-400" size={24} />
      DTC Warehouse Network
    </h3>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {warehouses
        .filter(w => !w.name.includes('('))  // Filter out multi-warehouse strategies
        .map((wh, idx) => (
          <div
            key={idx}
            className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/30 rounded-xl p-4 hover:border-blue-400/60 transition-all duration-300 hover:scale-105"
          >
            <div className="flex items-start gap-3">
              <div className="bg-blue-500/20 p-2 rounded-lg flex-shrink-0">
                <MapPin size={20} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-bold text-sm mb-1">{wh.name}</h4>
                <p className="text-gray-400 text-xs mb-2 leading-relaxed">
                  {wh.fullAddress}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                    {wh.region}
                  </span>
                  {wh.specialty && (
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded">
                      {wh.specialty}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
    </div>
  </div>
);

const ReportsPanel = () => {
  const [showAllReports, setShowAllReports] = useState(false);
  const displayReports = showAllReports ? reports : reports.slice(0, 5);

  return (
    <div className="bg-[#1a1f2e] rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white text-lg font-semibold flex items-center gap-2">
          <FileText className="text-blue-400" size={20} />
          Your Reports ({reports.length})
        </h3>
        {reports.length > 5 && (
          <button
            onClick={() => setShowAllReports(!showAllReports)}
            className="text-blue-400 hover:text-blue-300 text-sm font-semibold"
          >
            {showAllReports ? 'Show Less' : `Show All (${reports.length})`}
          </button>
        )}
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FileText size={48} className="mx-auto mb-3 opacity-50" />
          <p>No reports yet. Upload data to create your first report!</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {displayReports.map((report) => (
            <div
              key={report.id}
              className={`p-4 rounded-lg border transition-all ${
                currentReportId === report.id
                  ? 'bg-blue-500/10 border-blue-500/50'
                  : 'bg-[#0f1419] border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {currentReportId === report.id && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded font-bold">
                        CURRENT
                      </span>
                    )}
                    <h4 className="text-white font-medium truncate">{report.filename}</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                    <div>
                      <span className="text-gray-500">Shipments:</span>{' '}
                      <span className="text-white font-semibold">{report.totalShipments.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Avg Cost:</span>{' '}
                      <span className="text-white font-semibold">
                        {typeof report.avgCost === 'number' ? `$${report.avgCost}` : report.avgCost}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Date:</span>{' '}
                      <span className="text-white">{new Date(report.uploadDate).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Period:</span>{' '}
                      <span className="text-white">{report.analysisMonths} month{report.analysisMonths > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {currentReportId !== report.id && (
                    <button
                      onClick={() => loadReport(report.id)}
                      disabled={loading}
                      className="text-blue-400 hover:text-blue-300 text-sm font-semibold px-3 py-1 rounded hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                    >
                      Load
                    </button>
                  )}
                  <button
                    onClick={() => deleteReport(report.id)}
                    disabled={deletingReportId === report.id}
                    className="text-red-400 hover:text-red-300 text-sm font-semibold px-3 py-1 rounded hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    {deletingReportId === report.id ? (
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-red-500 border-t-transparent"></div>
                    ) : (
                      'Delete'
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Admin User Management Component - Add this around line 1500
const AdminUserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/admin/users`, {
        headers: getAuthHeader()
      });

      if (response.data.success) {
        setUsers(response.data.users);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserRole = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';

    try {
      const response = await axios.put(
        `${API_URL}/admin/users/${userId}/role`,
        { role: newRole },
        { headers: getAuthHeader() }
      );

      if (response.data.success) {
        setUsers(users.map(u =>
          u._id === userId ? { ...u, role: newRole } : u
        ));

        setSuccess(`User role updated to ${newRole}`);
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      setError('Failed to update user role');
    }
  };

  useEffect(() => {
    if (showUserManagement) {
      fetchUsers();
    }
  }, [showUserManagement]);

  if (!showUserManagement) return null;

  return (
    <div className="bg-[#1a1f2e] rounded-xl p-6 border border-gray-800 mb-6">
      <h3 className="text-white text-2xl font-bold mb-4">User Management</h3>

      {loading ? (
        <div className="text-gray-400">Loading users...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#242936]">
              <tr>
                <th className="px-4 py-3 text-gray-300">Email</th>
                <th className="px-4 py-3 text-gray-300">Name</th>
                <th className="px-4 py-3 text-gray-300">Role</th>
                <th className="px-4 py-3 text-gray-300">Last Login</th>
                <th className="px-4 py-3 text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id} className="border-t border-gray-700">
                  <td className="px-4 py-3 text-gray-200">{u.email}</td>
                  <td className="px-4 py-3 text-gray-200">{u.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      u.role === 'admin'
                        ? 'bg-blue-700 text-white'
                        : 'bg-gray-600 text-gray-200'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-200">
                    {new Date(u.lastLogin).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleUserRole(u._id, u.role)}
                      className={`px-3 py-1 rounded text-sm ${
                        u.role === 'admin'
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-green-600 hover:bg-green-700'
                      } text-white transition-colors`}
                      disabled={u.email === user?.email}
                    >
                      {u.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

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

        {/* Check if Smash Foods format */}

          {(dashboardData?.metadata?.dataFormat === 'smash_foods_actual' ||
          dashboardData?.metadata?.dataFormat === 'muscle_mac_actual') ? (
          <SmashFoodsDashboard data={dashboardData} />
          ) : (
          <>
          </>
          // standard dashboard
        )}

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
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500"
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
          <div className="bg-gradient-to-r from-sky-500 to-blue-700 rounded-xl p-8 border border-blue-500 shadow-2xl shadow-blue-500/20">
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

        {/* Warehouse Location Network */}
        {dashboardData.warehouseComparison && (
          <WarehouseLocationMap warehouses={dashboardData.warehouseComparison} />
        )}

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
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          {wh.recommended && (
                            <span className="text-xs bg-green-500 text-white px-2 py-1 rounded font-bold">
                              ✓ RECOMMENDED
                            </span>
                          )}
                          {wh.specialty && (
                            <span className="text-xs bg-amber-500 text-white px-2 py-1 rounded font-bold">
                              {wh.specialty}
                            </span>
                          )}
                          <span className="text-white font-semibold">{wh.name}</span>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-gray-500">
                          <MapPin size={12} className="mt-0.5 flex-shrink-0" />
                          <span>{wh.fullAddress}</span>
                        </div>
                        {wh.region && (
                          <span className="text-xs text-blue-400 font-medium">
                            {wh.region}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-center py-4 px-4 text-gray-300">
                      {wh.shipments.toLocaleString()}
                    </td>
                    <td className="text-center py-4 px-4 text-white font-semibold">
                      ${wh.cost.toLocaleString()}
                    </td>
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

        <ReportsPanel />

        <div className="flex flex-wrap gap-4">
          <button
            onClick={exportToPDF}
            disabled={exportingPDF || !currentReportId}
            className="bg-gradient-to-r from-sky-500 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-4 rounded-lg flex items-center gap-3 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
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
          <h1 className="text-4xl font-black text-white mb-2 bg-gradient-to-r from-blue-400 to-blue-400 bg-clip-text text-transparent">
            Shipping Analytics Dashboard
          </h1>
          <p className="text-gray-400 text-lg">
            Comprehensive shipping cost analysis and warehouse optimization
          </p>
        </div>

        {activeView === 'upload' ? <UploadView /> : <DashboardView />}
      </div>
      {showUserManagement && user?.role === 'admin' && (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-[#1a1f2e] rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden border border-gray-700 shadow-2xl">
          <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gradient-to-r from-blue-700 to-blue-800">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users size={24} />
              User Management
            </h2>
            <button
              onClick={() => setShowUserManagement(false)}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[70vh]">
            <AdminUserManagement />
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default ShippingAnalytics;
