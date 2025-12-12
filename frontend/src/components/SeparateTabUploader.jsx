// ============================================================================
// SEPARATE TAB UPLOADER - WITH VALIDATION & WARNING MODAL
// File: frontend/src/components/SeparateTabUploader.jsx
// ============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import TabUploadSection from './TabUploadSection';
import { ProcessingModal } from '../ProcessingModal';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const SeparateTabUploader = ({
  costConfig,
  hazmatFilter,
  getAuthHeader,
  onAnalysisComplete,
  onError
}) => {
  const [sessionId, setSessionId] = useState(null);
  const [uploadedTabs, setUploadedTabs] = useState({
    data: false,
    placement: false,
    storage: false
  });
  const [uploadProgress, setUploadProgress] = useState({
    data: 0,
    placement: 0,
    storage: 0
  });
  const [errors, setErrors] = useState({
    data: null,
    placement: null,
    storage: null
  });
  const [analyzing, setAnalyzing] = useState(false);

  // Processing modal state
  const [processingModalOpen, setProcessingModalOpen] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [processedShipments, setProcessedShipments] = useState(0);
  const [totalShipments, setTotalShipments] = useState(0);
  const [processingStats, setProcessingStats] = useState({
    avgCostPerUnit: 0,
    totalUnits: 0,
    totalShippingCost: 0,
    totalPlacementFees: 0
  });

  // ✅ NEW: Validation warning modal state
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [validationStats, setValidationStats] = useState(null);

  const handleTabUpload = async (tabType, file) => {
    try {
      setErrors(prev => ({ ...prev, [tabType]: null }));
      setUploadProgress(prev => ({ ...prev, [tabType]: 0 }));

      const formData = new FormData();
      formData.append('file', file);
      formData.append('tabType', tabType);
      if (sessionId) {
        formData.append('sessionId', sessionId);
      }

      const authHeader = getAuthHeader();

      const response = await axios.post(
        `${API_URL}/separate-upload`,
        formData,
        {
          headers: {
            ...authHeader
          },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(prev => ({ ...prev, [tabType]: progress }));
          }
        }
      );

      if (response.data.success) {
        if (!sessionId && response.data.sessionId) {
          setSessionId(response.data.sessionId);
        }
        setUploadedTabs(prev => ({ ...prev, [tabType]: true }));
        setUploadProgress(prev => ({ ...prev, [tabType]: 100 }));
        return { success: true };
      } else {
        throw new Error(response.data.error || 'Upload failed');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Upload failed';
      setErrors(prev => ({ ...prev, [tabType]: errorMessage }));
      setUploadProgress(prev => ({ ...prev, [tabType]: 0 }));

      if (error.response?.status === 401 || error.response?.data?.requiresAuth) {
        onError?.('Please log in to upload files. Your session may have expired.');
      }

      return { success: false, error: errorMessage };
    }
  };

  // ✅ NEW: Main analyze function that calls validation first
  const handleAnalyze = async () => {
    if (!sessionId) {
      onError?.('No session found. Please upload all tabs first.');
      return;
    }

    // ✅ Validate session before analyzing
    try {
      console.log('🔍 Validating session data...');

      const validationResponse = await axios.post(
        `${API_URL}/validate-session`,
        { sessionId },
        { headers: getAuthHeader() }
      );

      console.log('✅ Validation response:', validationResponse.data);

      // Check if there are warnings
      if (validationResponse.data.warnings && validationResponse.data.warnings.length > 0) {
        console.log('⚠️ Validation warnings found:', validationResponse.data.warnings);
        setValidationWarnings(validationResponse.data.warnings);
        setValidationStats(validationResponse.data.stats);
        setShowWarningModal(true);
        return; // Stop here and show modal
      }

      // No warnings, proceed directly
      console.log('✅ No warnings, proceeding with analysis');
      proceedWithAnalysis();

    } catch (error) {
      console.error('⚠️ Validation error:', error);

      // If validation endpoint doesn't exist yet, proceed anyway
      if (error.response?.status === 404) {
        console.log('⚠️ Validation endpoint not available, proceeding with analysis');
        proceedWithAnalysis();
      } else {
        // Other errors - show to user
        onError?.('Validation failed: ' + (error.message || 'Unknown error'));
      }
    }
  };

  // ✅ NEW: Separate function for actual analysis
  const proceedWithAnalysis = async () => {
    setAnalyzing(true);
    setProcessingModalOpen(true);
    setAnalysisProgress(0);
    setProcessedShipments(0);

    try {
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 1;
        });
      }, 100);

      const response = await axios.post(
        `${API_URL}/separate-analyze`,
        {
          sessionId,
          costConfig,
          hazmatFilter
        },
        {
          headers: getAuthHeader()
        }
      );

      clearInterval(progressInterval);
      setAnalysisProgress(100);

      if (response.data.success) {
        const data = response.data.data;

        // ✅ IMMEDIATE STATS UPDATE (before setTimeout)
        if (data) {
          const metadata = data.metadata || {};
          const currentCosts = metadata.currentCosts || {};

          const totalUnits = metadata.totalUnits || 0;
          const totalCost = currentCosts.totalFreight || 0;
          const placementFees = currentCosts.totalPlacementFees || 0;
          const avgCost = currentCosts.costPerUnit || 0;
          const shipmentCount = data.totalShipments || 0;

          // ✅ UPDATE STATS IMMEDIATELY (not in setTimeout)
          setProcessingStats({
            avgCostPerUnit: avgCost,
            totalUnits: totalUnits,
            totalShippingCost: totalCost,
            totalPlacementFees: placementFees
          });
          setTotalShipments(shipmentCount);
          setProcessedShipments(shipmentCount);

          console.log('📊 Stats updated in real-time:', {
            avgCost,
            totalUnits,
            totalCost,
            placementFees,
            shipmentCount
          });
        }

        // Small delay to show 100% completion with stats
        setTimeout(() => {
          setProcessingModalOpen(false);
          setAnalyzing(false);

          const extractedBrandName = response.data.brandName || data?.brandName || null;

          console.log('🏷️ Brand Name:', extractedBrandName);

          onAnalysisComplete?.(data, response.data.reportId, extractedBrandName);

          // Reset
          setSessionId(null);
          setUploadedTabs({ data: false, placement: false, storage: false });
        }, 1000);
      } else {
        throw new Error(response.data.error || 'Analysis failed');
      }
    } catch (error) {
      setProcessingModalOpen(false);
      setAnalyzing(false);

      if (error.response?.status === 401 || error.response?.data?.requiresAuth) {
        onError?.('Please log in to analyze your data. Your session may have expired.');
      } else {
        const errorMessage = error.response?.data?.error || error.message || 'Analysis failed';
        onError?.(errorMessage);
      }
    }
  };

  const allTabsUploaded = uploadedTabs.data && uploadedTabs.placement && uploadedTabs.storage;

  return (
    <>
      {/* Processing Modal */}
      {processingModalOpen && createPortal(
        <ProcessingModal
          isOpen={processingModalOpen}
          progress={analysisProgress}
          processedCount={processedShipments}
          totalCount={totalShipments || Math.max(processedShipments, 1)}
          stats={processingStats}
        />,
        document.body
      )}

      {/* ✅ NEW: Validation Warning Modal */}
      {showWarningModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-xl p-6 max-w-2xl mx-4 border border-yellow-500/30 max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle size={28} className="text-yellow-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-bold text-yellow-400">
                  Data Quality Warnings
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  We detected some potential issues with your uploaded files
                </p>
              </div>
            </div>

            {/* Validation Stats */}
            {validationStats && (
              <div className="mb-4 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {validationStats.dataRows || 0}
                    </div>
                    <div className="text-xs text-gray-400">Data Rows</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {validationStats.placementRows || 0}
                    </div>
                    <div className="text-xs text-gray-400">Placement Rows</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {validationStats.storageRows || 0}
                    </div>
                    <div className="text-xs text-gray-400">Storage Rows</div>
                  </div>
                </div>
              </div>
            )}

            {/* Warning Messages */}
            <div className="space-y-3 mb-6">
              {validationWarnings.map((warning, idx) => (
                <div
                  key={idx}
                  className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-yellow-400 text-2xl flex-shrink-0">⚠️</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium mb-2">
                        {warning.message}
                      </p>
                      <div className="space-y-1.5">
                        <p className="text-sm text-gray-300">
                          <strong className="text-gray-200">Impact:</strong>{' '}
                          <span className="text-gray-400">{warning.impact}</span>
                        </p>
                        <p className="text-sm text-blue-300">
                          <strong className="text-blue-200">Suggestion:</strong>{' '}
                          <span className="text-blue-400">{warning.suggestion}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Info Box */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <span className="text-lg">💡</span>
                <div className="flex-1 text-sm">
                  <p className="text-blue-300 font-medium mb-1">
                    Tip: For Best Results
                  </p>
                  <p className="text-blue-400/80">
                    Ensure your Placement tab has a "Total Cuft" column for accurate cost calculations.
                    You can re-upload the files with the correct columns or continue with slightly reduced accuracy (typically 1-5% variance).
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWarningModal(false);
                  setValidationWarnings([]);
                  setValidationStats(null);
                }}
                className="flex-1 px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
              >
                ← Cancel - Fix Files
              </button>
              <button
                onClick={() => {
                  setShowWarningModal(false);
                  proceedWithAnalysis();
                }}
                className="flex-1 px-4 py-3 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white font-semibold transition-colors shadow-lg"
              >
                Continue Anyway →
              </button>
            </div>

            {/* Footer Note */}
            <p className="text-xs text-gray-500 text-center mt-4">
              We'll use fallback calculations to provide the most accurate results possible
            </p>
          </div>
        </div>,
        document.body
      )}

      {/* Main Upload UI */}
      <div className="space-y-6">
        {/* Instructions */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: 'rgba(3, 134, 254, 0.1)',
            border: '1px solid rgba(3, 134, 254, 0.3)'
          }}
        >
          <div className="flex items-start gap-3">
            <FileSpreadsheet size={20} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">
                Upload each tab separately
              </h4>
              <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                <li>Upload your <span className="text-blue-400 font-medium">FBA Shipment Export</span> tab</li>
                <li>Upload your <span className="text-green-400 font-medium">FBA Placement Fees</span> tab</li>
                <li>Upload your <span className="text-purple-400 font-medium">Monthly Storage Fees</span> tab</li>
                <li>Click "Analyze Data" when all tabs are uploaded</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Upload Sections */}
        <TabUploadSection
          tabName="FBA Shipment Export"
          tabType="data"
          uploaded={uploadedTabs.data}
          progress={uploadProgress.data}
          error={errors.data}
          onUpload={handleTabUpload}
          description="FBA shipment data with units, dates, and destinations"
        />

        <TabUploadSection
          tabName="FBA Placement Fees"
          tabType="placement"
          uploaded={uploadedTabs.placement}
          progress={uploadProgress.placement}
          error={errors.placement}
          onUpload={handleTabUpload}
          description="Placement fees for each FBA shipment"
        />

        <TabUploadSection
          tabName="Monthly Storage Fees"
          tabType="storage"
          uploaded={uploadedTabs.storage}
          progress={uploadProgress.storage}
          error={errors.storage}
          onUpload={handleTabUpload}
          description="Product classifications and hazmat information"
        />

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={!allTabsUploaded || analyzing}
          className={`w-full py-4 rounded-xl font-semibold text-white transition-all duration-300 ${
            allTabsUploaded && !analyzing
              ? 'hover:scale-[1.02] cursor-pointer'
              : 'opacity-50 cursor-not-allowed'
          }`}
          style={{
            background: allTabsUploaded && !analyzing
              ? 'linear-gradient(135deg, #0386FE, #9507FF)'
              : 'rgba(255, 255, 255, 0.1)',
            boxShadow: allTabsUploaded && !analyzing
              ? '0 4px 20px rgba(3, 134, 254, 0.3)'
              : 'none'
          }}
        >
          {analyzing ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={20} className="animate-spin" />
              Analyzing Data...
            </span>
          ) : allTabsUploaded ? (
            <span className="flex items-center justify-center gap-2">
              <CheckCircle size={20} />
              Analyze Data
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <AlertCircle size={20} />
              Upload all 3 tabs to continue
            </span>
          )}
        </button>

        {/* Session ID Display */}
        {sessionId && (
          <div className="text-xs text-gray-500 text-center">
            Session ID: {sessionId.substring(0, 8)}...
          </div>
        )}
      </div>
    </>
  );
};

export default React.memo(SeparateTabUploader);
