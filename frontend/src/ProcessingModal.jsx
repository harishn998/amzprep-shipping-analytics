// ============================================================================
// PROCESSING MODAL COMPONENT - Enterprise-Level Design
// Updated Brand Colors: #000000 → #091332 background, #0386FE → #9507FF gradient
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div
        className="rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #000000 0%, #091332 100%)',
          border: '1px solid rgba(3, 134, 254, 0.2)'
        }}
      >
        {/* Header - Dark with Logo */}
        <div className="px-8 py-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            {/* Logo Container - Dark background */}
            <div
              className="p-3 rounded-xl"
              style={{
                background: 'rgba(10, 15, 30, 0.8)',
                border: '1px solid rgba(3, 134, 254, 0.3)'
              }}
            >
              <img
                src={amzprepLogo}
                alt="AMZ Prep"
                className="h-8 w-auto"
              />
            </div>
            <div>
              <h2
                className="text-2xl font-bold"
                style={{
                  background: 'linear-gradient(90deg, #0386FE, #9507FF)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                Enterprise Shipment Export
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                Processing your shipment data...
              </p>
            </div>
          </div>
        </div>

        {/* Processing Status */}
        <div className="px-8 py-6">
          {/* Animated Loader with Progress */}
          <div className="flex items-center justify-center mb-8">
            <div className="relative">
              {/* Gradient ring background */}
              <div
                className="absolute inset-0 rounded-full blur-xl opacity-30"
                style={{
                  background: 'linear-gradient(135deg, #0386FE, #9507FF)'
                }}
              />
              <Loader2
                className="w-16 h-16 animate-spin relative"
                style={{
                  color: '#0386FE'
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="font-bold text-lg"
                  style={{
                    background: 'linear-gradient(135deg, #0386FE, #9507FF)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
          </div>

          {/* Processing Text */}
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold text-white mb-2">
              Processing {totalCount > 0 ? totalCount.toLocaleString() : ''} shipments...
            </h3>
            <div
              className="font-medium"
              style={{
                background: 'linear-gradient(90deg, #0386FE, #9507FF)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              {processedCount.toLocaleString()} / {totalCount.toLocaleString()} shipments processed
            </div>
          </div>

          {/* Progress Bar with Gradient */}
          <div className="mb-8">
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{
                background: 'rgba(255, 255, 255, 0.1)'
              }}
            >
              <div
                className="h-full transition-all duration-300 ease-out rounded-full"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #0386FE, #9507FF)'
                }}
              />
            </div>
          </div>

          {/* Real-Time Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Avg Cost/Unit */}
            <div
              className="rounded-xl p-4"
              style={{
                background: 'rgba(10, 15, 30, 0.6)',
                border: '1px solid rgba(3, 134, 254, 0.2)'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <Clock
                  size={22}
                  style={{
                    stroke: 'url(#iconGradient)',
                    color: '#0386FE'
                  }}
                />
              </div>
              <div className="text-2xl font-bold text-white">
                ${avgCostPerUnit.toFixed(2)}
              </div>
              <div
                className="text-xs mt-1 font-medium"
                style={{ color: 'rgba(3, 134, 254, 0.7)' }}
              >
                AVG COST/UNIT
              </div>
            </div>

            {/* Total Units */}
            <div
              className="rounded-xl p-4"
              style={{
                background: 'rgba(10, 15, 30, 0.6)',
                border: '1px solid rgba(3, 134, 254, 0.2)'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <Package
                  size={22}
                  style={{ color: '#0386FE' }}
                />
              </div>
              <div className="text-2xl font-bold text-white">
                {totalUnits.toLocaleString()}
              </div>
              <div
                className="text-xs mt-1 font-medium"
                style={{ color: 'rgba(3, 134, 254, 0.7)' }}
              >
                UNITS
              </div>
            </div>

            {/* Shipping Cost */}
            <div
              className="rounded-xl p-4"
              style={{
                background: 'rgba(10, 15, 30, 0.6)',
                border: '1px solid rgba(3, 134, 254, 0.2)'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <DollarSign
                  size={22}
                  style={{ color: '#9507FF' }}
                />
              </div>
              <div className="text-2xl font-bold text-white">
                ${totalShippingCost.toLocaleString()}
              </div>
              <div
                className="text-xs mt-1 font-medium"
                style={{ color: 'rgba(149, 7, 255, 0.7)' }}
              >
                SHIPPING COST
              </div>
            </div>

            {/* Placement Fees */}
            <div
              className="rounded-xl p-4"
              style={{
                background: 'rgba(10, 15, 30, 0.6)',
                border: '1px solid rgba(149, 7, 255, 0.2)'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <MapPin
                  size={22}
                  style={{ color: '#9507FF' }}
                />
              </div>
              <div className="text-2xl font-bold text-white">
                ${totalPlacementFees.toLocaleString()}
              </div>
              <div
                className="text-xs mt-1 font-medium"
                style={{ color: 'rgba(149, 7, 255, 0.7)' }}
              >
                PLACEMENT FEES
              </div>
            </div>
          </div>

          {/* Processing Steps */}
          <div className="mt-6 space-y-3">
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
 * Processing Step Component with gradient styling
 */
const ProcessingStep = ({ completed, active, label }) => {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${
          active ? 'animate-pulse' : ''
        }`}
        style={{
          background: completed
            ? 'linear-gradient(135deg, #0386FE, #9507FF)'
            : active
              ? 'linear-gradient(135deg, #0386FE, #9507FF)'
              : 'rgba(255, 255, 255, 0.1)',
          boxShadow: (completed || active)
            ? '0 0 12px rgba(3, 134, 254, 0.4)'
            : 'none'
        }}
      >
        {completed && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className={`transition-colors duration-300 ${
        completed
          ? 'text-gray-500 line-through'
          : active
            ? 'text-white font-medium'
            : 'text-gray-600'
      }`}>
        {label}
      </span>
    </div>
  );
};

export default ProcessingModal;
