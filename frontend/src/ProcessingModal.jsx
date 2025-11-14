// ============================================================================
// PROCESSING MODAL COMPONENT - Enterprise-Level Design
// Unified Color Theme: #00A8FF
// File: ProcessingModal.jsx
// ============================================================================

import React from 'react';
import { Loader2, Clock, Package, DollarSign, MapPin } from 'lucide-react';
import amzprepLogo from './assets/amzprep_white_logo.png';

/**
 * Enterprise-level processing modal
 * Shows animated loading state with real-time statistics
 */
export const ProcessingModal = ({
  isOpen,
  progress = 0,
  processedCount = 0,
  totalCount = 0,
  stats = {}
}) => {
  if (!isOpen) return null;

  // Calculate stats with defaults
  const avgCostPerUnit = stats.avgCostPerUnit || 0;
  const totalUnits = stats.totalUnits || 0;
  const totalShippingCost = stats.totalShippingCost || 0;
  const totalPlacementFees = stats.totalPlacementFees || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header - Custom Gradient */}
        <div
          className="px-8 py-6"
          style={{
            background: 'linear-gradient(90deg, #00A8FF 0%, #00D4FF 25%, #00A8FF 50%, #0074D9 75%, #00A8FF 100%)'
          }}
        >
          <div className="flex items-center gap-4">
            <div className="bg-white/10 p-3 rounded-lg backdrop-blur-sm">
              <img
                src={amzprepLogo}
                alt="AMZ Prep"
                className="h-8 w-auto"
              />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                Enterprise Shipment Export
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                Processing your shipment data...
              </p>
            </div>
          </div>
        </div>

        {/* Processing Status */}
        <div className="px-8 py-6">
          {/* Animated Loader with Progress - 🆕 Unified Color */}
          <div className="flex items-center justify-center mb-8">
            <div className="relative">
              <Loader2
                className="w-16 h-16 animate-spin"
                style={{ color: '#00A8FF' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
          </div>

          {/* Processing Text - 🆕 Unified Color */}
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold text-white mb-2">
              Processing {totalCount > 0 ? totalCount : ''} shipments...
            </h3>
            <div
              className="font-medium"
              style={{ color: '#00A8FF' }}
            >
              {processedCount} / {totalCount} shipments processed
            </div>
          </div>

          {/* Progress Bar - 🆕 Unified Color */}
          <div className="mb-8">
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300 ease-out"
                style={{
                  width: `${progress}%`,
                  background: '#00A8FF'
                }}
              />
            </div>
          </div>

          {/* Real-Time Stats Grid - 🆕 All Icons Unified Color */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Avg Cost/Unit */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <Clock style={{ color: '#00A8FF' }} size={24} />
              </div>
              <div className="text-2xl font-bold text-white">
                ${avgCostPerUnit.toFixed(2)}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                AVG COST/UNIT
              </div>
            </div>

            {/* Total Units */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <Package style={{ color: '#00A8FF' }} size={24} />
              </div>
              <div className="text-2xl font-bold text-white">
                {totalUnits.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                UNITS
              </div>
            </div>

            {/* Shipping Cost */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <DollarSign style={{ color: '#00A8FF' }} size={24} />
              </div>
              <div className="text-2xl font-bold text-white">
                ${totalShippingCost.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                SHIPPING COST
              </div>
            </div>

            {/* Placement Fees */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <MapPin style={{ color: '#00A8FF' }} size={24} />
              </div>
              <div className="text-2xl font-bold text-white">
                ${totalPlacementFees.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                PLACEMENT FEES
              </div>
            </div>
          </div>

          {/* Processing Steps - 🆕 Unified Colors */}
          <div className="mt-6 space-y-2">
            <ProcessingStep
              completed={progress > 20}
              active={progress <= 20}
              label="Reading file data"
            />
            <ProcessingStep
              completed={progress > 40}
              active={progress > 20 && progress <= 40}
              label="Parsing shipment information"
            />
            <ProcessingStep
              completed={progress > 60}
              active={progress > 40 && progress <= 60}
              label="Calculating cost analysis"
            />
            <ProcessingStep
              completed={progress > 80}
              active={progress > 60 && progress <= 80}
              label="Generating recommendations"
            />
            <ProcessingStep
              completed={progress > 95}
              active={progress > 80}
              label="Finalizing report"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Processing Step Component - 🆕 Unified Colors
 */
const ProcessingStep = ({ completed, active, label }) => {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div
        className={`w-4 h-4 rounded-full flex items-center justify-center ${
          completed ? '' : active ? 'animate-pulse' : 'bg-gray-700'
        }`}
        style={{
          backgroundColor: completed ? '#00A8FF' : active ? '#00A8FF' : undefined
        }}
      >
        {completed && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className={`${
        completed
          ? 'text-gray-400 line-through'
          : active
            ? 'text-white font-medium'
            : 'text-gray-500'
      }`}>
        {label}
      </span>
    </div>
  );
};

export default ProcessingModal;
