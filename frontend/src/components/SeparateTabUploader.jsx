// ============================================================================
// SEPARATE TAB UPLOADER - OPTION 2: TOP RIGHT BUTTON PLACEMENT
// File: frontend/src/components/SeparateTabUploader.jsx
//
// Upload Button: Top Right (Most Compact)
// Step Icons: Compact & Interactive
// Brand color: #0386FE
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FileSpreadsheet, CheckCircle, AlertCircle, Loader2,
  ArrowRight, Check, Upload
} from 'lucide-react';
import { ProcessingModal } from '../ProcessingModal';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Step configuration
const UPLOAD_STEPS = [
  {
    id: 'data',
    step: 1,
    title: 'FBA Shipment Export',
    shortTitle: 'FBA Shipment',
    description: 'FBA shipment data with units, dates, and destinations'
  },
  {
    id: 'placement',
    step: 2,
    title: 'FBA Placement Fees',
    shortTitle: 'Placement',
    description: 'Placement fees for each FBA shipment'
  },
  {
    id: 'storage',
    step: 3,
    title: 'Monthly Storage Fees',
    shortTitle: 'Storage',
    description: 'Product classifications and hazmat information'
  }
];

const SeparateTabUploader = ({
  costConfig,
  hazmatFilter,
  getAuthHeader,
  onAnalysisComplete,
  onError
}) => {
  const fileInputRef = useRef(null);

  const [sessionId, setSessionId] = useState(null);
  const [uploadedTabs, setUploadedTabs] = useState({
    data: false,
    placement: false,
    storage: false
  });
  // ✅ Track uploaded file formats (CSV vs Excel) - for backend logging only
  const [uploadedFormats, setUploadedFormats] = useState({
    data: null,
    placement: null,
    storage: null
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

  // Current step state
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);

  // Smooth transition state
  const [isPreparingAnalysis, setIsPreparingAnalysis] = useState(false);

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

  // Validation warning modal state
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [validationStats, setValidationStats] = useState(null);

  // Auto-advance to next step when file uploaded
  useEffect(() => {
    const currentStepConfig = UPLOAD_STEPS.find(s => s.step === currentStep);
    if (currentStepConfig && uploadedTabs[currentStepConfig.id]) {
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps(prev => [...prev, currentStep]);

        // Auto-advance if not last step
        if (currentStep < UPLOAD_STEPS.length) {
          setTimeout(() => {
            setCurrentStep(currentStep + 1);
          }, 600);
        }
      }
    }
  }, [uploadedTabs, currentStep, completedSteps]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const currentStepConfig = UPLOAD_STEPS.find(s => s.step === currentStep);
    if (!currentStepConfig) return;

    const tabType = currentStepConfig.id;

    // ✅ Detect if file is CSV (for backend logging only)
    const isCSV = file.name.toLowerCase().endsWith('.csv');
    const fileFormat = isCSV ? 'CSV' : 'Excel';

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

        // ✅ Store file format from server response (for logging only, not displayed to user)
        const uploadedFormat = response.data.originalFormat || fileFormat;
        setUploadedFormats(prev => ({ ...prev, [tabType]: uploadedFormat }));

        // ✅ Log CSV conversion if it happened
        if (response.data.wasConverted) {
          console.log(`✅ ${tabType} tab: CSV file automatically converted to Excel`);
        }
      } else {
        throw new Error(response.data.error || 'Upload failed');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Upload failed';

      // ✅ Add helpful tip for CSV errors
      let displayError = errorMessage;
      if (error.response?.data?.wasCSV) {
        displayError += '\n\nTip: Ensure your CSV file has column headers in the first row.';
      }

      setErrors(prev => ({ ...prev, [tabType]: displayError }));
      setUploadProgress(prev => ({ ...prev, [tabType]: 0 }));
      setUploadedTabs(prev => ({ ...prev, [tabType]: false }));
      setUploadedFormats(prev => ({ ...prev, [tabType]: null }));

      if (error.response?.status === 401 || error.response?.data?.requiresAuth) {
        onError?.('Please log in to upload files. Your session may have expired.');
      }
    }

    // Reset input
    e.target.value = '';
  };

  const goToStep = (stepNumber) => {
    if (stepNumber <= currentStep || completedSteps.includes(stepNumber - 1)) {
      setCurrentStep(stepNumber);
    }
  };

  const handleAnalyze = async () => {
    if (!sessionId) {
      onError?.('No session found. Please upload all tabs first.');
      return;
    }

    setIsPreparingAnalysis(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 200));

      const validationResponse = await axios.post(
        `${API_URL}/validate-session`,
        { sessionId },
        { headers: getAuthHeader() }
      );

      if (validationResponse.data.warnings && validationResponse.data.warnings.length > 0) {
        setValidationWarnings(validationResponse.data.warnings);
        setValidationStats(validationResponse.data.stats);
        setShowWarningModal(true);
        setIsPreparingAnalysis(false);
        return;
      }

      await proceedWithAnalysis();
    } catch (error) {
      if (error.response?.status === 404) {
        await proceedWithAnalysis();
      } else {
        setIsPreparingAnalysis(false);
        onError?.('Validation failed: ' + (error.message || 'Unknown error'));
      }
    }
  };

  const proceedWithAnalysis = async () => {
    setAnalyzing(true);
    setIsPreparingAnalysis(false);

    await new Promise(resolve => setTimeout(resolve, 100));
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

        if (data) {
          const metadata = data.metadata || {};
          const currentCosts = metadata.currentCosts || {};

          const totalUnits = metadata.totalUnits || 0;
          const totalCost = currentCosts.totalFreight || 0;
          const placementFees = currentCosts.totalPlacementFees || 0;
          const avgCost = currentCosts.costPerUnit || 0;
          const shipmentCount = data.totalShipments || 0;

          setProcessingStats({
            avgCostPerUnit: avgCost,
            totalUnits: totalUnits,
            totalShippingCost: totalCost,
            totalPlacementFees: placementFees
          });
          setTotalShipments(shipmentCount);
          setProcessedShipments(shipmentCount);
        }

        setTimeout(() => {
          setProcessingModalOpen(false);
          setAnalyzing(false);

          const extractedBrandName = response.data.brandName || data?.brandName || null;
          onAnalysisComplete?.(data, response.data.reportId, extractedBrandName);

          setSessionId(null);
          setUploadedTabs({ data: false, placement: false, storage: false });
          setCurrentStep(1);
          setCompletedSteps([]);
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

  const allFilesUploaded = uploadedTabs.data && uploadedTabs.placement && uploadedTabs.storage;
  const currentStepConfig = UPLOAD_STEPS.find(s => s.step === currentStep);
  const currentTabType = currentStepConfig?.id;
  const isCurrentStepUploaded = currentTabType && uploadedTabs[currentTabType];
  const currentProgress = currentTabType ? uploadProgress[currentTabType] : 0;
  const currentError = currentTabType ? errors[currentTabType] : null;

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

      {/* Validation Warning Modal */}
      {showWarningModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-gray-900 rounded-xl p-5 max-w-2xl mx-4 border border-yellow-500/30 max-h-[80vh] overflow-y-auto animate-slideUp">
            <div className="flex items-start gap-3 mb-3">
              <AlertCircle size={24} className="text-yellow-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-bold text-yellow-400">Data Quality Warnings</h3>
                <p className="text-xs text-gray-400 mt-1">
                  We detected some potential issues with your uploaded files
                </p>
              </div>
            </div>

            {validationStats && (
              <div className="mb-3 p-2 rounded-lg bg-gray-800/50 border border-gray-700">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-lg font-bold text-white">{validationStats.dataRows || 0}</div>
                    <div className="text-[10px] text-gray-400">Data Rows</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">{validationStats.placementRows || 0}</div>
                    <div className="text-[10px] text-gray-400">Placement</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">{validationStats.storageRows || 0}</div>
                    <div className="text-[10px] text-gray-400">Storage</div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 mb-4">
              {validationWarnings.map((warning, idx) => (
                <div key={idx} className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
                  <p className="text-white text-sm font-medium mb-1">{warning.message}</p>
                  <p className="text-xs text-gray-400">
                    <strong>Impact:</strong> {warning.impact}
                  </p>
                  <p className="text-xs text-blue-400">
                    <strong>Suggestion:</strong> {warning.suggestion}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowWarningModal(false);
                  setValidationWarnings([]);
                  setValidationStats(null);
                }}
                className="flex-1 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowWarningModal(false);
                  proceedWithAnalysis();
                }}
                className="flex-1 px-3 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-semibold transition-colors"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Main Upload UI */}
      <div className="space-y-4">
        {/* Step Indicator - Compact & Interactive */}
        <div className="flex items-center justify-between px-2">
          {UPLOAD_STEPS.map((step, index) => (
            <React.Fragment key={step.id}>
              <button
                onClick={() => goToStep(step.step)}
                disabled={step.step > currentStep && !completedSteps.includes(step.step - 1)}
                className={`group flex flex-col items-center transition-all duration-300 ${
                  step.step > currentStep && !completedSteps.includes(step.step - 1)
                    ? 'opacity-40 cursor-not-allowed'
                    : 'cursor-pointer hover:scale-110 active:scale-95'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                    completedSteps.includes(step.step)
                      ? 'bg-[#0386FE] text-white shadow-lg shadow-[#0386FE]/50 group-hover:shadow-[#0386FE]/70'
                      : currentStep === step.step
                      ? 'bg-[#0386FE]/20 text-[#0386FE] border-2 border-[#0386FE] ring-2 ring-[#0386FE]/30 animate-pulse-slow'
                      : 'bg-gray-800 text-gray-600 border-2 border-gray-700 group-hover:border-gray-600'
                  }`}
                >
                  {completedSteps.includes(step.step) ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    step.step
                  )}
                </div>
                <div className="mt-1 text-center">
                  <p className={`text-[10px] font-medium transition-colors ${
                    completedSteps.includes(step.step) || currentStep >= step.step
                      ? 'text-white'
                      : 'text-gray-500'
                  }`}>
                    Step {step.step}
                  </p>
                  <p className="text-[8px] text-gray-500 mt-0.5 leading-tight">{step.shortTitle}</p>
                </div>
              </button>

              {index < UPLOAD_STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 mb-5 relative">
                  <div className="absolute inset-0 bg-gray-700/50 rounded-full" />
                  <div
                    className={`absolute inset-0 rounded-full transition-all duration-700 ease-out ${
                      completedSteps.includes(step.step)
                        ? 'bg-[#0386FE] w-full'
                        : 'bg-[#0386FE] w-0'
                    }`}
                    style={{
                      boxShadow: completedSteps.includes(step.step) ? '0 0 10px rgba(3, 134, 254, 0.6)' : 'none'
                    }}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Current Step Card - OPTION 2: TOP RIGHT BUTTON */}
        {currentStepConfig && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-[#0386FE]/30 shadow-lg shadow-[#0386FE]/10 p-4 animate-fadeIn">
            {/* Header with Upload Button on Right */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="p-2 rounded-lg bg-[#0386FE]/20 text-[#0386FE] flex-shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-white mb-1">
                    {currentStepConfig.title}
                  </h3>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    {currentStepConfig.description}
                  </p>
                </div>
              </div>

              {/* Upload Button - TOP RIGHT (Next to title) */}
              {!isCurrentStepUploaded && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={currentProgress > 0 && currentProgress < 100}
                  className={`px-4 py-2 rounded-lg font-medium text-xs transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
                    currentProgress > 0 && currentProgress < 100
                      ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                      : 'bg-[#0386FE] hover:bg-[#0275E6] text-white shadow-md shadow-[#0386FE]/30 hover:shadow-lg hover:shadow-[#0386FE]/50 transform hover:scale-105 active:scale-95'
                  }`}
                >
                  {currentProgress > 0 && currentProgress < 100 ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{currentProgress}%</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Status Messages */}
            <div className="space-y-2">
              {isCurrentStepUploaded && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-green-400 font-medium">Uploaded successfully</p>
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors text-[10px]"
                    >
                      Replace
                    </button>
                  </div>
                </div>
              )}

              {currentError && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-2.5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-red-400 font-medium">Upload failed</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{currentError}</p>
                    </div>
                  </div>
                </div>
              )}

              {currentProgress > 0 && currentProgress < 100 && (
                <div className="mt-2">
                  <div className="w-full bg-gray-700 rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-[#0386FE] h-1 rounded-full transition-all duration-300 shadow-sm shadow-[#0386FE]/50"
                      style={{ width: `${currentProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Analyze Button */}
        <div className="pt-2">
          <button
            onClick={handleAnalyze}
            disabled={!allFilesUploaded || analyzing || isPreparingAnalysis}
            className={`w-full py-3.5 px-5 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
              allFilesUploaded && !analyzing && !isPreparingAnalysis
                ? 'bg-[#0386FE] hover:bg-[#0275E6] text-white shadow-lg shadow-[#0386FE]/40 hover:shadow-xl hover:shadow-[#0386FE]/60 transform hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isPreparingAnalysis ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Preparing Analysis...</span>
              </>
            ) : analyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Analyzing Data...</span>
              </>
            ) : allFilesUploaded ? (
              <>
                <span>Analyze Data</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <span>Complete all 3 steps to continue</span>
            )}
          </button>

          {allFilesUploaded && !analyzing && !isPreparingAnalysis && (
            <p className="text-center text-[10px] text-gray-400 mt-2 animate-fadeIn">
              All files uploaded successfully
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }

        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }

        .animate-pulse-slow {
          animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </>
  );
};

export default React.memo(SeparateTabUploader);
