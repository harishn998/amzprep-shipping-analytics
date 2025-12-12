import React, { useState, useEffect, useCallback } from 'react';
import { Upload, BarChart3, Package, DollarSign, Download, Settings, LogOut, AlertCircle, CheckCircle, MapPin, FileText, TruckIcon, ShoppingCart, Users, X, Menu, ChevronLeft, ChevronRight, Search, Bell, Zap, Activity, TrendingUp, FileSpreadsheet } from 'lucide-react';
import axios from 'axios';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import amzprepLogo from './assets/amzprep_white_logo.png';
import { useAuth } from './contexts/AuthContext';
import amazonLogo from './assets/amazon-logo.png';
import shopifyLogo from './assets/shopify-logo.png';
import { SmashFoodsDashboard } from './SmashFoodsDashboardComponents';
import { ProcessingModal } from './ProcessingModal';
import { ShippingScorecard } from './ShippingScorecard';
import { CostConfigPanel } from './components/CostConfigPanel';
import SeparateTabUploader from './components/SeparateTabUploader';
import UploadModeToggle from './components/UploadModeToggle';
import FBAZoningManager from './components/admin/FBAZoningManager';


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
  const [processingModalOpen, setProcessingModalOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processedShipments, setProcessedShipments] = useState(0);
  const [totalShipments, setTotalShipments] = useState(0);
  const [processingStats, setProcessingStats] = useState({
    avgCostPerUnit: 0,
    totalUnits: 0,
    totalShippingCost: 0,
    totalPlacementFees: 0
  });
  const [viewType, setViewType] = useState('scorecard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [costConfig, setCostConfig] = useState({
    freightCost: 1315,
    freightMarkup: 1.2,
    mmBaseCost: 2.625,
    mmMarkup: 1.0,
    rateMode: 'FTL',
    destination: 'KY',
    palletCost: 150,
    analysisYear: new Date().getFullYear(),
    analysisStartMonth: 1,
    analysisEndMonth: 9,    // Default to September
    shipFromFilter: []
  });
  const [uploadMode, setUploadMode] = useState('separate');

  // 🆕 ADD THIS LINE:
  const [costConfigExpanded, setCostConfigExpanded] = useState(false);

  // 🆕 Brand name extracted from uploaded filename
  const [brandName, setBrandName] = useState(null);

  // 🆕 Helper function to extract brand name from filename
  const extractBrandName = (filename) => {
    if (!filename) return null;

    // Remove file extension
    let name = filename.replace(/\.[^/.]+$/, '');

    // Replace underscores with spaces for consistent handling
    name = name.replace(/_/g, ' ');

    // Remove common prefixes (case-insensitive)
    name = name.replace(/^copy\s*(of\s*)?/i, '');

    // Remove common suffixes (case-insensitive)
    name = name.replace(/[\s-]*[-–]\s*full\s*data\s*analysis$/i, '');
    name = name.replace(/[\s-]*full\s*data\s*analysis$/i, '');
    name = name.replace(/[\s-]*analysis$/i, '');

    // Clean up extra spaces and dashes
    name = name.replace(/^[\s-]+|[\s-]+$/g, '');
    name = name.replace(/\s+/g, ' ').trim();

    return name || null;
  };

  const handleCostConfigChange = useCallback((newConfig) => {
  console.log('💰 Cost configuration updated:', newConfig);
  setCostConfig(newConfig);
}, []);

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
  setBrandName(extractBrandName(file.name));  // 🆕 Extract brand name from filename
  setLoading(true);
  setError(null);
  setSuccess(null);

  // 🆕 Open processing modal
  setProcessingModalOpen(true);
  setUploadProgress(0);
  setProcessedShipments(0);
  setTotalShipments(0);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('rateType', rateType);
  formData.append('hazmatFilter', hazmatFilter);

  try {
    // Simulate initial progress
    setUploadProgress(10);

    const response = await axios.post(`${API_URL}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...getAuthHeader()
      },
      // 🆕 Track upload progress
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 50) / progressEvent.total);
        setUploadProgress(percentCompleted);
      }
    });

    // Simulate processing steps
    setUploadProgress(60);

    if (response.data.success) {
      // Extract stats for the modal
      const data = response.data.data;
      const metadata = data.metadata || {};

      // 🆕 Update processing stats
      setTotalShipments(data.totalShipments || 0);
      setProcessedShipments(data.totalShipments || 0);
      setProcessingStats({
        avgCostPerUnit: metadata.currentMetrics?.costPerUnit || 0,
        totalUnits: metadata.totalUnits || 0,
        totalShippingCost: metadata.currentCosts?.totalFreight || 0,
        totalPlacementFees: metadata.currentCosts?.totalPlacementFees || 0
      });

      setUploadProgress(80);

      // Prepare data with state codes
      const dataWithCodes = {
        ...data,
        topStates: data.topStates.map(state => ({
          ...state,
          code: state.code || stateNameToCode[state.name] || state.name.substring(0, 2).toUpperCase()
        })),
        hazmat: data.hazmat || null,
        metadata: metadata
      };

      setUploadProgress(95);

      // Debug log
      console.log('📊 Dashboard data with hazmat:', {
        hasHazmat: !!dataWithCodes.hazmat,
        hazmatProducts: dataWithCodes.hazmat?.products?.hazmat,
        hazmatTypes: dataWithCodes.hazmat?.typeBreakdown?.length
      });

      setDashboardData(dataWithCodes);
      setCurrentReportId(response.data.reportId);

      setUploadProgress(100);

      // 🆕 Close modal after a brief delay to show 100%
      setTimeout(() => {
        setProcessingModalOpen(false);
        setSuccess('File uploaded and processed successfully!');
        setActiveView('dashboard');
        fetchReports();
      }, 500);
    }
  } catch (err) {
    // Close modal on error
    setProcessingModalOpen(false);

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
      link.setAttribute('download', `AMZ-Prep-Analytics-Report-${currentReportId}.pdf`);
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
      headers: getAuthHeader()
    });

    // Set dashboard data
    setDashboardData(response.data);
    setCurrentReportId(reportId);

    // ✅ Extract brand name from report filename
    const reportFilename = response.data.filename || '';
    const extractedBrand = extractBrandName(reportFilename);
    setBrandName(extractedBrand);

    console.log('📂 Loaded report:', {
      filename: reportFilename,
      brandName: extractedBrand
    });

    setActiveView('dashboard');
  } catch (err) {
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

const PremiumSidebar = () => {
  // Function to download template
  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`${API_URL}/templates/mm-rate-template`, {
        method: 'GET',
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'MM-Rate-Sample-Template.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Failed to download template');
      }
    } catch (error) {
      console.error('Error downloading template:', error);
    }
  };

  return (
  <div className={`fixed left-0 top-0 h-full transition-all duration-500 ease-in-out z-50 ${
    sidebarCollapsed ? 'w-20' : 'w-72'
  }`}>
    {/* Background */}
    <div className="absolute inset-0 bg-[#000000]">
      {/* Subtle right border */}
      <div className="absolute top-0 right-0 bottom-0 w-px bg-white/10"></div>
    </div>

    {/* Content */}
    <div className="relative flex flex-col h-full">
      {/* Header Section - Logo Area */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <img
            src={amzprepLogo}
            alt="AMZ Prep"
            className="h-8 w-auto object-contain"
          />
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 px-4 py-2">
        <div className="space-y-1">
          <NavItem
            icon={BarChart3}
            label="Dashboard"
            active={activeView === 'dashboard'}
            onClick={() => setActiveView('dashboard')}
            collapsed={sidebarCollapsed}
          />
          <NavItem
            icon={Upload}
            label="Upload Data"
            active={activeView === 'upload'}
            onClick={() => setActiveView('upload')}
            collapsed={sidebarCollapsed}
            badge="2"
          />

          {/* Admin Section */}
          {user?.role === 'admin' && (
            <>
              {/* Divider with more spacing */}
              <div className="h-px mt-6 mb-4 bg-white/10"></div>

              {!sidebarCollapsed && (
                <p
                  className="text-xs font-medium uppercase tracking-wider px-4 mb-3"
                  style={{
                    marginTop: '1.25rem',
                    background: 'linear-gradient(to right, #0386FE, #9507FF)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Administration
                </p>
              )}

              {/* Manage Users */}
              <NavItem
                icon={Users}
                label="Manage Users"
                active={activeView === 'admin-users'}
                onClick={() => {
                  setActiveView('admin-users');
                  setShowUserManagement(true);
                }}
                collapsed={sidebarCollapsed}
              />

              {/* FBA Zoning - NEW */}
              <NavItem
                icon={FileSpreadsheet}
                label="FBA Zoning"
                active={activeView === 'admin-fba-zoning'}
                onClick={() => setActiveView('admin-fba-zoning')}
                collapsed={sidebarCollapsed}
              />
            </>
          )}

          {/* Resources Section - Download Templates */}
          <>
            <div className="h-px mt-6 mb-4 bg-white/10"></div>

            {!sidebarCollapsed && (
              <p
                className="text-xs font-medium uppercase tracking-wider px-4 mb-3"
                style={{
                  marginTop: '1.25rem',
                  marginBottom: '0.85rem',
                  background: 'linear-gradient(to right, #0386FE, #9507FF)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Resources
              </p>
            )}

            {/* Download Template Card */}
            {!sidebarCollapsed ? (
              <div
                className="mx-2 p-4 rounded-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer group"
                style={{
                  background: 'linear-gradient(135deg, rgba(3, 134, 254, 0.08), rgba(149, 7, 255, 0.05))',
                  border: '1px solid rgba(3, 134, 254, 0.2)'
                }}
                onClick={handleDownloadTemplate}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{
                      background: 'linear-gradient(135deg, #0386FE, #9507FF)'
                    }}
                  >
                    <Download size={16} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white text-sm font-medium">Rate Template</h4>
                    <p className="text-gray-400 text-xs">Single File Upload (Sample Excel format)</p>
                  </div>
                </div>

                <button
                  className="w-full py-2 px-3 rounded-lg text-xs font-medium transition-all duration-300 flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                  style={{
                    background: 'rgba(3, 134, 254, 0.15)',
                    border: '1px solid rgba(3, 134, 254, 0.3)',
                    color: '#0386FE'
                  }}
                >
                  <Download size={14} />
                  Download MM Template
                </button>
              </div>
            ) : (
              <button
                onClick={handleDownloadTemplate}
                className="w-full flex items-center justify-center p-3 rounded-xl transition-all duration-300 hover:bg-white/5"
                title="Download Rate Template"
              >
                <Download size={20} style={{ color: '#0386FE' }} />
              </button>
            )}
          </>
        </div>
      </div>

      {/* Bottom Section - User Profile */}
      <div className="p-4">
        {!sidebarCollapsed && (
          <div
            className="p-3 rounded-xl mb-3"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <div className="flex items-center gap-3">
              {/* Avatar with Gradient Border */}
              <div className="relative flex-shrink-0">
                <div
                  className="w-11 h-11 rounded-full p-[2px]"
                  style={{
                    background: 'linear-gradient(135deg, #0386FE, #9507FF)'
                  }}
                >
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="w-full h-full rounded-full object-cover bg-[#0a0f1a]"
                    />
                  ) : (
                    <div
                      className="w-full h-full rounded-full flex items-center justify-center text-white font-semibold text-sm bg-[#0a0f1a]"
                    >
                      {user.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                </div>
              </div>

              {/* User Info - Fully visible, no truncate */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Users size={12} className="text-gray-400 flex-shrink-0" />
                  <h3 className="text-white font-medium text-xs">{user.name}</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 text-xs flex-shrink-0">✉</span>
                  <p className="text-white text-xs">{user.email}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={() => {
            logout();
            window.location.href = '/login';
          }}
          className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl transition-all duration-300 hover:bg-white/5"
          style={{
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <LogOut size={18} className="text-gray-400" />
          {!sidebarCollapsed && (
            <span className="text-gray-400 text-sm">Logout</span>
          )}
        </button>

        {/* Footer */}
        {!sidebarCollapsed && (
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">amzprep.com</p>
            <p className="text-xs text-gray-600">@2025 All Rights Reserved</p>
          </div>
        )}
      </div>
    </div>
  </div>
  );
};

const NavItem = ({ icon: Icon, label, active, onClick, collapsed, badge }) => (
  <button
    onClick={onClick}
    className={`group relative w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
      active ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
    }`}
    style={{
      background: active ? 'rgba(3, 134, 254, 0.08)' : 'transparent'
    }}
  >
    {/* Left Indicator Line - Only visible when active */}
    {active && (
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full"
        style={{
          background: 'linear-gradient(to bottom, #0386FE, #9507FF)'
        }}
      />
    )}

    {/* Icon Container */}
    <div
      className="relative p-2 rounded-lg transition-all duration-300"
      style={{
        background: active
          ? 'linear-gradient(135deg, #0386FE, #9507FF)'
          : 'rgba(255, 255, 255, 0.05)',
        boxShadow: active ? '0 4px 12px rgba(3, 134, 254, 0.3)' : 'none'
      }}
    >
      <Icon
        size={16}
        className={active ? 'text-white' : 'text-gray-400 group-hover:text-white'}
      />
    </div>

    {!collapsed && (
      <div className="flex items-center justify-between flex-1">
        <span className={`font-medium text-sm transition-colors duration-300 ${
          active ? 'text-white' : 'text-gray-400 group-hover:text-white'
        }`}>
          {label}
        </span>

        {badge && (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              background: active
                ? 'linear-gradient(135deg, #0386FE, #9507FF)'
                : 'rgba(3, 134, 254, 0.15)',
              color: active ? 'white' : '#0386FE'
            }}
          >
            {badge}
          </div>
        )}
      </div>
    )}
  </button>
);

// REPLACE your existing Alert component with:
const PremiumAlert = ({ type, message, onClose }) => {
  const isError = type === 'error';

  return (
    <div
      className="relative rounded-2xl p-6 mb-8 animate-slideIn backdrop-blur-sm"
      style={{
        background: isError
          ? 'linear-gradient(135deg, rgba(220, 38, 38, 0.1), rgba(220, 38, 38, 0.05))'
          : 'linear-gradient(135deg, rgba(3, 134, 254, 0.1), rgba(149, 7, 255, 0.05))',
        border: '1px solid',
        borderColor: isError ? 'rgba(220, 38, 38, 0.3)' : 'rgba(3, 134, 254, 0.3)',
        boxShadow: isError ? '0 10px 25px rgba(220, 38, 38, 0.1)' : '0 10px 25px rgba(3, 134, 254, 0.1)'
      }}
    >
      <div className="relative flex items-start gap-4">
        <div
          className="p-3 rounded-xl"
          style={{
            background: isError ? 'rgba(220, 38, 38, 0.2)' : 'rgba(3, 134, 254, 0.2)'
          }}
        >
          {isError ? (
            <AlertCircle className="text-red-400" size={24} />
          ) : (
            <CheckCircle
              size={24}
              style={{
                background: 'linear-gradient(to right, #0386FE, #9507FF)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            />
          )}
        </div>

        <div className="flex-1">
          <p
            className="font-medium text-lg"
            style={isError ? { color: '#FCA5A5' } : {
              background: 'linear-gradient(to right, #0386FE, #9507FF)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            {isError ? 'Error' : 'Success'}
          </p>
          <p className="text-white/80 mt-1">{message}</p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors duration-200 text-white/60 hover:text-white"
          >
            <X size={20} />
          </button>
        )}
      </div>
    </div>
  );
};

const Alert = PremiumAlert;

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
    setBrandName(extractBrandName(file.name));  // 🆕 Extract brand name from filename
    setAmazonLoading(true);
    setError(null);
    setSuccess(null);

    // 🆕 Open processing modal
    setProcessingModalOpen(true);
    setUploadProgress(0);
    setProcessedShipments(0);
    setTotalShipments(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadType', 'amazon');
    formData.append('rateType', amazonRateType);
    formData.append('hazmatFilter', hazmatFilter);

    // 🆕 Add cost config
    formData.append('costConfig', JSON.stringify(costConfig));

    try {
      // Simulate initial progress
      setUploadProgress(10);

      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...getAuthHeader()
        },
        // 🆕 Track upload progress
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 50) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });

      // Simulate processing steps
      setUploadProgress(60);

      if (response.data.success) {
        // Extract stats for the modal
        const data = response.data.data;
        const metadata = data.metadata || {};

        // 🆕 Update processing stats
        setTotalShipments(data.totalShipments || 0);
        setProcessedShipments(data.totalShipments || 0);
        setProcessingStats({
          avgCostPerUnit: metadata.currentMetrics?.costPerUnit || 0,
          totalUnits: metadata.totalUnits || 0,
          totalShippingCost: metadata.currentCosts?.totalFreight || 0,
          totalPlacementFees: metadata.currentCosts?.totalPlacementFees || 0
        });

        setUploadProgress(80);

        const dataWithCodes = {
          ...data,
          topStates: data.topStates.map(state => ({
            ...state,
            code: state.code || stateNameToCode[state.name] || state.name.substring(0, 2).toUpperCase()
          })),
          // 🆕 Explicitly include hazmat data
          hazmat: data.hazmat || null,
          // 🆕 Include metadata
          metadata: metadata
        };

        setUploadProgress(95);

        // 🔍 DEBUG LOG
        console.log('📊 Amazon upload - Dashboard data:', {
          hasHazmat: !!dataWithCodes.hazmat,
          hazmatProducts: dataWithCodes.hazmat?.products?.hazmat
        });

        setDashboardData(dataWithCodes);
        setCurrentReportId(response.data.reportId);

        setUploadProgress(100);

        // 🆕 Close modal after a brief delay to show 100%
        setTimeout(() => {
          setProcessingModalOpen(false);
          setSuccess(`Amazon ${amazonRateType} file uploaded successfully!`);
          setActiveView('dashboard');
          fetchReports();
        }, 500);
      }
    } catch (err) {
      // Close modal on error
      setProcessingModalOpen(false);

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

    // 🆕 Open processing modal
    setProcessingModalOpen(true);
    setUploadProgress(0);
    setProcessedShipments(0);
    setTotalShipments(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadType', 'shopify');
    formData.append('rateType', shopifyRateType);

    try {
      // Simulate initial progress
      setUploadProgress(10);

      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...getAuthHeader()
        },
        // 🆕 Track upload progress
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 50) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });

      // Simulate processing steps
      setUploadProgress(60);

      if (response.data.success) {
        // Extract stats for the modal
        const data = response.data.data;
        const metadata = data.metadata || {};

        // 🆕 Update processing stats
        setTotalShipments(data.totalShipments || 0);
        setProcessedShipments(data.totalShipments || 0);
        setProcessingStats({
          avgCostPerUnit: metadata.currentMetrics?.costPerUnit || 0,
          totalUnits: metadata.totalUnits || 0,
          totalShippingCost: metadata.currentCosts?.totalFreight || 0,
          totalPlacementFees: metadata.currentCosts?.totalPlacementFees || 0
        });

        setUploadProgress(80);

        const dataWithCodes = {
          ...data,
          topStates: data.topStates.map(state => ({
            ...state,
            code: state.code || stateNameToCode[state.name] || state.name.substring(0, 2).toUpperCase()
          })),
          // 🆕 Explicitly include hazmat data
          hazmat: data.hazmat || null,
          // 🆕 Include metadata
          metadata: metadata
        };

        setUploadProgress(95);

        // 🔍 DEBUG LOG
        console.log('📊 Shopify upload - Dashboard data:', {
          hasHazmat: !!dataWithCodes.hazmat,
          hazmatProducts: dataWithCodes.hazmat?.products?.hazmat
        });

        setDashboardData(dataWithCodes);
        setCurrentReportId(response.data.reportId);

        setUploadProgress(100);

        // 🆕 Close modal after a brief delay to show 100%
        setTimeout(() => {
          setProcessingModalOpen(false);
          setSuccess(`Shopify ${shopifyRateType} file uploaded successfully!`);
          setActiveView('dashboard');
          fetchReports();
        }, 500);
      }
    } catch (err) {
      // Close modal on error
      setProcessingModalOpen(false);

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
    <div className="min-h-[calc(100vh-200px)] p-8">
      {/* ============================================================================
          ADMIN RATE MANAGEMENT - HIDDEN (Preserved for future integration)
          Uncomment the line below to enable for admin users:
          {user?.role === 'admin' && <AdminRatePanel />}
      ============================================================================ */}

      {/* Header with Gradient Text */}
      <div className="text-center mb-12">
        <h2
          className="text-3xl lg:text-4xl font-bold tracking-wide uppercase"
          style={{
            background: 'linear-gradient(to right, #FFFFFF, #B0B0B0)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          Choose Your Platform and Rate Type to Begin Analysis
        </h2>
      </div>

      {/* Alerts */}
      {error && <PremiumAlert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Dual Column Layout with Center Divider */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto relative">

        {/* Vertical Divider Line */}
        <div
          className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2"
          style={{
            background: 'linear-gradient(to bottom, transparent, rgba(3, 134, 254, 0.4), rgba(149, 7, 255, 0.4), transparent)'
          }}
        />

        {/* ============== AMAZON UPLOAD CARD ============== */}
        <div
          className="rounded-2xl p-8 backdrop-blur-sm transition-all duration-300 hover:shadow-2xl relative group"
          style={{
            background: 'linear-gradient(135deg, rgba(10, 15, 26, 0.8), rgba(15, 20, 25, 0.6))',
            border: '2px solid transparent',
            backgroundImage: `
              linear-gradient(135deg, rgb(255 255 255 / 4%), rgb(255 255 255 / 0%)),
              linear-gradient(135deg, rgb(255 255 255 / 4%), rgb(255 255 255 / 0%))
            `,
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box'
          }}
        >
          {/* Subtle Glow on Hover */}
          <div
            className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(3, 134, 254, 0.06), transparent 70%)'
            }}
          />

          <div className="relative z-10">
            {/* Amazon Logo & Header */}
            <div className="text-center mb-6">
              <div
                className="rounded-2xl w-20 h-20 flex items-center justify-center mx-auto mb-4 relative overflow-hidden"
                style={{
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
                }}
              >
                <img
                  src={amazonLogo}
                  alt="Amazon"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="hidden bg-gradient-to-br from-orange-500 to-orange-700 rounded-xl w-full h-full items-center justify-center">
                  <Package size={40} className="text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">Amazon Upload</h3>
              <p className="text-gray-400 text-sm">Amazon FBA Data</p>
            </div>

            {/* Rate Type Dropdown */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Select Rate Type
              </label>
              <div className="relative">
                <select
                  value={amazonRateType}
                  onChange={(e) => setAmazonRateType(e.target.value)}
                  disabled={amazonLoading}
                  className="w-full px-4 py-3.5 rounded-xl text-white appearance-none cursor-pointer transition-all duration-300 disabled:opacity-50 outline-none"
                  style={{
                    background: 'rgba(15, 20, 25, 0.8)',
                    border: '1px solid rgba(3, 134, 254, 0.3)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(3, 134, 254, 0.6)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(3, 134, 254, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(3, 134, 254, 0.3)';
                    e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
                  }}
                >
                  <option value="prep">Prep Services</option>
                  <option value="middleMile">Middle Mile</option>
                  <option value="fbaShipment">FBA Shipment</option>
                  <option value="combined">Complete Solution</option>
                </select>
                <div
                  className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, #0386FE, #9507FF)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  ▼
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {amazonRateType === 'prep' && 'Preparation & inspection services'}
                {amazonRateType === 'middleMile' && 'Warehouse to fulfillment center'}
                {amazonRateType === 'fbaShipment' && 'Fulfillment by Amazon shipping'}
                {amazonRateType === 'combined' && 'Complete Solution by Amazon shipping'}
              </p>
            </div>

            {/* Cost Configuration Panel */}
            <CostConfigPanel
              onConfigChange={handleCostConfigChange}
              disabled={amazonLoading}
              expanded={costConfigExpanded}
              onExpandedChange={setCostConfigExpanded}
              initialConfig={costConfig}
            />

            {/* Hazmat Filter Selection */}
            <div
              className="mt-6 mb-6 p-4 rounded-xl"
              style={{
                background: 'rgba(10, 15, 26, 0.4)',
                border: '1px solid rgba(3, 134, 254, 0.2)'
              }}
            >
              <h4 className="mb-3 text-sm font-semibold text-white">
                Filter Shipments by Hazmat Status
              </h4>
              <div className="flex gap-4 flex-wrap">
                {['all', 'hazmat', 'non-hazmat'].map((filter) => (
                  <label
                    key={filter}
                    className="flex items-center cursor-pointer text-sm group"
                  >
                    <input
                      type="radio"
                      name="hazmatFilter"
                      value={filter}
                      checked={hazmatFilter === filter}
                      onChange={(e) => setHazmatFilter(e.target.value)}
                      className="mr-2 accent-[#0386FE]"
                    />
                    <span className="text-gray-300 group-hover:text-white transition-colors">
                      {filter === 'all' ? 'All Shipments' :
                       filter === 'hazmat' ? 'Hazmat Only' :
                       'Non-Hazmat Only'}
                    </span>
                  </label>
                ))}
              </div>
              {hazmatFilter !== 'all' && (
                <p className="mt-3 text-xs text-gray-500 italic">
                  ℹ️ Analysis will only include {hazmatFilter === 'hazmat' ? 'hazmat' : 'non-hazmat'} shipments
                </p>
              )}
            </div>

            {/* Upload Mode Toggle */}
            <UploadModeToggle
              mode={uploadMode}
              onModeChange={setUploadMode}
            />

            {/* Conditional Upload UI */}
            {uploadMode === 'single' ? (
              // Single File Upload (Existing)
              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleAmazonUpload}
                  disabled={amazonLoading}
                  className="hidden"
                />
                <div
                  className={`w-full px-6 py-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 font-semibold ${
                    amazonLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'
                  }`}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '2px dashed rgba(3, 134, 254, 0.4)',
                    color: 'white'
                  }}
                  onMouseEnter={(e) => {
                    if (!amazonLoading) {
                      e.currentTarget.style.borderColor = 'rgba(3, 134, 254, 0.7)';
                      e.currentTarget.style.background = 'rgba(3, 134, 254, 0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(3, 134, 254, 0.4)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  }}
                >
                  <Upload size={20} style={{ color: '#0386FE' }} />
                  <span className="text-gray-300">{amazonLoading ? 'Processing...' : 'Choose Amazon File'}</span>
                  {!amazonLoading && (
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center ml-2"
                      style={{
                        border: '1px dashed rgba(3, 134, 254, 0.5)',
                        background: 'rgba(3, 134, 254, 0.1)'
                      }}
                    >
                      <span style={{
                        background: 'linear-gradient(135deg, #0386FE, #9507FF)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                      }}>+</span>
                    </div>
                  )}
                </div>
              </label>
            ) : (
              // Separate Tab Upload (New)
              <SeparateTabUploader
                costConfig={costConfig}
                hazmatFilter={hazmatFilter}
                getAuthHeader={() => {
                const token = localStorage.getItem('authToken');
                return token ? { Authorization: `Bearer ${token}` } : {};
                }}
                onAnalysisComplete={(data, reportId, extractedBrandName) => {  // ✅ Add 3rd parameter
                  const dataWithCodes = {
                    ...data,
                    topStates: data.topStates?.map(state => ({
                      ...state,
                      code: state.code || stateNameToCode[state.name] || state.name.substring(0, 2).toUpperCase()
                    })),
                    hazmat: data.hazmat || null,
                    metadata: data.metadata || {},
                    brandName: extractedBrandName || data.brandName || null  // ✅ Add brand name
                  };

                  setBrandName(extractedBrandName || data.brandName || null);  // ✅ Set brand state
                  setDashboardData(dataWithCodes);
                  setCurrentReportId(reportId);
                  setSuccess('Analysis complete! View your results below.');
                  setActiveView('dashboard');
                  fetchReports();
                }}
                onError={(errorMessage) => {
                  setError(errorMessage);
                }}
              />
            )}

            {/* Selected File Info */}
            {amazonFile && (
              <div
                className="mt-4 text-sm p-4 rounded-xl flex items-center gap-3"
                style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)'
                }}
              >
                <FileText size={18} className="text-green-400" />
                <span className="text-green-300 font-medium truncate">{amazonFile.name}</span>
                <CheckCircle size={16} className="text-green-400 ml-auto flex-shrink-0" />
              </div>
            )}

            {/* Format Guide */}
            <div
              className="mt-6 p-4 rounded-xl"
              style={{
                background: 'rgba(15, 20, 25, 0.6)',
                border: '1px solid rgba(3, 134, 254, 0.15)'
              }}
            >
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <FileText size={14} style={{ color: '#0386FE' }} />
                Expected Format
              </h4>
              <ul className="text-xs text-gray-400 space-y-2">
                <li className="flex items-start gap-2">
                  <span style={{ color: '#0386FE' }}>•</span>
                  <span>Amazon FBA CSV/Excel format</span>
                </li>
                <li className="flex items-start gap-2">
                  <span style={{ color: '#0386FE' }}>•</span>
                  <span>State, Weight, Cost columns required</span>
                </li>
                <li className="flex items-start gap-2">
                  <span style={{ color: '#0386FE' }}>•</span>
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
                      className="p-2 rounded-lg text-xs flex items-center justify-between transition-all duration-200"
                      style={{
                        background: 'rgba(15, 20, 25, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.05)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(3, 134, 254, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                      }}
                    >
                      <span className="text-white truncate flex-1">{report.filename}</span>
                      <button
                        onClick={() => loadReport(report.id)}
                        className="font-semibold ml-2 transition-colors"
                        style={{
                          background: 'linear-gradient(to right, #0386FE, #9507FF)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent'
                        }}
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
        </div>

        {/* ============== SHOPIFY UPLOAD CARD ============== */}
        <div
          className="rounded-2xl p-8 backdrop-blur-sm transition-all duration-300 hover:shadow-2xl relative group"
          style={{
            background: 'linear-gradient(135deg, rgba(10, 15, 26, 0.8), rgba(15, 20, 25, 0.6))',
            border: '2px solid transparent',
            backgroundImage: `
              linear-gradient(135deg, rgb(255 255 255 / 4%), rgb(255 255 255 / 0%)),
              linear-gradient(135deg, rgb(255 255 255 / 4%), rgb(255 255 255 / 0%))
            `,
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box'
          }}
        >
          {/* Subtle Glow on Hover */}
          <div
            className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(149, 7, 255, 0.06), transparent 70%)'
            }}
          />

          <div className="relative z-10">
            {/* Shopify Logo & Header */}
            <div className="text-center mb-6">
              <div
                className="rounded-2xl w-20 h-20 flex items-center justify-center mx-auto mb-4 relative overflow-hidden"
                style={{
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
                }}
              >
                <img
                  src={shopifyLogo}
                  alt="Shopify"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="hidden bg-gradient-to-br from-green-500 to-green-700 rounded-xl w-full h-full items-center justify-center">
                  <ShoppingCart size={40} className="text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">Shopify Upload</h3>
              <p className="text-gray-400 text-sm">DTC & E-commerce Data</p>
            </div>

            {/* Rate Type Dropdown */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Select Rate Type
              </label>
              <div className="relative">
                <select
                  value={shopifyRateType}
                  onChange={(e) => setShopifyRateType(e.target.value)}
                  disabled={shopifyLoading}
                  className="w-full px-4 py-3.5 rounded-xl text-white appearance-none cursor-pointer transition-all duration-300 disabled:opacity-50 outline-none"
                  style={{
                    background: 'rgba(15, 20, 25, 0.8)',
                    border: '1px solid rgba(3, 134, 254, 0.3)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(3, 134, 254, 0.6)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(3, 134, 254, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(3, 134, 254, 0.3)';
                    e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
                  }}
                >
                  <option value="orderUpdate">Order Update</option>
                  <option value="productUpdate">Product Update</option>
                </select>
                <div
                  className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, #0386FE, #9507FF)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  ▼
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {shopifyRateType === 'orderUpdate' && 'Order fulfillment & shipping updates'}
                {shopifyRateType === 'productUpdate' && 'Product catalog & inventory updates'}
              </p>
            </div>

            {/* File Upload Button */}
            <label className="block cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleShopifyUpload}
                disabled={shopifyLoading}
                className="hidden"
              />
              <div
                className={`w-full px-6 py-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 font-semibold ${
                  shopifyLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'
                }`}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '2px dashed rgba(3, 134, 254, 0.4)',
                  color: 'white'
                }}
                onMouseEnter={(e) => {
                  if (!shopifyLoading) {
                    e.currentTarget.style.borderColor = 'rgba(3, 134, 254, 0.7)';
                    e.currentTarget.style.background = 'rgba(3, 134, 254, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(3, 134, 254, 0.4)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                }}
              >
                <Upload size={20} style={{ color: '#0386FE' }} />
                <span className="text-gray-300">{shopifyLoading ? 'Processing...' : 'Choose Shopify File'}</span>
                {!shopifyLoading && (
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center ml-2"
                    style={{
                      border: '1px dashed rgba(3, 134, 254, 0.5)',
                      background: 'rgba(3, 134, 254, 0.1)'
                    }}
                  >
                    <span style={{
                      background: 'linear-gradient(135deg, #0386FE, #9507FF)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}>+</span>
                  </div>
                )}
              </div>
            </label>

            {/* Selected File Info */}
            {shopifyFile && (
              <div
                className="mt-4 text-sm p-4 rounded-xl flex items-center gap-3"
                style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)'
                }}
              >
                <FileText size={18} className="text-green-400" />
                <span className="text-green-300 font-medium truncate">{shopifyFile.name}</span>
                <CheckCircle size={16} className="text-green-400 ml-auto flex-shrink-0" />
              </div>
            )}

            {/* Format Guide */}
            <div
              className="mt-6 p-4 rounded-xl"
              style={{
                background: 'rgba(15, 20, 25, 0.6)',
                border: '1px solid rgba(3, 134, 254, 0.15)'
              }}
            >
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <FileText size={14} style={{ color: '#0386FE' }} />
                Expected Format
              </h4>
              <ul className="text-xs text-gray-400 space-y-2">
                <li className="flex items-start gap-2">
                  <span style={{ color: '#0386FE' }}>•</span>
                  <span>Shopify Orders CSV export</span>
                </li>
                <li className="flex items-start gap-2">
                  <span style={{ color: '#0386FE' }}>•</span>
                  <span>Shipping Address, Line Items required</span>
                </li>
                <li className="flex items-start gap-2">
                  <span style={{ color: '#0386FE' }}>•</span>
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
                      className="p-2 rounded-lg text-xs flex items-center justify-between transition-all duration-200"
                      style={{
                        background: 'rgba(15, 20, 25, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.05)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(3, 134, 254, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                      }}
                    >
                      <span className="text-white truncate flex-1">{report.filename}</span>
                      <button
                        onClick={() => loadReport(report.id)}
                        className="font-semibold ml-2 transition-colors"
                        style={{
                          background: 'linear-gradient(to right, #0386FE, #9507FF)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent'
                        }}
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

const USAHeatMap = ({ states, title, dataType = "volume", hazmatData = null, showHazmat = false }) => {
  const [hoveredState, setHoveredState] = useState(null);
  const [tooltipContent, setTooltipContent] = useState('');
  const [mapMode, setMapMode] = useState('volume'); // 'volume', 'hazmat', 'cost'

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

  // Build state data map
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

  // Build hazmat geographic data map if available
  const hazmatStateMap = {};
  if (hazmatData && hazmatData.geographic && hazmatData.geographic.states) {
    hazmatData.geographic.states.forEach(state => {
      const code = state.state;
      if (code) {
        const fipsCode = stateCodeToFIPS[code];
        if (fipsCode) {
          hazmatStateMap[fipsCode] = state;
        }
      }
    });
  }

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

  // New: Hazmat-specific color gradient (red/orange for hazmat density)
  const getColorByHazmatPercentage = (percentage) => {
    if (!percentage || percentage === 0) return '#1a1f2e';
    if (percentage >= 10) return '#dc2626';  // High hazmat - dark red
    if (percentage >= 5) return '#f97316';   // Medium - orange
    if (percentage >= 2) return '#fbbf24';   // Low-medium - amber
    return '#86efac';                        // Very low - light green
  };

  return (
    <div className="bg-[#1a1f2e] rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white text-lg font-semibold flex items-center gap-2">
          <MapPin className="text-brand-blue" size={20} />
          {title}
        </h3>

        {/* Map Mode Selector (only show if hazmat data available) */}
        {hazmatData && (
          <div className="flex gap-2">
            <button
              onClick={() => setMapMode('volume')}
              className={`px-3 py-1 rounded text-sm font-semibold transition-all ${
                mapMode === 'volume'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Volume
            </button>
            <button
              onClick={() => setMapMode('hazmat')}
              className={`px-3 py-1 rounded text-sm font-semibold transition-all ${
                mapMode === 'hazmat'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Hazmat
            </button>
            <button
              onClick={() => setMapMode('cost')}
              className={`px-3 py-1 rounded text-sm font-semibold transition-all ${
                mapMode === 'cost'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Cost
            </button>
          </div>
        )}
      </div>

      <div className="bg-[#0f1419] p-6 rounded-lg relative">
        <ComposableMap projection="geoAlbersUsa" className="w-full h-auto">
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const fipsCode = geo.id;
                const stateData = stateDataMap[fipsCode];
                const hazmatStateData = hazmatStateMap[fipsCode];
                const isHovered = hoveredState === fipsCode;

                // Determine fill color based on selected mode
                let fillColor = '#1a1f2e';
                if (mapMode === 'hazmat' && hazmatStateData) {
                  fillColor = getColorByHazmatPercentage(hazmatStateData.percentage);
                } else if (mapMode === 'volume' && stateData) {
                  fillColor = getColorByPercentage(stateData.percentage);
                } else if (mapMode === 'cost' && stateData) {
                  fillColor = getColorByCost(stateData.avgCost);
                }

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
                        fill: mapMode === 'hazmat' ? '#fbbf24' : mapMode === 'volume' ? '#60a5fa' : '#34d399',
                        outline: 'none',
                        cursor: 'pointer'
                      },
                      pressed: { outline: 'none' }
                    }}
                    onMouseEnter={() => {
                      setHoveredState(fipsCode);
                      if (mapMode === 'hazmat' && hazmatStateData) {
                        setTooltipContent(
                          `${hazmatStateData.state}: ${hazmatStateData.count} hazmat shipments (${hazmatStateData.percentage?.toFixed(1)}%) - ${hazmatStateData.units?.toLocaleString()} units`
                        );
                      } else if (stateData) {
                        const content = mapMode === "volume"
                          ? `${stateData.name}: ${stateData.volume?.toLocaleString()} shipments (${stateData.percentage}%)`
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

        {/* Legend */}
        <div className="mt-6 flex items-center flex-wrap gap-4">
          <span className="text-gray-400 text-sm">
            {mapMode === 'hazmat' ? 'Hazmat Density:' : mapMode === "volume" ? "Shipping Volume:" : "Average Cost:"}
          </span>
          {mapMode === 'hazmat' ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 rounded" style={{ backgroundColor: '#86efac' }}></div>
                <span className="text-gray-400 text-xs">Very Low (&lt;2%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 rounded" style={{ backgroundColor: '#fbbf24' }}></div>
                <span className="text-gray-400 text-xs">Low (2-5%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 rounded" style={{ backgroundColor: '#f97316' }}></div>
                <span className="text-gray-400 text-xs">Medium (5-10%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 rounded" style={{ backgroundColor: '#dc2626' }}></div>
                <span className="text-gray-400 text-xs">High (10%+)</span>
              </div>
            </>
          ) : mapMode === "volume" ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 rounded bg-blue-200"></div>
                <span className="text-gray-400 text-xs">&lt;5%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 rounded bg-blue-400"></div>
                <span className="text-gray-400 text-xs">5-10%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 rounded bg-blue-600"></div>
                <span className="text-gray-400 text-xs">10-15%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 rounded bg-blue-900"></div>
                <span className="text-gray-400 text-xs">15%+</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 rounded bg-green-400"></div>
                <span className="text-gray-400 text-xs">&lt;$12</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 rounded bg-yellow-400"></div>
                <span className="text-gray-400 text-xs">$12-$14</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 rounded bg-orange-500"></div>
                <span className="text-gray-400 text-xs">$14-$16</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 rounded bg-red-600"></div>
                <span className="text-gray-400 text-xs">$16+</span>
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
    <div className="bg-[#1a1f2e] rounded-xl p-6 border border-gray-800 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-white text-2xl font-bold mb-2 flex items-center gap-2">
            <Settings className="text-brand-blue" size={28} />
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
  <div className="relative min-h-[calc(100vh-200px)] flex items-center justify-center p-6">
    {/* Main Content Card - wider, subtle styling */}
    <div
      className="w-full max-w-5xl rounded-3xl p-10 relative"
      style={{
        background: 'linear-gradient(135deg, rgba(10, 15, 30, 0.6), rgba(15, 25, 45, 0.4))',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}
    >
      {/* Hero Section */}
      <div className="text-center">
        {/* Logo - no border, clean */}
        <div className="relative inline-block mb-8">
          <div className="w-36 h-36 flex items-center justify-center p-4 rounded-2xl bg-[#0a1428]/80">
            <img
              src={amzprepLogo}
              alt="AMZ Prep Logo"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Welcome Title */}
        <h1
          className="text-4xl md:text-5xl font-bold mb-3"
          style={{
            background: 'linear-gradient(90deg, #00D4FF, #0386FE, #00D4FF)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          Welcome to AMZ Prep
        </h1>

        <p className="text-lg md:text-xl text-white font-medium mb-4">
          Intelligent Shipping Analytics Platform
        </p>

        <p className="text-sm text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Transform your shipping data into actionable insights. Optimize warehouse locations,
          reduce costs, and improve delivery times with our advanced analytics engine.
        </p>

        {/* CTA Button - smaller */}
        <button
          onClick={() => setActiveView('upload')}
          className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-xl text-white font-semibold text-base transition-all duration-300 hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #0386FE, #0066DD)',
            boxShadow: '0 8px 30px rgba(3, 134, 254, 0.3)'
          }}
        >
          <Upload size={20} />
          <span>Get Started - Upload Data</span>
          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>

        <p className="text-gray-500 text-xs mt-6">
          No credit card required • Upload your data securely • Generate reports instantly
        </p>
      </div>
    </div>
  </div>
);

const WarehouseLocationMap = ({ warehouses }) => (
  <div className="bg-[#1a1f2e] rounded-xl p-6 border border-gray-800">
    <h3 className="text-white text-xl font-semibold mb-6 flex items-center gap-2">
      <MapPin className="text-brand-blue" size={24} />
      Warehouse Network Optimization
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
                <MapPin size={20} className="text-brand-blue" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-bold text-sm mb-1">{wh.name}</h4>
                <p className="text-gray-400 text-xs mb-2 leading-relaxed">
                  {wh.fullAddress}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs bg-blue-500/20 text-brand-blue px-2 py-1 rounded">
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
          <FileText className="text-brand-blue" size={20} />
          Your Reports ({reports.length})
        </h3>
        {reports.length > 5 && (
          <button
            onClick={() => setShowAllReports(!showAllReports)}
            className="text-brand-blue hover:text-blue-300 text-sm font-semibold"
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
                      className="text-brand-blue hover:text-blue-300 text-sm font-semibold px-3 py-1 rounded hover:bg-blue-500/10 transition-colors disabled:opacity-50"
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
    <div className="rounded-xl">
      {loading ? (
        <div className="text-gray-400 text-center py-8">Loading users...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-6 py-4">
                  <span
                    className="text-sm font-semibold flex items-center gap-1"
                    style={{
                      background: 'linear-gradient(90deg, #0386FE, #9507FF)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}
                  >
                    Email
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" style={{color: '#0386FE'}}>
                      <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z"/>
                    </svg>
                  </span>
                </th>
                <th className="px-6 py-4">
                  <span
                    className="text-sm font-semibold flex items-center gap-1"
                    style={{
                      background: 'linear-gradient(90deg, #9507FF, #0386FE)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}
                  >
                    Name
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" style={{color: '#9507FF'}}>
                      <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z"/>
                    </svg>
                  </span>
                </th>
                <th className="px-6 py-4 text-white text-sm font-semibold">Role</th>
                <th className="px-6 py-4">
                  <span className="text-white text-sm font-semibold flex items-center gap-1">
                    Last Login
                    <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z"/>
                    </svg>
                  </span>
                </th>
                <th className="px-6 py-4 text-white text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-5 text-white font-medium">{u.email}</td>
                  <td className="px-6 py-5 text-white">{u.name}</td>
                  <td className="px-6 py-5">
                    <span className={`font-bold ${
                      u.role === 'admin'
                        ? 'text-green-400'
                        : 'text-white'
                    }`}>
                      {u.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-white">
                    {new Date(u.lastLogin).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    }).replace(/\//g, '/')}
                  </td>
                  <td className="px-6 py-5">
                    <button
                      onClick={() => toggleUserRole(u._id, u.role)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        u.role === 'admin'
                          ? 'text-red-400 border border-red-400/40 hover:bg-red-400/10'
                          : 'text-green-400 border border-green-400/40 hover:bg-green-400/10'
                      }`}
                      style={{
                        background: 'transparent'
                      }}
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

// 🆕 ENHANCED DASHBOARDVIEW WITH SHIPPING SCORECARD INTEGRATION
const DashboardView = () => {
if (!dashboardData) {
  return <WelcomeScreen />;
}

// 🆕 For regular users (non-admin), always show scorecard
if (user?.role !== 'admin') {
  return (
    <div className="space-y-6 p-6">
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}
      {error && <PremiumAlert type="error" message={error} onClose={() => setError(null)} />}

      {/* Customer-facing Scorecard */}
      <ShippingScorecard
        data={dashboardData}
        metadata={dashboardData.metadata}
        isAdmin={false}
      />
    </div>
  );
}

// 🆕 For admin users, show toggle buttons and conditional rendering
return (
  <div className="space-y-6 p-6">
    {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}
    {error && <PremiumAlert type="error" message={error} onClose={() => setError(null)} />}

    {/* Admin Header with Toggle Buttons */}
    <div className="bg-[#1a1f2e] rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            AMZ Prep Shipping Analysis
            {brandName && (
              <span className="text-brand-blue ml-2">— {brandName}</span>
            )}
          </h2>
          <p className="text-gray-400">
            Generated on {new Date().toLocaleDateString()} • Analysis Period: {dashboardData.analysisMonths} {dashboardData.analysisMonths > 1 ? 'months' : 'month'}
          </p>
        </div>

        {/* Toggle Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => setViewType('scorecard')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              viewType === 'scorecard'
                ? 'bg-brand-blue text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Customer Scorecard View
          </button>
          <button
            onClick={() => setViewType('detailed')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              viewType === 'detailed'
                ? 'bg-brand-blue text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Full Admin Dashboard
          </button>
        </div>
      </div>
    </div>

    {/* Conditional Rendering Based on View Type */}
    {viewType === 'scorecard' ? (
      // Show Scorecard View (what customers see)
      <ShippingScorecard
        data={dashboardData}
        metadata={dashboardData.metadata}
        isAdmin={true}
      />
    ) : (
      // Show Full Dashboard (your existing detailed view)
      <div className="space-y-6">
        {/* Check if Smash Foods format */}
        {(dashboardData?.metadata?.dataFormat === 'smash_foods_actual' ||
        dashboardData?.metadata?.dataFormat === 'muscle_mac_actual') ? (
          <SmashFoodsDashboard data={dashboardData} />
        ) : (
          <>
          </>
          // standard dashboard
        )}

        {/* YOUR EXISTING DASHBOARD CONTENT */}
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
                    <span className="text-brand-blue font-bold text-lg">{state.percentage}%</span>
                    <span className="text-gray-500 text-sm">${state.avgCost}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            <USAHeatMap states={dashboardData.topStates} title="USA Shipping Heat Map (Volume)" dataType="volume" hazmatData={dashboardData.hazmat} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          <USAHeatMap states={dashboardData.topStates} title="Average Cost per Order by State" dataType="cost" hazmatData={dashboardData.hazmat} />
        </div>

        {/* Warehouse Location Network */}
        {dashboardData.warehouseComparison && (
          <WarehouseLocationMap warehouses={dashboardData.warehouseComparison} />
        )}

        <div className="bg-[#1a1f2e] rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-2 mb-6">
            <TruckIcon className="text-brand-blue" size={24} />
            <h3 className="text-white text-xl font-semibold">Warehouse Comparison (Estd)</h3>
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
                          <span className="text-xs text-brand-blue font-medium">
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
    )}
  </div>
);
};

// REPLACE your main return with:
return (
  <>
    <ProcessingModal
      isOpen={processingModalOpen}
      progress={uploadProgress}
      processedCount={processedShipments}
      totalCount={totalShipments}
      stats={processingStats}
    />

    <div
     className="min-h-screen flex"
     style={{
       background: 'linear-gradient(to bottom right, #000000 0%, #000000 39%, #091332 100%)'
     }}
     >
      {/* Premium Sidebar */}
      <PremiumSidebar />

      {/* Main Content Area */}
      <div className={`flex-1 transition-all duration-500 ease-in-out overflow-x-hidden ${
        sidebarCollapsed ? 'ml-20' : 'ml-72'
      }`}>

      {/* Main Content */}
        <div className="p-8 overflow-x-hidden">
          {activeView === 'upload' ? (
            <UploadView />
          ) : activeView === 'admin-fba-zoning' && user?.role === 'admin' ? (
            <FBAZoningManager getAuthHeader={getAuthHeader} />
          ) : (
            <DashboardView />
          )}
        </div>
      </div>

      {/* User Management Modal */}
      {showUserManagement && user?.role === 'admin' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="relative max-w-5xl w-full max-h-[85vh] overflow-hidden rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(8, 12, 24, 0.98), rgba(12, 18, 32, 0.95))',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            {/* Header */}
            <div className="p-8 pb-6">
              <div className="flex justify-between items-center">
                <h2 className="text-4xl font-bold text-white">
                  User Management
                </h2>
                <button
                  onClick={() => setShowUserManagement(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-8 pb-8 overflow-y-auto max-h-[calc(85vh-120px)]">
              <AdminUserManagement />
            </div>
          </div>
        </div>
      )}

      {/* Premium Animations & Styles */}
      <style>{`
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-slideIn {
        animation: slideIn 0.5s ease-out;
      }

      /* Custom Scrollbar with Pink Gradient */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      ::-webkit-scrollbar-track {
        background: rgba(3, 134, 254, 0.05);
        border-radius: 10px;
      }
      ::-webkit-scrollbar-thumb {
        background: linear-gradient(to bottom, #0386FE, #9507FF);
        border-radius: 10px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(to bottom, #0386FE, #B520FF);
      }

      /* Select dropdown styling */
      select option {
        background: #0f1419;
        color: white;
      }

      /* Remove autofill yellow background */
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      input:-webkit-autofill:active {
        -webkit-box-shadow: 0 0 0 30px rgba(15, 20, 25, 0.9) inset !important;
        -webkit-text-fill-color: white !important;
      }
    `}</style>
    </div>
  </>
);
};

export default ShippingAnalytics;
