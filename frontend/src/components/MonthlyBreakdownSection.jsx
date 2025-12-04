import React, { useState, useMemo } from 'react';
import { Calendar, TrendingUp, Package, DollarSign } from 'lucide-react';

const MonthlyBreakdownSection = ({ monthlyData, shipMethodData }) => {
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [showShipMethods, setShowShipMethods] = useState(true);

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
          <div className="relative">
            <select
              multiple
              className="bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2.5 text-sm min-w-[160px] max-w-[200px] max-h-[140px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              style={{ scrollbarWidth: 'thin' }}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                setSelectedMonths(selected);
              }}
            >
              {monthlyData.map(m => (
                <option key={m.month} value={m.month} className="py-2 px-2 hover:bg-gray-700">
                  {new Date(m.month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                </option>
              ))}
            </select>
          </div>
          {selectedMonths.length > 0 && (
            <button
              onClick={() => setSelectedMonths([])}
              className="text-sm px-4 py-2 rounded-md transition-colors font-medium"
              style={{ color: '#00a8ff' }}
              onMouseEnter={(e) => e.target.style.color = '#0088cc'}
              onMouseLeave={(e) => e.target.style.color = '#00a8ff'}
            >
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
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  AMZ Prep Cost
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-green-400 uppercase tracking-wider">
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
