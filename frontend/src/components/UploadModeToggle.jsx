// ============================================================================
// UPLOAD MODE TOGGLE - UPDATED (Separate Tabs First)
// File: frontend/src/components/UploadModeToggle.jsx
// ============================================================================
// FIX: Reordered to show Separate Tabs first (recommended), Single File second
// ============================================================================

import React from 'react';
import { FileSpreadsheet, FolderOpen } from 'lucide-react';

const UploadModeToggle = ({ mode, onModeChange }) => {
  return (
    <div className="bg-gray-800/30 rounded-xl border border-gray-700 p-4 mb-6">
      <label className="text-sm font-medium text-gray-400 block mb-3">
        Upload Method
      </label>

      <div className="flex gap-3">
        {/* ✅ SEPARATE TABS FIRST (PRIMARY/RECOMMENDED) */}
        <button
          onClick={() => onModeChange('separate')}
          className={`flex-1 p-4 rounded-lg border-2 transition-all ${
            mode === 'separate'
              ? 'border-blue-500 bg-blue-900/30 text-white'
              : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <FolderOpen className={`w-6 h-6 ${mode === 'separate' ? 'text-blue-400' : 'text-gray-500'}`} />
            <div className="text-left">
              <div className="font-semibold flex items-center gap-2">
                Separate Tabs
                <span className="text-xs px-2 py-0.5 rounded-full" style={{
                  background: 'linear-gradient(135deg, #0386FE, #9507FF)',
                  color: 'white'
                }}>
                  Recommended
                </span>
              </div>
              <div className="text-xs mt-1 opacity-80">
                Upload FBA Shipment, Placement, and Storage separately
              </div>
            </div>
          </div>
        </button>

        {/* ✅ SINGLE FILE SECOND (LESS PROMINENT) */}
        <button
          onClick={() => onModeChange('single')}
          className={`flex-1 p-4 rounded-lg border-2 transition-all ${
            mode === 'single'
              ? 'border-gray-500 bg-gray-800/30 text-white'
              : 'border-gray-700 bg-gray-800/40 text-gray-500 hover:border-gray-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <FileSpreadsheet className={`w-5 h-5 ${mode === 'single' ? 'text-gray-400' : 'text-gray-600'}`} />
            <div className="text-left">
              <div className="font-medium text-sm">Single Excel File</div>
              <div className="text-xs mt-1 opacity-60">
                One file with all tabs
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

export default UploadModeToggle;
