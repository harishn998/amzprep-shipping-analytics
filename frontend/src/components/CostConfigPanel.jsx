// ============================================================================
// COST CONFIGURATION PANEL - FIXED DECIMAL INPUT
// Fixes:
// 1. Decimal input now works properly (keeps string while typing)
// 2. Converts to number only on blur (when user finishes typing)
// 3. Proper validation for MM rate calculation
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, DollarSign, Truck, MapPin, Calculator, Info, ChevronDown, ChevronUp } from 'lucide-react';

// Default values matching the pivot table analysis
const DEFAULT_CONFIG = {
  freightCost: 1315,
  freightMarkup: 1.2,
  mmBaseCost: 2.625,
  mmMarkup: 1.0,
  rateMode: 'FTL',
  destination: 'KY',
  palletCost: 150
};

// Pattern rates from Freight Rate sheet
const PATTERN_RATES = {
  KY: { Standard: 2.625, Oversize: 4.00, Hazmat: 6.00 },
  VEGAS: { Standard: 3.75, Oversize: 5.00, Hazmat: 7.00 }
};

export const CostConfigPanel = ({ onConfigChange, disabled = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  // ✅ NEW: Separate state for input fields (keeps raw string while typing)
  const [inputValues, setInputValues] = useState({
    freightCost: '1315',
    freightMarkup: '1.2',
    mmBaseCost: '2.625',
    mmMarkup: '1',
    palletCost: '150'
  });

  const [preview, setPreview] = useState({
    totalFreightCost: '1578.00',
    internalTransferRate: '0.9059',
    mmRate: '2.6250',
    mmCostPT: '218.08'
  });

  // Store callback in ref to avoid dependency issues
  const onConfigChangeRef = useRef(onConfigChange);
  onConfigChangeRef.current = onConfigChange;

  // ✅ Initialize input values from config
  useEffect(() => {
    setInputValues({
      freightCost: String(config.freightCost),
      freightMarkup: String(config.freightMarkup),
      mmBaseCost: String(config.mmBaseCost),
      mmMarkup: String(config.mmMarkup),
      palletCost: String(config.palletCost)
    });
  }, []);

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

    // MM Cost PT = (FTL/26 × 1 pallet) + (67 cuft × $2.50) for preview
    const MM_COST_PT_RATE = 2.50;
    const previewPallets = 1;
    const previewCuft = 67;
    const mmCostPTPerPallet = (fc / 26) * previewPallets + (previewCuft * MM_COST_PT_RATE);

    setPreview({
      totalFreightCost: totalFreightCost.toFixed(2),
      internalTransferRate: internalTransferRate.toFixed(4),
      mmRate: mmRate.toFixed(4),
      mmCostPT: mmCostPTPerPallet.toFixed(2)
    });

    // Debug log to verify values
    console.log('📊 Config Preview:', {
      freightCost: fc,
      freightMarkup: fm,
      mmBaseCost: mbc,
      mmMarkup: mm,
      mmRate: mmRate
    });
  }, [config]);

  // Notify parent when panel CLOSES
  useEffect(() => {
    if (!isExpanded && onConfigChangeRef.current) {
      // Ensure all values are proper numbers before sending to parent
      const cleanConfig = {
        ...config,
        freightCost: parseFloat(config.freightCost) || DEFAULT_CONFIG.freightCost,
        freightMarkup: parseFloat(config.freightMarkup) || DEFAULT_CONFIG.freightMarkup,
        mmBaseCost: parseFloat(config.mmBaseCost) || DEFAULT_CONFIG.mmBaseCost,
        mmMarkup: parseFloat(config.mmMarkup) || DEFAULT_CONFIG.mmMarkup,
        palletCost: parseFloat(config.palletCost) || DEFAULT_CONFIG.palletCost
      };
      console.log('📤 Sending config to parent:', cleanConfig);
      onConfigChangeRef.current(cleanConfig);
    }
  }, [isExpanded]);

  // Notify on mount
  useEffect(() => {
    if (onConfigChangeRef.current) {
      onConfigChangeRef.current(config);
    }
  }, []);

  // ✅ FIXED: Handle input change - keeps raw string while typing
  const handleInputChange = useCallback((field, rawValue) => {
    // Allow: empty, digits, single decimal point, and valid decimal patterns
    // This regex allows: "", "1", "1.", "1.2", "1.23", "1.234", etc.
    const isValidInput = /^-?\d*\.?\d*$/.test(rawValue);

    if (!isValidInput) {
      return; // Reject invalid characters
    }

    // Update the display value (string)
    setInputValues(prev => ({ ...prev, [field]: rawValue }));

    // Also update config with the numeric value (for preview calculation)
    // But keep it as string in config if it ends with decimal or is empty
    if (rawValue === '' || rawValue === '.' || rawValue.endsWith('.')) {
      setConfig(prev => ({ ...prev, [field]: rawValue }));
    } else {
      const numValue = parseFloat(rawValue);
      if (!isNaN(numValue)) {
        setConfig(prev => ({ ...prev, [field]: numValue }));
      }
    }
  }, []);

  // ✅ NEW: Handle blur - finalize the value as a number
  const handleInputBlur = useCallback((field) => {
    const rawValue = inputValues[field];
    let finalValue;

    // Parse the value
    const numValue = parseFloat(rawValue);

    if (isNaN(numValue) || rawValue === '' || rawValue === '.') {
      // Revert to default if invalid
      finalValue = DEFAULT_CONFIG[field];
    } else {
      finalValue = numValue;
    }

    // Update both states with the final numeric value
    setInputValues(prev => ({ ...prev, [field]: String(finalValue) }));
    setConfig(prev => ({ ...prev, [field]: finalValue }));

    console.log(`✅ Field ${field} finalized:`, finalValue);
  }, [inputValues]);

  // Handle generic field changes (non-numeric)
  const handleChange = useCallback((field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  }, []);

  // Handle destination change
  const handleDestinationChange = useCallback((dest) => {
    const newRate = PATTERN_RATES[dest].Standard;
    setConfig(prev => ({
      ...prev,
      destination: dest,
      mmBaseCost: newRate
    }));
    setInputValues(prev => ({
      ...prev,
      mmBaseCost: String(newRate)
    }));
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    setInputValues({
      freightCost: String(DEFAULT_CONFIG.freightCost),
      freightMarkup: String(DEFAULT_CONFIG.freightMarkup),
      mmBaseCost: String(DEFAULT_CONFIG.mmBaseCost),
      mmMarkup: String(DEFAULT_CONFIG.mmMarkup),
      palletCost: String(DEFAULT_CONFIG.palletCost)
    });
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
                value={config.rateMode === 'FTL' ? inputValues.freightCost : inputValues.palletCost}
                onChange={(e) => handleInputChange(
                  config.rateMode === 'FTL' ? 'freightCost' : 'palletCost',
                  e.target.value
                )}
                onBlur={() => handleInputBlur(config.rateMode === 'FTL' ? 'freightCost' : 'palletCost')}
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
                  value={inputValues.freightMarkup}
                  onChange={(e) => handleInputChange('freightMarkup', e.target.value)}
                  onBlur={() => handleInputBlur('freightMarkup')}
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
                value={inputValues.mmBaseCost}
                onChange={(e) => handleInputChange('mmBaseCost', e.target.value)}
                onBlur={() => handleInputBlur('mmBaseCost')}
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
                  value={inputValues.mmMarkup}
                  onChange={(e) => handleInputChange('mmMarkup', e.target.value)}
                  onBlur={() => handleInputBlur('mmMarkup')}
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
                <p className="text-gray-400 pb-2">Total Freight Cost</p>
                <p className="text-white font-bold text-lg">${preview.totalFreightCost}</p>
              </div>
              <div>
                <p className="text-gray-400 pb-2">Internal Transfer/cuft</p>
                <p className="text-white font-bold text-lg">${preview.internalTransferRate}</p>
              </div>
              <div>
                <p className="text-gray-400 pb-2">MM Rate/cuft</p>
                <p className="text-[#00A8FF] font-bold text-lg">${preview.mmRate}</p>
              </div>
              <div>
                <p className="text-gray-400 pb-2">MM Cost PT (per pallet)</p>
                <p className="text-white font-bold text-lg">${preview.mmCostPT}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={resetToDefaults}
              disabled={disabled}
              className="text-gray-400 hover:text-white text-sm transition-colors"
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
