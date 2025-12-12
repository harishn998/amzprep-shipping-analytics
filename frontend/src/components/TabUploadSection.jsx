// ============================================================================
// TAB UPLOAD SECTION - Individual tab upload component (FIXED)
// File: frontend/src/components/TabUploadSection.jsx
// ============================================================================

import React, { useRef } from 'react';
import { FileSpreadsheet, Upload, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const TabUploadSection = ({
  tabName,
  tabType,
  uploaded,
  progress,
  error,
  onUpload,
  description,
}) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onUpload(tabType, file);  // ✅ FIXED: Pass BOTH tabType and file
    }
    // Reset input so same file can be uploaded again
    e.target.value = '';
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-5 hover:border-gray-600 transition-colors">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`p-3 rounded-lg ${
          uploaded
            ? 'bg-green-900/30 text-green-400'
            : error
            ? 'bg-red-900/30 text-red-400'
            : 'bg-blue-900/30 text-blue-400'
        }`}>
          <FileSpreadsheet className="w-6 h-6" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <h4 className="text-lg font-semibold text-white">{tabName}</h4>
              <p className="text-sm text-gray-400">{description}</p>
            </div>

            {/* Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={progress > 0 && progress < 100}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
                uploaded
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : progress > 0 && progress < 100
                  ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Upload className="w-4 h-4" />
              {progress > 0 && progress < 100
                ? `${progress}%`
                : uploaded
                ? 'Replace'
                : 'Upload'}
            </button>
          </div>

          {/* Status */}
          {uploaded && (
            <div className="flex items-center gap-2 text-sm text-green-400 mt-3">
              <CheckCircle className="w-4 h-4" />
              <span className="font-medium">Uploaded successfully</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-400 mt-3 bg-red-900/20 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!uploaded && !error && progress === 0 && (
            <div className="text-sm text-gray-500 mt-3">
              <XCircle className="w-4 h-4 inline mr-1" />
              Not uploaded yet
            </div>
          )}

          {/* Progress Bar */}
          {progress > 0 && progress < 100 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
};

export default TabUploadSection;
