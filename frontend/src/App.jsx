import React, { useState, useEffect } from 'react';
import { Upload, BarChart3, Package, DollarSign, Download, Settings, LogOut, AlertCircle, CheckCircle, MapPin, FileText, TruckIcon, ShoppingCart, Users, X, Menu, ChevronLeft, ChevronRight, Search, Bell, Zap, Activity, TrendingUp } from 'lucide-react';
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
    freightCost: 1315,      // Default FTL cost (from Illinois to KY)
    freightMarkup: 1.2,     // 20% markup (1315 × 1.2 = 1578)
    mmBaseCost: 2.625,      // ✅ FIXED: KY Standard rate (was 2.75)
    mmMarkup: 1.0,          // ✅ FIXED: No markup (was 1.05)
    rateMode: 'FTL',        // Full Truckload
    destination: 'KY',      // Hebron, KY
    palletCost: 150         // Pallet rate (when using PALLET mode)
  });

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

const PremiumSidebar = () => (
  <div className={`fixed left-0 top-0 h-full transition-all duration-500 ease-in-out z-50 ${
    sidebarCollapsed ? 'w-20' : 'w-80'
  }`}>
    {/* Glassmorphism Background with Gradient */}
    <div className="absolute inset-0 bg-gradient-to-br from-[#0B1426] via-[#0F1C3A] to-[#1A2847] backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-r from-[#00A8FF]/5 via-transparent to-[#00A8FF]/5"></div>
      <div className="absolute inset-0 border-r border-[#00A8FF]/20"></div>
    </div>

    {/* Content */}
    <div className="relative flex flex-col h-full bg-[#1a1f2e]">
      {/* Header Section - Premium Logo Area */}
      <div className="p-6 border-b border-[#00A8FF]/10">
        <div className="flex items-center gap-4">
          {/* Logo with Glow Effect */}
          <div className="relative group">
            <div className="absolute inset-0"></div>
            <div className="relative p-3 rounded-xl">
              <img
                src={amzprepLogo}
                alt="AMZ Prep"
                className="h-8 w-auto object-contain filter drop-shadow-lg"
              />
            </div>
          </div>
        </div>
      </div>

      {/* User Profile Section - Enhanced */}
      {!sidebarCollapsed && (
        <div className="p-6 border-b border-[#00A8FF]/10">
          <div className="relative group">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#00A8FF]/5 to-transparent rounded-2xl blur-sm group-hover:from-[#00A8FF]/10 transition-all duration-300"></div>

            <div className="relative bg-gradient-to-r from-[#1A2847]/80 to-[#0F1C3A]/80 backdrop-blur-sm p-4 rounded-2xl border border-[#00A8FF]/20 hover:border-[#00A8FF]/40 transition-all duration-300">
              <div className="flex items-center gap-4">
                {/* Avatar with Status Ring */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#00A8FF] to-[#0080FF] rounded-full blur-sm"></div>
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="relative w-12 h-12 rounded-full border-2 border-[#00A8FF]/50 object-cover"
                    />
                  ) : (
                    <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-[#00A8FF] to-[#0080FF] flex items-center justify-center text-white font-bold text-lg">
                      {user.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                  {/* Status Indicator */}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-[#1A2847]"></div>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-sm truncate">{user.name}</h3>
                  <p className="text-[#00A8FF]/70 text-xs truncate">{user.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
                    <span className="text-emerald-400 text-xs font-medium">Online</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Menu - Premium Design */}
      <div className="flex-1 p-6 space-y-2">

        {/* Navigation Items */}
        <div className="space-y-2">
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

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-[#00A8FF]/20 to-transparent my-4"></div>

          {/* Admin Section */}
          {user?.role === 'admin' && (
            <>
              <div className={`${sidebarCollapsed ? 'hidden' : 'block'} mb-3`}>
                <p className="text-[#00A8FF]/60 text-xs font-medium uppercase tracking-wider px-4">Administration</p>
              </div>
              <NavItem
                icon={Users}
                label="Manage Users"
                active={false}
                onClick={() => setShowUserManagement(!showUserManagement)}
                collapsed={sidebarCollapsed}
              />
              <NavItem
                icon={Settings}
                label="Settings"
                active={false}
                onClick={() => {}}
                collapsed={sidebarCollapsed}
              />
            </>
          )}
        </div>
      </div>

      {/* Bottom Section */}
      <div className="p-6 border-t border-[#00A8FF]/10 space-y-3">
        {/* Logout Button */}
        <button
          onClick={() => {
            logout();
            window.location.href = '/login';
          }}
          className="group relative w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/30"
        >
          <div className="bg-red-500/20 p-2 rounded-lg group-hover:bg-red-500/30 transition-all duration-300">
            <LogOut size={16} className="text-red-400" />
          </div>
          {!sidebarCollapsed && (
            <span className="text-red-400 font-medium">Logout</span>
          )}
        </button>

        {/* Collapse Toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="group relative w-full flex items-center justify-center p-3 rounded-xl transition-all duration-300 hover:bg-[#00A8FF]/10 border border-[#00A8FF]/20 hover:border-[#00A8FF]/40"
        >
          <div className="bg-[#00A8FF]/20 p-2 rounded-lg group-hover:bg-[#00A8FF]/30 transition-all duration-300">
            {sidebarCollapsed ? (
              <ChevronRight size={16} className="text-[#00A8FF]" />
            ) : (
              <ChevronLeft size={16} className="text-[#00A8FF]" />
            )}
          </div>
        </button>
      </div>
    </div>
  </div>
);

const NavItem = ({ icon: Icon, label, active, onClick, collapsed, badge }) => (
  <button
    onClick={onClick}
    className={`group relative w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${
      active
        ? 'bg-gradient-to-r from-[#00A8FF]/20 via-[#00A8FF]/10 to-transparent border-[#00A8FF]/40 text-white shadow-lg shadow-[#00A8FF]/20'
        : 'hover:bg-gradient-to-r hover:from-[#00A8FF]/5 hover:to-transparent hover:border-[#00A8FF]/20 text-[#00A8FF]/70 hover:text-white'
    } border ${active ? 'border-[#00A8FF]/40' : 'border-transparent'}`}
  >
    {/* Background Glow Effect */}
    {active && (
      <div className="absolute inset-0 bg-gradient-to-r from-[#00A8FF]/10 to-transparent rounded-2xl blur-sm"></div>
    )}

    <div className="relative flex items-center gap-4 w-full">
      {/* Icon with Background */}
      <div className={`relative p-2 rounded-xl transition-all duration-300 ${
        active
          ? 'bg-[#00A8FF]/20 shadow-lg shadow-[#00A8FF]/20'
          : 'bg-[#00A8FF]/5 group-hover:bg-[#00A8FF]/15'
      }`}>
        <Icon size={18} className={`${active ? 'text-[#00A8FF]' : 'text-[#00A8FF]/70 group-hover:text-[#00A8FF]'} transition-colors duration-300`} />
      </div>

      {!collapsed && (
        <div className="flex items-center justify-between flex-1">
          <span className={`font-medium text-sm transition-colors duration-300 ${
            active ? 'text-white' : 'text-[#00A8FF]/70 group-hover:text-white'
          }`}>
            {label}
          </span>

          {badge && (
            <div className={`px-2 py-1 rounded-full text-xs font-bold transition-all duration-300 ${
              active
                ? 'bg-[#00A8FF] text-white shadow-lg shadow-[#00A8FF]/30'
                : 'bg-[#00A8FF]/20 text-[#00A8FF] group-hover:bg-[#00A8FF]/30'
            }`}>
              {badge}
            </div>
          )}
        </div>
      )}
    </div>
  </button>
);

// REPLACE your existing Alert component with:
const PremiumAlert = ({ type, message, onClose }) => {
const isError = type === 'error';
const baseClasses = "relative rounded-2xl p-6 mb-8 animate-slideIn border backdrop-blur-sm";
const typeClasses = isError
  ? "bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border-red-500/30 shadow-xl shadow-red-500/10"
  : "bg-gradient-to-r from-[#00A8FF]/10 via-[#00A8FF]/5 to-transparent border-[#00A8FF]/30 shadow-xl shadow-[#00A8FF]/10";

return (
  <div className={`${baseClasses} ${typeClasses}`}>
    {/* Background Glow */}
    <div className={`absolute inset-0 rounded-2xl blur-sm ${
      isError ? 'bg-gradient-to-r from-red-500/5 to-transparent' : 'bg-gradient-to-r from-[#00A8FF]/5 to-transparent'
    }`}></div>

    <div className="relative flex items-start gap-4">
      <div className={`p-3 rounded-xl ${
        isError ? 'bg-red-500/20' : 'bg-[#00A8FF]/20'
      }`}>
        {isError ? (
          <AlertCircle className="text-red-400" size={24} />
        ) : (
          <CheckCircle className="text-[#00A8FF]" size={24} />
        )}
      </div>

      <div className="flex-1">
        <p className={`font-medium text-lg ${isError ? 'text-red-100' : 'text-[#00A8FF]'}`}>
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
      {error && <PremiumAlert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Dual Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">

        {/* ============== AMAZON UPLOAD CARD ============== */}
        <div className="bg-[#1a1f2e] rounded-2xl p-8 border border-gray-800 hover:border-brand-blue/60 transition-all shadow-2xl hover:shadow-brand-blue/20">

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

          {/* 🆕 Cost Configuration Panel */}
          <CostConfigPanel
            onConfigChange={setCostConfig}
            disabled={amazonLoading}
          />

          {/* Hazmat Filter Selection */}
          <div className="hazmat-filter-section" style={{
            marginTop: '20px',
            padding: '15px',
            borderRadius: '8px',
            border: '1px solid #00a8ff70',
            marginBottom: '30px',
            color: '#ffffff'
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
            <span className={`w-full bg-gradient-to-r from-brand-blue to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-4 rounded-lg cursor-pointer flex items-center justify-center gap-3 transition-all transform hover:scale-105 shadow-lg font-semibold ${
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
              <span className="text-brand-blue font-semibold">{amazonFile.name}</span>
            </div>
          )}

          {/* Format Guide */}
          <div className="mt-6 bg-[#0f1419] p-4 rounded-lg border border-gray-800">
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <FileText size={16} className="text-brand-blue" />
              Expected Format
            </h4>
            <ul className="text-xs text-gray-400 space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-brand-blue mt-0.5">•</span>
                <span>Amazon FBA CSV/Excel format</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-blue mt-0.5">•</span>
                <span>State, Weight, Cost columns required</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-blue mt-0.5">•</span>
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
                      className="text-orange-500 hover:text-brand-blue font-semibold ml-2"
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
        <div className="bg-[#1a1f2e] rounded-2xl p-8 border border-gray-800 hover:border-brand-blue/60 transition-all shadow-2xl hover:shadow-brand-blue/20">

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
            <span className={`w-full bg-gradient-to-r from-brand-blue to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-4 rounded-lg cursor-pointer flex items-center justify-center gap-3 transition-all transform hover:scale-105 shadow-lg font-semibold ${
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
              <span className="text-brand-blue font-semibold">{shopifyFile.name}</span>
            </div>
          )}

          {/* Format Guide */}
          <div className="mt-6 bg-[#0f1419] p-4 rounded-lg border border-gray-800">
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <FileText size={16} className="text-brand-blue" />
              Expected Format
            </h4>
            <ul className="text-xs text-gray-400 space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-brand-blue mt-0.5">•</span>
                <span>Shopify Orders CSV export</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-blue mt-0.5">•</span>
                <span>Shipping Address, Line Items required</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-blue mt-0.5">•</span>
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
                      className="text-green-500 hover:text-brand-blue font-semibold ml-2"
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
                <BarChart3 size={32} className="text-brand-blue" />
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
                <TruckIcon size={32} className="text-brand-blue" />
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
                <MapPin size={32} className="text-brand-blue" />
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
          <h2 className="text-2xl font-bold text-white mb-2">AMZ Prep Shipping Analysis</h2>
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

    <div className="min-h-screen bg-gradient-to-br from-[#0B1426] via-[#0F1C3A] to-[#1A2847] flex">
      {/* Premium Sidebar */}
      <PremiumSidebar />

      {/* Main Content Area */}
      <div className={`flex-1 transition-all duration-500 ease-in-out ${
        sidebarCollapsed ? 'ml-20' : 'ml-80'
      }`}>

        {/* Main Content */}
        <div className="p-8">
          {activeView === 'upload' ? <UploadView /> : <DashboardView />}
        </div>
      </div>

      {/* User Management Modal - your existing modal code */}
      {showUserManagement && user?.role === 'admin' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1A2847] via-[#0F1C3A] to-[#0B1426] rounded-3xl"></div>
            <div className="absolute inset-0 border border-[#00A8FF]/30 rounded-3xl"></div>

            <div className="relative backdrop-blur-sm">
              <div className="p-8 border-b border-[#00A8FF]/20 bg-gradient-to-r from-[#00A8FF]/10 to-transparent">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-bold text-white flex items-center gap-4">
                    <Users size={32} className="text-[#00A8FF]" />
                    User Management
                  </h2>
                  <button
                    onClick={() => setShowUserManagement(false)}
                    className="p-3 hover:bg-white/10 rounded-2xl transition-colors text-white/60 hover:text-white"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-8 overflow-y-auto max-h-[70vh]">
                <AdminUserManagement />
              </div>
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

        /* Custom Scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(0, 168, 255, 0.1);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(0, 168, 255, 0.3);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 168, 255, 0.5);
        }
      `}</style>
    </div>
  </>
);
};

export default ShippingAnalytics;
