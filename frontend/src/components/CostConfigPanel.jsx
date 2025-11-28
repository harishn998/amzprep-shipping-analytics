// ============================================================================
// COST CONFIGURATION PANEL - CORRECTED DEFAULTS
// Defaults now match the pivot table analysis values
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, DollarSign, Truck, MapPin, Calculator, Info, ChevronDown, ChevronUp } from 'lucide-react';

// ✅ CORRECTED: Default values matching the pivot table analysis
const DEFAULT_CONFIG = {
  freightCost: 1315,       // FTL cost (from Illinois to KY)
  freightMarkup: 1.2,      // 20% markup
  mmBaseCost: 2.625,       // ✅ FIXED: Was 2.75, pivot uses 2.625
  mmMarkup: 1.0,           // ✅ FIXED: Was 1.05 (5%), pivot uses 1.0 (no markup)
  rateMode: 'FTL',         // Full Truckload
  destination: 'KY',       // Hebron, KY
  palletCost: 150          // Pallet rate (when using PALLET mode)
};

// Pattern rates from Freight Rate sheet
// Note: Pivot table analysis uses 2.625 for KY Standard (blended rate)
const PATTERN_RATES = {
  KY: { Standard: 2.625, Oversize: 4.00, Hazmat: 6.00 },  // ✅ Updated Standard
  VEGAS: { Standard: 3.75, Oversize: 5.00, Hazmat: 7.00 }
};

