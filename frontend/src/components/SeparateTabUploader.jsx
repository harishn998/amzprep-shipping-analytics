// ============================================================================
// SEPARATE TAB UPLOADER - UPDATED WITH ALL FIXES
// File: frontend/src/components/SeparateTabUploader.jsx
// ============================================================================
// FIXES:
// 1. ✅ Updated tab names (FBA Shipment Export, FBA Placement Fees, Monthly Storage Fees)
// 2. ✅ Processing modal uses real stats (not hardcoded zeros)
// 3. ✅ Brand name extraction and passing to parent
// 4. ✅ Cost configuration properly sent to backend
// ============================================================================

import React, { useState } from 'react';
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

  // ✅ FIX #1: Add processing stats state (not hardcoded zeros)
  const [processingStats, setProcessingStats] = useState({
    avgCostPerUnit: 0,
    totalUnits: 0,
    totalShippingCost: 0,
    totalPlacementFees: 0
  });

  /**
   * Handle individual tab upload
   */
  const handleTabUpload = async (tabType, file) => {
    try {
      // Reset error for this tab
      setErrors(prev => ({ ...prev, [tabType]: null }));

      // Reset progress
      setUploadProgress(prev => ({ ...prev, [tabType]: 0 }));

      const formData = new FormData();
      formData.append('file', file);
      formData.append('tabType', tabType);
      if (sessionId) {
        formData.append('sessionId', sessionId);
      }

      // Get auth header
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
        // Store session ID from first upload
        if (!sessionId && response.data.sessionId) {
          setSessionId(response.data.sessionId);
        }

        // Mark tab as uploaded
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

  /**
   * Trigger analysis when all tabs uploaded
   */
  const handleAnalyze = async () => {
    if (!sessionId) {
      onError?.('No session found. Please upload all tabs first.');
      return;
    }

    setAnalyzing(true);
    setProcessingModalOpen(true);
    setAnalysisProgress(0);
    setProcessedShipments(0);

    try {
      // Simulate progress for user feedback
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 1;
        });
      }, 100);

      // ✅ FIX #2: Ensure costConfig is sent
      const response = await axios.post(
        `${API_URL}/separate-analyze`,
        {
          sessionId,
          costConfig,  // ✅ Cost configuration included
          hazmatFilter
        },
        {
          headers: getAuthHeader()
        }
      );

      clearInterval(progressInterval);
      setAnalysisProgress(100);

      if (response.data.success) {
        // ✅ COMPREHENSIVE LOGGING - See ALL backend data
        const data = response.data.data;

        console.log('🔍 ========== FULL BACKEND RESPONSE ==========');
        console.log('response.data keys:', Object.keys(response.data));
        console.log('response.data.success:', response.data.success);
        console.log('response.data.reportId:', response.data.reportId);
        console.log('response.data.brandName:', response.data.brandName);
        console.log('');
        console.log('response.data.data keys:', Object.keys(data || {}));
        console.log('');

        // Log ALL fields that might contain our data
        console.log('🔍 ALL DATA FIELDS:');
        Object.keys(data || {}).forEach(key => {
          const value = data[key];
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            console.log(`  ${key} (object):`, Object.keys(value));
          } else if (Array.isArray(value)) {
            console.log(`  ${key} (array): length ${value.length}`);
          } else {
            console.log(`  ${key}:`, value);
          }
        });
        console.log('');

        // Look for stats in common locations
        console.log('🔍 SEARCHING FOR STATS:');
        const possibleLocations = [
          { path: 'data', obj: data },
          { path: 'data.summary', obj: data?.summary },
          { path: 'data.totals', obj: data?.totals },
          { path: 'data.statistics', obj: data?.statistics },
          { path: 'data.metadata', obj: data?.metadata },
          { path: 'data.analysisResults', obj: data?.analysisResults }
        ];

        possibleLocations.forEach(({ path, obj }) => {
          if (obj && typeof obj === 'object') {
            console.log(`  In ${path}:`, obj);
          }
        });
        console.log('=============================================');

        if (data) {
          // ✅ CORRECT FIELD LOCATIONS (from console output analysis)
          const metadata = data.metadata || {};
          const currentCosts = metadata.currentCosts || {};

          // Stats are in metadata and metadata.currentCosts
          const totalUnits = metadata.totalUnits || data.totalUnits || data.units || 0;
          const totalCost = currentCosts.totalFreight || currentCosts.totalCost || data.totalCost || 0;
          const placementFees = currentCosts.totalPlacementFees || data.totalPlacementFees || 0;
          const avgCost = currentCosts.costPerUnit || data.avgCost ||
            (totalCost && totalUnits ? totalCost / totalUnits : 0);
          const shipmentCount = data.totalShipments || data.shipmentCount || 0;

          console.log('📊 Processing Stats Calculated (CORRECTED):', {
            avgCost,
            totalUnits,
            totalCost,
            placementFees,
            shipmentCount,
            source: 'metadata.currentCosts'
          });

          setProcessingStats({
            avgCostPerUnit: avgCost,
            totalUnits: totalUnits,
            totalShippingCost: totalCost,
            totalPlacementFees: placementFees
          });
          setTotalShipments(shipmentCount);
          setProcessedShipments(shipmentCount);
        }

        // Small delay to show 100% completion
        setTimeout(() => {
          setProcessingModalOpen(false);
          setAnalyzing(false);

          // ✅ FIX #4: Use brand name from backend (extracted from filename)
          // Backend extracts from Data tab filename like:
          //   "Copy of FBGC Analysis.xlsx" → "FBGC"
          //   "Get Welly Analysis.xlsx" → "Get Welly"
          const extractedBrandName = response.data.brandName || data?.brandName || null;

          console.log('🏷️ Brand Name from Backend:', {
            brandName: response.data.brandName,
            fallback: data?.brandName,
            final: extractedBrandName
          });

          onAnalysisComplete?.(data, response.data.reportId, extractedBrandName);

          // Reset for next upload
          setSessionId(null);
          setUploadedTabs({ data: false, placement: false, storage: false });
          setProcessingStats({
            avgCostPerUnit: 0,
            totalUnits: 0,
            totalShippingCost: 0,
            totalPlacementFees: 0
          });
        }, 500);
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
      {/* Modal via Portal - ✅ FIX #5: Use real stats */}
      {processingModalOpen && createPortal(
        <ProcessingModal
          isOpen={processingModalOpen}
          progress={analysisProgress}
          processedCount={processedShipments}
          totalCount={totalShipments || Math.max(processedShipments, 1)}
          stats={processingStats}  // ✅ Real stats, not hardcoded zeros
        />,
        document.body
      )}

      <div className="space-y-6">
        {/* Instructions - ✅ FIX #6: Updated tab names */}
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
                <li>Upload your <span className="text-blue-400 font-medium">FBA Placement Fees</span> tab</li>
                <li>Upload your <span className="text-blue-400 font-medium">Monthly Storage Fees</span> tab</li>
                <li>Click "Analyze Data" when all tabs are uploaded</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Data Tab Upload - ✅ FIX #7: Updated name */}
        <TabUploadSection
          tabName="FBA Shipment Export"
          tabType="data"
          uploaded={uploadedTabs.data}
          progress={uploadProgress.data}
          error={errors.data}
          onUpload={handleTabUpload}
          description="FBA shipment data with units, dates, and destinations"
        />

        {/* Placement Tab Upload - ✅ FIX #8: Updated name */}
        <TabUploadSection
          tabName="FBA Placement Fees"
          tabType="placement"
          uploaded={uploadedTabs.placement}
          progress={uploadProgress.placement}
          error={errors.placement}
          onUpload={handleTabUpload}
          description="Placement fees for each FBA shipment"
        />

        {/* Storage Tab Upload - ✅ FIX #9: Updated name */}
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

        {/* Session Status */}
        {sessionId && (
          <div className="text-xs text-gray-500 text-center">
            Session ID: {sessionId.substring(0, 8)}...
          </div>
        )}
      </div>
    </>
  );
};

export default SeparateTabUploader;
