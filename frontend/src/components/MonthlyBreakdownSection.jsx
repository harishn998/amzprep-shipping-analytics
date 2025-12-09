import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Calendar, TrendingUp, Package, DollarSign, ChevronDown, X } from 'lucide-react';
import FromZipSection from './FromZipSection';

// 🆕 FIXED: Added fromZipData to props
const MonthlyBreakdownSection = ({ monthlyData, shipMethodData, fromZipData }) => {
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [showShipMethods, setShowShipMethods] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter data based on selected months
  const filteredMonthlyData = useMemo(() => {
    if (selectedMonths.length === 0) return monthlyData;
    return monthlyData.filter(m => selectedMonths.includes(m.month));
  }, [monthlyData, selectedMonths]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredMonthlyData.reduce((acc, month) => ({
      shipments: acc.shipments + month.shipmentCount,
      qty: acc.qty + month.qty,
      cuft: acc.cuft + month.totalCuft,
      pallets: acc.pallets + month.palletCount,
      clientTotal: acc.clientTotal + month.clientTotalFees,
      amzPrepTotal: acc.amzPrepTotal + month.totalFreightCost,
      savings: acc.savings + month.savings
    }), {
      shipments: 0,
      qty: 0,
      cuft: 0,
      pallets: 0,
      clientTotal: 0,
      amzPrepTotal: 0,
      savings: 0
    });
  }, [filteredMonthlyData]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('en-US').format(Math.round(value));
  };

  const handleMonthToggle = (month) => {
    setSelectedMonths(prev =>
      prev.includes(month)
        ? prev.filter(m => m !== month)
        : [...prev, month]
    );
  };

  const handleClearSelection = () => {
    setSelectedMonths([]);
  };

  return (
    <div className="space-y-6">
      {/* Header with Month Filter */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6" style={{ color: '#00a8ff' }} />
          <h2 className="text-2xl font-bold text-white">Monthly Shipment Breakdown</h2>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-400 whitespace-nowrap">Filter by month:</label>

          {/* Custom Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2 text-sm min-w-[160px] flex items-center justify-between hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              <span className="text-gray-300">
                {selectedMonths.length === 0
                  ? 'All months'
                  : `${selectedMonths.length} selected`}
              </span>
              <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-[200px] bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-[280px] overflow-y-auto">
                <div className="py-1">
                  {monthlyData.map(m => {
                    const monthLabel = new Date(m.month + '-01').toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short'
                    });

                    return (
                      <label
                        key={m.month}
                        className="flex items-center px-4 py-2 hover:bg-gray-700 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMonths.includes(m.month)}
                          onChange={() => handleMonthToggle(m.month)}
                          className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 bg-gray-700 cursor-pointer"
                        />
                        <span className="ml-3 text-sm text-white">{monthLabel}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Clear Button */}
          {selectedMonths.length > 0 && (
            <button
              onClick={handleClearSelection}
              className="flex items-center gap-1 text-sm px-3 py-2 rounded-md transition-colors font-medium"
              style={{ color: '#00a8ff' }}
              onMouseEnter={(e) => e.target.style.color = '#0088cc'}
              onMouseLeave={(e) => e.target.style.color = '#00a8ff'}
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900/50 border-b border-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Month
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Shipments
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Distribution
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Units
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Pallets
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Cuft
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Current Cost
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: '#00a8ff' }}>
                  AMZ Prep Cost
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: '#10b981' }}>
                  Savings
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredMonthlyData.map((month, idx) => (
                <tr key={month.month} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-6 py-4 text-sm text-white font-medium whitespace-nowrap">
                    {new Date(month.month + '-01').toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short'
                    })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 text-right">
                    {month.shipmentCount}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 text-right">
                    {month.shipmentDistribution}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 text-right">
                    {formatNumber(month.qty)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 text-right">
                    {month.palletCount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 text-right">
                    {month.totalCuft.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 text-right">
                    {formatCurrency(month.clientTotalFees)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right" style={{ color: '#00a8ff' }}>
                    {formatCurrency(month.totalFreightCost)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-semibold" style={{ color: month.savings >= 0 ? '#10b981' : '#ef4444' }}>
                    {formatCurrency(month.savings)}
                  </td>
                </tr>
              ))}

              {/* Totals Row */}
              <tr className="bg-gray-900/70 font-bold border-t-2" style={{ borderColor: '#00a8ff' }}>
                <td className="px-6 py-4 text-sm text-white">Grand Total</td>
                <td className="px-6 py-4 text-sm text-white text-right">{totals.shipments}</td>
                <td className="px-6 py-4 text-sm text-white text-right">100%</td>
                <td className="px-6 py-4 text-sm text-white text-right">{formatNumber(totals.qty)}</td>
                <td className="px-6 py-4 text-sm text-white text-right">{totals.pallets.toFixed(2)}</td>
                <td className="px-6 py-4 text-sm text-white text-right">{totals.cuft.toFixed(2)}</td>
                <td className="px-6 py-4 text-sm text-white text-right">{formatCurrency(totals.clientTotal)}</td>
                <td className="px-6 py-4 text-sm text-right" style={{ color: '#00a8ff' }}>{formatCurrency(totals.amzPrepTotal)}</td>
                <td className="px-6 py-4 text-sm text-right font-semibold" style={{ color: totals.savings >= 0 ? '#10b981' : '#ef4444' }}>
                  {formatCurrency(totals.savings)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Ship Method Breakdown */}
      {showShipMethods && shipMethodData && (
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg">
          <div className="px-6 py-4 bg-gray-900/50 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Package className="w-5 h-5" style={{ color: '#00a8ff' }} />
              Shipping Method Distribution
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900/30">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Method</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase">Shipments</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase">Distribution</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase">Avg Transit</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase">Current Cost</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase">AMZ Prep Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {shipMethodData.map(method => (
                  <tr key={method.method} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-6 py-4 text-sm text-white font-medium">{method.method}</td>
                    <td className="px-6 py-4 text-sm text-gray-300 text-right">{method.shipmentCount}</td>
                    <td className="px-6 py-4 text-sm text-gray-300 text-right">{method.shipmentDistribution}</td>
                    <td className="px-6 py-4 text-sm text-gray-300 text-right">{method.avgTransitTime} days</td>
                    <td className="px-6 py-4 text-sm text-gray-300 text-right">{formatCurrency(method.clientTotalFees)}</td>
                    <td className="px-6 py-4 text-sm text-right" style={{ color: '#00a8ff' }}>{formatCurrency(method.totalFreightCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🆕 FROM ZIP DISTRIBUTION SECTION */}
      {fromZipData && fromZipData.length > 0 && (
        <FromZipSection fromZipData={fromZipData} />
      )}

      {/* Quick Stats Cards - Conditional Colors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Avg Monthly Savings Card */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-400 mb-2 font-medium">Avg Monthly Savings</p>
              <p
                className="text-3xl font-bold mb-1"
                style={{ color: (totals.savings / filteredMonthlyData.length) >= 0 ? '#10b981' : '#ef4444' }}
              >
                {formatCurrency(totals.savings / filteredMonthlyData.length)}
              </p>
              <p className="text-xs text-gray-500">Per month average</p>
            </div>
            <div className="ml-4">
              <DollarSign
                className="w-12 h-12 opacity-30"
                style={{ color: (totals.savings / filteredMonthlyData.length) >= 0 ? '#10b981' : '#ef4444' }}
              />
            </div>
          </div>
        </div>

        {/* Total Cost Reduction Card */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-400 mb-2 font-medium">Total Cost Reduction</p>
              <p
                className="text-3xl font-bold mb-1"
                style={{ color: totals.savings >= 0 ? '#10b981' : '#ef4444' }}
              >
                {((totals.savings / totals.clientTotal) * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">Overall savings rate</p>
            </div>
            <div className="ml-4">
              <TrendingUp
                className="w-12 h-12 opacity-30"
                style={{ color: totals.savings >= 0 ? '#10b981' : '#ef4444' }}
              />
            </div>
          </div>
        </div>

        {/* Avg Cost per Cuft Card */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-400 mb-2 font-medium">Avg Cost per Cuft</p>
              <p className="text-3xl font-bold mb-1 text-brand-blue">
                {formatCurrency(totals.amzPrepTotal / totals.cuft)}
              </p>
              <p className="text-xs text-gray-500">AMZ Prep efficiency</p>
            </div>
            <div className="ml-4">
              <Package className="w-12 h-12 opacity-30 text-brand-blue" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyBreakdownSection;