export const CostConfigPanel = ({ onConfigChange, disabled = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [preview, setPreview] = useState({
    totalFreightCost: '1578.00',
    internalTransferRate: '0.9059',
    mmRate: '2.6250',
    mmCostPT: '1709.50'
  });

  // Store callback in ref to avoid dependency issues
  const onConfigChangeRef = useRef(onConfigChange);
  onConfigChangeRef.current = onConfigChange;

  // Calculate preview values whenever config changes
  useEffect(() => {
    const fc = typeof config.freightCost === 'number' ? config.freightCost : parseFloat(config.freightCost) || 0;
    const fm = typeof config.freightMarkup === 'number' ? config.freightMarkup : parseFloat(config.freightMarkup) || 1;
    const mbc = typeof config.mmBaseCost === 'number' ? config.mmBaseCost : parseFloat(config.mmBaseCost) || 0;
    const mm = typeof config.mmMarkup === 'number' ? config.mmMarkup : parseFloat(config.mmMarkup) || 1;
    const pc = typeof config.palletCost === 'number' ? config.palletCost : parseFloat(config.palletCost) || 0;

    const totalFreightCost = fc * fm;
    const internalTransferRate = config.rateMode === 'FTL'
      ? totalFreightCost / 1742
      : (pc * fm) / 67;
    const mmRate = mbc * mm;

    setPreview({
      totalFreightCost: totalFreightCost.toFixed(2),
      internalTransferRate: internalTransferRate.toFixed(4),
      mmRate: mmRate.toFixed(4),
      mmCostPT: (fc * 1.3).toFixed(2)
    });
  }, [config]);

  // ✅ KEY FIX: Only notify parent when panel CLOSES or on initial mount
  useEffect(() => {
    // When panel closes, send the final config to parent
    if (!isExpanded && onConfigChangeRef.current) {
      onConfigChangeRef.current(config);
    }
  }, [isExpanded]); // Only triggers when isExpanded changes

  // Also notify on mount so parent has initial values
  useEffect(() => {
    if (onConfigChangeRef.current) {
      onConfigChangeRef.current(config);
    }
  }, []); // Only on mount

  // Handle field changes (local state only - no parent notification)
  const handleChange = useCallback((field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  }, []);

  // Handle numeric input
  const handleNumericChange = useCallback((field, rawValue) => {
    if (rawValue === '' || rawValue === '.') {
      setConfig(prev => ({ ...prev, [field]: rawValue }));
      return;
    }
    const numValue = parseFloat(rawValue);
    if (!isNaN(numValue)) {
      setConfig(prev => ({ ...prev, [field]: numValue }));
    }
  }, []);

  // Handle destination change
  const handleDestinationChange = useCallback((dest) => {
    setConfig(prev => ({
      ...prev,
      destination: dest,
      mmBaseCost: PATTERN_RATES[dest].Standard
    }));
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
  }, []);

  // Toggle panel
  const togglePanel = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  return (
    <div className="cost-config-panel bg-[#1a1f2e] rounded-xl border border-gray-800 mb-6">

      {/* Header - Click to toggle */}
      <div
        onClick={togglePanel}
        className={`w-full px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-[#242936] transition-colors ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <div className="flex items-center gap-3">
          <Settings className="text-[#00A8FF]" size={20} />
          <div>
            <h4 className="text-white font-semibold">Cost Configuration</h4>
            <p className="text-gray-400 text-sm">
              {isExpanded ? 'Customize freight and middle mile costs' : 'Click to configure rates'}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="text-gray-400" size={20} />
        ) : (
          <ChevronDown className="text-gray-400" size={20} />
        )}
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-6 border-t border-gray-800">

          {/* Destination Selection */}
          <div className="pt-4">
            <div className="block text-sm font-semibold text-gray-300 mb-2">
              <MapPin size={14} className="inline mr-2" />
              Pattern Destination
            </div>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="ccpDest"
                  checked={config.destination === 'KY'}
                  onChange={() => handleDestinationChange('KY')}
                  disabled={disabled}
                  className="mr-2 accent-[#00A8FF]"
                />
                <span className="text-white">Hebron, KY (East)</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="ccpDest"
                  checked={config.destination === 'VEGAS'}
                  onChange={() => handleDestinationChange('VEGAS')}
                  disabled={disabled}
                  className="mr-2 accent-[#00A8FF]"
                />
                <span className="text-white">Las Vegas (West)</span>
              </label>
            </div>
          </div>

          {/* Rate Mode Selection */}
          <div>
            <div className="block text-sm font-semibold text-gray-300 mb-2">
              <Truck size={14} className="inline mr-2" />
              MM Rate Type
            </div>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="ccpMode"
                  checked={config.rateMode === 'FTL'}
                  onChange={() => handleChange('rateMode', 'FTL')}
                  disabled={disabled}
                  className="mr-2 accent-[#00A8FF]"
                />
                <span className="text-white">Full Truckload (FTL)</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="ccpMode"
                  checked={config.rateMode === 'PALLET'}
                  onChange={() => handleChange('rateMode', 'PALLET')}
                  disabled={disabled}
                  className="mr-2 accent-[#00A8FF]"
                />
                <span className="text-white">Pallet Rate</span>
              </label>
            </div>
          </div>

          {/* Freight Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                <DollarSign size={14} className="inline mr-2" />
                {config.rateMode === 'FTL' ? 'FTL Cost ($)' : 'Pallet Cost ($)'}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={config.rateMode === 'FTL' ? config.freightCost : config.palletCost}
                onChange={(e) => handleNumericChange(
                  config.rateMode === 'FTL' ? 'freightCost' : 'palletCost',
                  e.target.value
                )}
                disabled={disabled}
                className="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-[#00A8FF] focus:outline-none focus:ring-2 focus:ring-[#00A8FF]/20 disabled:opacity-50"
                placeholder={config.rateMode === 'FTL' ? '1315' : '150'}
              />
              <p className="text-xs text-gray-500 mt-1">Base freight cost from rate sheet</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Freight Markup
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={config.freightMarkup}
                  onChange={(e) => handleNumericChange('freightMarkup', e.target.value)}
                  disabled={disabled}
                  className="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-[#00A8FF] focus:outline-none focus:ring-2 focus:ring-[#00A8FF]/20 disabled:opacity-50"
                  placeholder="1.2"
                />
                <span className="text-gray-400 whitespace-nowrap">
                  ({typeof config.freightMarkup === 'number' ? ((config.freightMarkup - 1) * 100).toFixed(0) : '0'}%)
                </span>
              </div>
            </div>
          </div>

          {/* Middle Mile Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                MM Base Cost ($/cuft)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={config.mmBaseCost}
                onChange={(e) => handleNumericChange('mmBaseCost', e.target.value)}
                disabled={disabled}
                className="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-[#00A8FF] focus:outline-none focus:ring-2 focus:ring-[#00A8FF]/20 disabled:opacity-50"
                placeholder="2.625"
              />
              <p className="text-xs text-gray-500 mt-1">
                Pattern rate: {config.destination} Standard = ${PATTERN_RATES[config.destination].Standard}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                MM Markup
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={config.mmMarkup}
                  onChange={(e) => handleNumericChange('mmMarkup', e.target.value)}
                  disabled={disabled}
                  className="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-[#00A8FF] focus:outline-none focus:ring-2 focus:ring-[#00A8FF]/20 disabled:opacity-50"
                  placeholder="1.0"
                />
                <span className="text-gray-400 whitespace-nowrap">
                  ({typeof config.mmMarkup === 'number' ? ((config.mmMarkup - 1) * 100).toFixed(0) : '0'}%)
                </span>
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
            <h5 className="text-[#00A8FF] font-semibold mb-3 flex items-center gap-2">
              <Calculator size={16} />
              Calculated Values Preview
            </h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <p className="text-gray-400 pb-6">Total Freight Cost</p>
                <p className="text-white font-bold">${preview.totalFreightCost}</p>
              </div>
              <div>
                <p className="text-gray-400 pb-6">Internal Transfer/cuft</p>
                <p className="text-white font-bold">${preview.internalTransferRate}</p>
              </div>
              <div>
                <p className="text-gray-400 pb-6">MM Rate/cuft</p>
                <p className="text-white font-bold">${preview.mmRate}</p>
              </div>
              <div>
                <p className="text-gray-400 pb-6">MM Cost PT</p>
                <p className="text-white font-bold">${preview.mmCostPT}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={resetToDefaults}
              disabled={disabled}
              className="text-gray-400 hover:text-white text-sm"
            >
              Reset to Defaults
            </button>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Info size={12} />
              <span>Config saved when panel closes</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostConfigPanel;
