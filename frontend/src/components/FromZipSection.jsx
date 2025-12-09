// ============================================================================
// FROM ZIP SECTION - Pivot Table Component (FIXED - Overflow Issue)
// File: frontend/src/components/FromZipSection.jsx
//
// FIX: Resolved horizontal overflow causing white space on the right
// - Reduced padding and font sizes for compact display
// - Added proper overflow-x-auto with contained scrolling
// - Removed redundant columns (combined Origin + State)
// - Currency formatting without decimals for compact display
// - Added whitespace-nowrap to prevent text wrapping
// ============================================================================

import React from 'react';
import { MapPin, Truck, Package } from 'lucide-react';

const FromZipSection = ({ fromZipData }) => {
  if (!fromZipData || fromZipData.length === 0) return null;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('en-US').format(Math.round(value || 0));
  };

  // Calculate grand totals
  const totals = fromZipData.reduce((acc, row) => ({
    shipmentCount: acc.shipmentCount + (row.shipmentCount || 0),
    fbaIdCount: acc.fbaIdCount + (row.fbaIdCount || row.shipmentCount || 0),
    transitTime: acc.transitTime + ((row.avgTransitTime || 0) * (row.shipmentCount || 0)),
    qty: acc.qty + (row.qty || 0),
    palletCount: acc.palletCount + (row.palletCount || 0),
    totalCuft: acc.totalCuft + (row.totalCuft || 0),
    clientPlacementFees: acc.clientPlacementFees + (row.clientPlacementFees || 0),
    clientCarrierCost: acc.clientCarrierCost + (row.clientCarrierCost || 0),
    clientTotalFees: acc.clientTotalFees + (row.clientTotalFees || 0),
    mmCost: acc.mmCost + (row.mmCost || 0),
    internalTransfer: acc.internalTransfer + (row.internalTransfer || 0),
    totalFreightCost: acc.totalFreightCost + (row.totalFreightCost || 0)
  }), {
    shipmentCount: 0,
    fbaIdCount: 0,
    transitTime: 0,
    qty: 0,
    palletCount: 0,
    totalCuft: 0,
    clientPlacementFees: 0,
    clientCarrierCost: 0,
    clientTotalFees: 0,
    mmCost: 0,
    internalTransfer: 0,
    totalFreightCost: 0
  });

  // Calculate average transit time for totals
  const avgTransitTimeTotal = totals.shipmentCount > 0
    ? Math.round(totals.transitTime / totals.shipmentCount)
    : 0;

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg mt-6 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-900/50 border-b border-gray-700">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: '#00a8ff' }} />
              From Zip Distribution
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Shipment origin breakdown by warehouse location
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Truck className="w-3 h-3" />
            <span>{fromZipData.length} origin{fromZipData.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Table Container - Scrollable horizontally if needed */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: '850px' }}>
          <thead className="bg-gray-900/30">
            <tr>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                Origin
              </th>
              <th className="px-2 py-2.5 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                #
              </th>
              <th className="px-2 py-2.5 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                %
              </th>
              <th className="px-2 py-2.5 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                Days
              </th>
              <th className="px-2 py-2.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                Units
              </th>
              <th className="px-2 py-2.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                Cuft
              </th>
              <th className="px-2 py-2.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                Placement
              </th>
              <th className="px-2 py-2.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                Carrier
              </th>
              <th className="px-2 py-2.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                Client
              </th>
              <th className="px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#00a8ff' }}>
                MM
              </th>
              <th className="px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#00a8ff' }}>
                Internal
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#10b981' }}>
                Freight
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {fromZipData.map((row, idx) => (
              <tr
                key={row.fromZip || idx}
                className="hover:bg-gray-800/40 transition-colors"
              >
                <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                    <span>{row.fromZip || '?'}</span>
                    <span className="text-gray-500 text-[10px]">({row.state || '-'})</span>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-gray-300 text-center">
                  {row.shipmentCount}
                </td>
                <td className="px-2 py-2.5 text-center">
                  <span
                    className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
                    style={{
                      backgroundColor: 'rgba(0, 168, 255, 0.15)',
                      color: '#00a8ff'
                    }}
                  >
                    {row.shipmentDistribution}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-gray-300 text-center">
                  {row.avgTransitTime}
                </td>
                <td className="px-2 py-2.5 text-gray-300 text-right tabular-nums">
                  {formatNumber(row.qty)}
                </td>
                <td className="px-2 py-2.5 text-gray-300 text-right tabular-nums">
                  {Math.round(row.totalCuft || 0).toLocaleString()}
                </td>
                <td className="px-2 py-2.5 text-gray-300 text-right tabular-nums whitespace-nowrap">
                  {formatCurrency(row.clientPlacementFees)}
                </td>
                <td className="px-2 py-2.5 text-gray-300 text-right tabular-nums whitespace-nowrap">
                  {formatCurrency(row.clientCarrierCost)}
                </td>
                <td className="px-2 py-2.5 text-white font-semibold text-right tabular-nums whitespace-nowrap">
                  {formatCurrency(row.clientTotalFees)}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums whitespace-nowrap" style={{ color: '#00a8ff' }}>
                  {formatCurrency(row.mmCost)}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums whitespace-nowrap" style={{ color: '#00a8ff' }}>
                  {formatCurrency(row.internalTransfer)}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap" style={{ color: '#10b981' }}>
                  {formatCurrency(row.totalFreightCost)}
                </td>
              </tr>
            ))}

            {/* Grand Total Row */}
            <tr className="bg-gray-900/80 font-bold border-t-2" style={{ borderColor: '#00a8ff' }}>
              <td className="px-3 py-3 text-white whitespace-nowrap">
                Grand Total
              </td>
              <td className="px-2 py-3 text-white text-center">
                {totals.shipmentCount}
              </td>
              <td className="px-2 py-3 text-white text-center">
                100%
              </td>
              <td className="px-2 py-3 text-white text-center">
                {avgTransitTimeTotal}
              </td>
              <td className="px-2 py-3 text-white text-right tabular-nums">
                {formatNumber(totals.qty)}
              </td>
              <td className="px-2 py-3 text-white text-right tabular-nums">
                {Math.round(totals.totalCuft).toLocaleString()}
              </td>
              <td className="px-2 py-3 text-white text-right tabular-nums whitespace-nowrap">
                {formatCurrency(totals.clientPlacementFees)}
              </td>
              <td className="px-2 py-3 text-white text-right tabular-nums whitespace-nowrap">
                {formatCurrency(totals.clientCarrierCost)}
              </td>
              <td className="px-2 py-3 text-white font-bold text-right tabular-nums whitespace-nowrap">
                {formatCurrency(totals.clientTotalFees)}
              </td>
              <td className="px-2 py-3 text-right tabular-nums whitespace-nowrap" style={{ color: '#00a8ff' }}>
                {formatCurrency(totals.mmCost)}
              </td>
              <td className="px-2 py-3 text-right tabular-nums whitespace-nowrap" style={{ color: '#00a8ff' }}>
                {formatCurrency(totals.internalTransfer)}
              </td>
              <td className="px-3 py-3 text-right font-bold tabular-nums whitespace-nowrap" style={{ color: '#10b981' }}>
                {formatCurrency(totals.totalFreightCost)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary Stats - Only show if there are multiple origins */}
      {fromZipData.length > 1 && (
        <div className="px-4 py-3 bg-gray-900/30 border-t border-gray-700">
          <div className="flex flex-wrap gap-4 text-xs">
            <div>
              <span className="text-gray-400">Primary:</span>
              <span className="text-white font-medium ml-1">
                {fromZipData[0]?.fromZip} ({fromZipData[0]?.shipmentDistribution})
              </span>
            </div>
            <div>
              <span className="text-gray-400">Origins:</span>
              <span className="text-white font-medium ml-1">
                {fromZipData.length}
              </span>
            </div>
            <div>
              <span className="text-gray-400">$/Cuft:</span>
              <span className="font-medium ml-1" style={{ color: '#00a8ff' }}>
                ${totals.totalCuft > 0 ? (totals.clientTotalFees / totals.totalCuft).toFixed(2) : '0.00'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FromZipSection;
