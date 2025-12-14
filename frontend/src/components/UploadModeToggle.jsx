// ============================================================================
// UPLOAD MODE TOGGLE - RECOMMENDED BADGE NEXT TO TITLE
// File: frontend/src/components/UploadModeToggle.jsx
// ============================================================================
// Features:
// - Recommended badge directly next to "Separate File Upload" title
// - Clean, professional layout
// - Brand color #0386FE
// ============================================================================

import React, { useState } from 'react';
import { FileSpreadsheet, FolderOpen, Repeat } from 'lucide-react';

const UploadModeToggle = ({ mode, onModeChange }) => {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div className="relative mb-5">
      {/* Compact Method Display */}
      <div
        className="bg-gray-800/30 rounded-xl border border-gray-700 p-4 relative"
        style={{
          background: 'rgba(10, 15, 26, 0.4)',
          border: '1px solid rgba(3, 134, 254, 0.2)'
        }}
      >
        {/* Header Row - Badge integrated with title */}
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Left: Icon + Title + Badge (inline) */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="p-1.5 rounded-lg bg-[#0386FE]/20 flex-shrink-0">
              {mode === 'separate' ? (
                <FolderOpen className="w-4 h-4 text-[#0386FE]" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-[#0386FE]" />
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-white">
                {mode === 'separate' ? 'Separate File Upload' : 'Single File Upload'}
              </h3>
              {/* Recommended Badge - Right next to title */}
              {mode === 'separate' && (
                <span
                  className="text-[9px] px-2 py-0.5 rounded-full text-white font-bold whitespace-nowrap leading-tight"
                  style={{
                    background: 'linear-gradient(135deg, #0386FE, #9507FF)'
                  }}
                >
                  Recommended
                </span>
              )}
            </div>
          </div>

          {/* Right: Swap Button only */}
          <div className="flex items-center flex-shrink-0">
            <div className="relative">
              <button
                onClick={() => onModeChange(mode === 'separate' ? 'single' : 'separate')}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-[#0386FE] transition-all duration-300 border border-gray-700 hover:border-[#0386FE]"
                title="Switch upload method"
              >
                <span className="text-[11px] font-medium text-gray-400 group-hover:text-white transition-colors duration-300 whitespace-nowrap">
                  Use {mode === 'separate' ? 'Single File' : 'Separate File'}
                </span>
                <Repeat className="w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-all duration-300 group-hover:rotate-180 flex-shrink-0" />
              </button>

              {/* Hover Tooltip */}
              {isHovering && (
                <div className="absolute right-0 top-full mt-2 z-10 animate-slideDown">
                  <div className="bg-gray-900 border border-[#0386FE]/30 rounded-lg px-3 py-2 shadow-lg shadow-[#0386FE]/20 whitespace-nowrap">
                    <p className="text-xs font-medium text-white">
                      {mode === 'separate' ? 'Single File Upload' : 'Separate File Upload'}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {mode === 'separate'
                        ? 'One Excel file with all tabs'
                        : 'Upload files separately'
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Description - Compact */}
        <div className="space-y-2.5">
          {/* Separate File View */}
          <div
            className={`transition-all duration-500 ${
              mode === 'separate' ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'
            }`}
          >
            <p className="text-[13px] text-gray-400 leading-relaxed mb-2.5">
              Upload FBA Shipment, Placement Fees, and Monthly Storage files step-by-step for better accuracy
            </p>
            <div className="flex flex-wrap gap-1.5">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-[#0386FE]/10 rounded-full border border-[#0386FE]/20">
                <div className="w-1 h-1 rounded-full bg-[#0386FE] flex-shrink-0" />
                <span className="text-[11px] text-gray-300 whitespace-nowrap">Step-by-step</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-[#0386FE]/10 rounded-full border border-[#0386FE]/20">
                <div className="w-1 h-1 rounded-full bg-[#0386FE] flex-shrink-0" />
                <span className="text-[11px] text-gray-300 whitespace-nowrap">Better validation</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-[#0386FE]/10 rounded-full border border-[#0386FE]/20">
                <div className="w-1 h-1 rounded-full bg-[#0386FE] flex-shrink-0" />
                <span className="text-[11px] text-gray-300 whitespace-nowrap">More accurate</span>
              </div>
            </div>
          </div>

          {/* Single File View */}
          <div
            className={`transition-all duration-500 ${
              mode === 'single' ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'
            }`}
          >
            <p className="text-[13px] text-gray-400 leading-relaxed mb-2.5">
              Upload one Excel file containing all required tabs (FBA Shipment, Placement, Storage, FBA Zoning)
            </p>
            <div className="flex items-start gap-2 p-2 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <div className="w-1 h-1 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
              <p className="text-[11px] text-blue-300 leading-relaxed">
                Ensure all required tabs are present
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slideDown {
          animation: slideDown 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default UploadModeToggle;
