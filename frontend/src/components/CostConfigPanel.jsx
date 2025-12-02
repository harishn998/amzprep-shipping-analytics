// ============================================================================
// COST CONFIGURATION PANEL - FULLY WORKING VERSION
//
// Key Fixes:
// 1. Receives initialConfig from parent to survive remounts
// 2. Parent controls expanded state
// 3. Local changes don't trigger parent re-render until Apply
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, DollarSign, Truck, MapPin, Calculator, Info, ChevronDown, ChevronUp, Check } from 'lucide-react';

// Default values (fallback only)
const DEFAULT_CONFIG = {
  freightCost: 1315,
  freightMarkup: 1.2,
  mmBaseCost: 2.625,
  mmMarkup: 1.0,
  rateMode: 'FTL',
  destination: 'KY',
  palletCost: 150,
  analysisYear: new Date().getFullYear(),
  analysisStartMonth: 1,
  analysisEndMonth: 12,
  shipFromFilter: []
};

// Pattern rates
const PATTERN_RATES = {
  KY: { Standard: 2.625, Oversize: 4.00, Hazmat: 6.00 },
  VEGAS: { Standard: 3.75, Oversize: 5.00, Hazmat: 7.00 }
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const CostConfigPanel = ({
  onConfigChange,
  disabled = false,
  expanded: controlledExpanded,
  onExpandedChange,
  // 🆕 NEW: Receive current config from parent to initialize from
  initialConfig
}) => {
  // Use internal state if not controlled by parent
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  // 🆕 Initialize from parent's config if provided, otherwise use defaults
  const getInitialConfig = () => {
    if (initialConfig) {
      return { ...DEFAULT_CONFIG, ...initialConfig };
    }
    return DEFAULT_CONFIG;
  };

  const getInitialInputValues = () => {
    const cfg = initialConfig || DEFAULT_CONFIG;
    return {
      freightCost: String(cfg.freightCost || DEFAULT_CONFIG.freightCost),
      freightMarkup: String(cfg.freightMarkup || DEFAULT_CONFIG.freightMarkup),
      mmBaseCost: String(cfg.mmBaseCost || DEFAULT_CONFIG.mmBaseCost),
      mmMarkup: String(cfg.mmMarkup || DEFAULT_CONFIG.mmMarkup),
      palletCost: String(cfg.palletCost || DEFAULT_CONFIG.palletCost)
    };
  };

  const [config, setConfig] = useState(getInitialConfig);
  const [inputValues, setInputValues] = useState(getInitialInputValues);
  const [preview, setPreview] = useState({
    totalFreightCost: '1578.00',
    internalTransferRate: '0.9059',
    mmRate: '2.6250',
    mmCostPT: '218.08'
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Refs
  const onConfigChangeRef = useRef(onConfigChange);

  // Update callback ref
  useEffect(() => {
    onConfigChangeRef.current = onConfigChange;
  }, [onConfigChange]);

  // Calculate preview values (local only)
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
    const mmCostPTPerPallet = (fc / 26) + (67 * 2.50);

    setPreview({
      totalFreightCost: totalFreightCost.toFixed(2),
      internalTransferRate: internalTransferRate.toFixed(4),
      mmRate: mmRate.toFixed(4),
      mmCostPT: mmCostPTPerPallet.toFixed(2)
    });
  }, [config]);

  // Helper to send config to parent
  const sendConfigToParent = useCallback(() => {
    if (onConfigChangeRef.current) {
      const cleanConfig = {
        ...config,
        freightCost: typeof config.freightCost === 'number' ? config.freightCost : parseFloat(config.freightCost) || DEFAULT_CONFIG.freightCost,
        freightMarkup: typeof config.freightMarkup === 'number' ? config.freightMarkup : parseFloat(config.freightMarkup) || DEFAULT_CONFIG.freightMarkup,
        mmBaseCost: typeof config.mmBaseCost === 'number' ? config.mmBaseCost : parseFloat(config.mmBaseCost) || DEFAULT_CONFIG.mmBaseCost,
        mmMarkup: typeof config.mmMarkup === 'number' ? config.mmMarkup : parseFloat(config.mmMarkup) || DEFAULT_CONFIG.mmMarkup,
        palletCost: typeof config.palletCost === 'number' ? config.palletCost : parseFloat(config.palletCost) || DEFAULT_CONFIG.palletCost
      };
      console.log('📤 Config applied:', cleanConfig);
      onConfigChangeRef.current(cleanConfig);
      setHasChanges(false);
    }
  }, [config]);

  // Handle input change (local only)
  const handleInputChange = useCallback((field, rawValue) => {
    const isValidInput = /^-?\d*\.?\d*$/.test(rawValue);
    if (!isValidInput) return;

    setInputValues(prev => ({ ...prev, [field]: rawValue }));
    setHasChanges(true);

    if (rawValue !== '' && rawValue !== '.' && !rawValue.endsWith('.')) {
      const numValue = parseFloat(rawValue);
      if (!isNaN(numValue)) {
        setConfig(prev => ({ ...prev, [field]: numValue }));
      }
    }
  }, []);

  // Handle blur
  const handleInputBlur = useCallback((field) => {
    const rawValue = inputValues[field];
    const numValue = parseFloat(rawValue);
    const finalValue = isNaN(numValue) || rawValue === '' || rawValue === '.'
      ? DEFAULT_CONFIG[field]
      : numValue;

    setInputValues(prev => ({ ...prev, [field]: String(finalValue) }));
    setConfig(prev => ({ ...prev, [field]: finalValue }));
  }, [inputValues]);

  // Handle select/radio changes (local only)
  const handleChange = useCallback((field, value) => {
    console.log(`📝 Local change: ${field} = ${value}`);
    setConfig(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  // Handle destination change
  const handleDestinationChange = useCallback((dest) => {
    const newRate = PATTERN_RATES[dest].Standard;
    setConfig(prev => ({ ...prev, destination: dest, mmBaseCost: newRate }));
    setInputValues(prev => ({ ...prev, mmBaseCost: String(newRate) }));
    setHasChanges(true);
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
    setHasChanges(true);
  }, []);

  // Apply changes
  const applyChanges = useCallback(() => {
    sendConfigToParent();
  }, [sendConfigToParent]);

  // Toggle panel
  const togglePanel = useCallback(() => {
    const newExpanded = !isExpanded;

    // If closing with unsaved changes, apply them
    if (isExpanded && hasChanges) {
      sendConfigToParent();
    }

    // Update expanded state
    if (isControlled && onExpandedChange) {
      onExpandedChange(newExpanded);
    } else {
      setInternalExpanded(newExpanded);
    }
  }, [isExpanded, hasChanges, sendConfigToParent, isControlled, onExpandedChange]);

  return (
    <div className="cost-config-panel bg-[#1a1f2e] rounded-xl border border-gray-800 mb-6">
      {/* Header */}
      <div className={`w-full px-6 py-4 flex items-center justify-between ${disabled ? 'opacity-50' : ''}`}>
        <div className="flex items-center gap-3">
          <Settings className="text-[#00A8FF]" size={20} />
          <div>
            <h4 className="text-white font-semibold">Cost Configuration</h4>
            <p className="text-gray-400 text-sm">
              {isExpanded
                ? 'Customize freight and middle mile costs'
                : `${config.rateMode} | ${config.destination} | ${MONTH_NAMES[config.analysisStartMonth - 1]}-${MONTH_NAMES[config.analysisEndMonth - 1]} ${config.analysisYear}`
              }
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={togglePanel}
          disabled={disabled}
          className="p-2 rounded-lg hover:bg-[#242936] transition-colors disabled:opacity-50"
        >
          {isExpanded ? <ChevronUp className="text-gray-400" size={20} /> : <ChevronDown className="text-gray-400" size={20} />}
        </button>
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
                className="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-[#00A8FF] focus:outline-none focus:ring-2 focus:ring-[#00A8FF]/20"
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
                  className="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-[#00A8FF] focus:outline-none focus:ring-2 focus:ring-[#00A8FF]/20"
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
                className="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-[#00A8FF] focus:outline-none focus:ring-2 focus:ring-[#00A8FF]/20"
              />
              <p className="text-xs text-gray-500 mt-1">
                Pattern rate: {config.destination} = ${PATTERN_RATES[config.destination].Standard}
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
                  className="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-[#00A8FF] focus:outline-none focus:ring-2 focus:ring-[#00A8FF]/20"
                />
                <span className="text-gray-400 whitespace-nowrap">
                  ({typeof config.mmMarkup === 'number' ? ((config.mmMarkup - 1) * 100).toFixed(0) : '0'}%)
                </span>
              </div>
            </div>
          </div>

          {/* Analysis Period */}
          <div className="bg-[#0a0e14] rounded-lg p-4 border border-gray-700">
            <div className="text-sm font-semibold text-gray-300 mb-3">
              Analysis Period
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">From Month</label>
                <select
                  value={config.analysisStartMonth}
                  onChange={(e) => handleChange('analysisStartMonth', parseInt(e.target.value, 10))}
                  disabled={disabled}
                  className="w-full bg-[#1a1f2e] border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-[#00A8FF] focus:outline-none"
                >
                  {MONTH_NAMES.map((month, i) => (
                    <option key={i + 1} value={i + 1}>{month}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">To Month</label>
                <select
                  value={config.analysisEndMonth}
                  onChange={(e) => handleChange('analysisEndMonth', parseInt(e.target.value, 10))}
                  disabled={disabled}
                  className="w-full bg-[#1a1f2e] border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-[#00A8FF] focus:outline-none"
                >
                  {MONTH_NAMES.map((month, i) => (
                    <option key={i + 1} value={i + 1}>{month}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Year</label>
                <select
                  value={config.analysisYear}
                  onChange={(e) => handleChange('analysisYear', parseInt(e.target.value, 10))}
                  disabled={disabled}
                  className="w-full bg-[#1a1f2e] border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-[#00A8FF] focus:outline-none"
                >
                  {[2023, 2024, 2025, 2026].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-3">
              Selected: {MONTH_NAMES[config.analysisStartMonth - 1]} - {MONTH_NAMES[config.analysisEndMonth - 1]} {config.analysisYear}
            </p>
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
                <p className="text-gray-400 pb-2">MM Cost PT</p>
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

            <div className="flex items-center gap-3">
              {hasChanges && (
                <span className="text-xs text-yellow-500">Unsaved changes</span>
              )}
              <button
                type="button"
                onClick={applyChanges}
                disabled={disabled || !hasChanges}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  hasChanges
                    ? 'bg-[#00A8FF] text-white hover:bg-[#0090dd]'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Check size={16} />
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostConfigPanel;
