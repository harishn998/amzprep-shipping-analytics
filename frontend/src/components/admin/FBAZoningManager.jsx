// ============================================================================
// FBA ZONING MANAGER - Admin Component for Managing FBA Zoning Configurations
// File: frontend/src/components/admin/FBAZoningManager.jsx
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Upload,
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileSpreadsheet,
  Calendar,
  User,
  ToggleRight,
  ToggleLeft
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const FBAZoningManager = ({ getAuthHeader }) => {
  const [configurations, setConfigurations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);

  // Upload form state
  const [uploadFile, setUploadFile] = useState(null);
  const [version, setVersion] = useState('');
  const [description, setDescription] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [makeActive, setMakeActive] = useState(false);

  /**
   * Fetch all FBA Zoning configurations
   */
  const fetchConfigurations = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/admin/fba-zoning/list`,
        { headers: getAuthHeader() }
      );

      if (response.data.success) {
        setConfigurations(response.data.configs);
      }
    } catch (err) {
      console.error('Error fetching configurations:', err);
      setError(err.response?.data?.error || 'Failed to load configurations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigurations();
  }, []);

  /**
   * Handle file upload
   */
  const handleUpload = async (e) => {
    e.preventDefault();

    if (!uploadFile) {
      setError('Please select a file');
      return;
    }

    if (!version) {
      setError('Please enter a version');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('version', version);
      formData.append('description', description);
      formData.append('effectiveDate', effectiveDate || new Date().toISOString());
      formData.append('makeActive', makeActive);

      const response = await axios.post(
        `${API_URL}/admin/fba-zoning/upload`,
        formData,
        {
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        setSuccess(response.data.message);

        // Reset form
        setUploadFile(null);
        setVersion('');
        setDescription('');
        setEffectiveDate('');
        setMakeActive(false);

        // Clear file input
        const fileInput = document.getElementById('fba-zoning-file');
        if (fileInput) fileInput.value = '';

        // Refresh list
        fetchConfigurations();
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Failed to upload FBA Zoning');
    } finally {
      setUploading(false);
    }
  };

  /**
   * Activate a configuration
   */
  const handleActivate = async (id, version) => {
    if (!confirm(`Activate FBA Zoning ${version}? This will deactivate the current version.`)) {
      return;
    }

    try {
      setError('');
      setSuccess('');

      const response = await axios.put(
        `${API_URL}/admin/fba-zoning/${id}/activate`,
        {},
        { headers: getAuthHeader() }
      );

      if (response.data.success) {
        setSuccess(response.data.message);
        fetchConfigurations();
      }
    } catch (err) {
      console.error('Activate error:', err);
      setError(err.response?.data?.error || 'Failed to activate configuration');
    }
  };

  /**
   * Delete a configuration
   */
  const handleDelete = async (id, version) => {
    if (!confirm(`Delete FBA Zoning ${version}? This action cannot be undone.`)) {
      return;
    }

    try {
      setError('');
      setSuccess('');

      const response = await axios.delete(
        `${API_URL}/admin/fba-zoning/${id}`,
        { headers: getAuthHeader() }
      );

      if (response.data.success) {
        setSuccess(response.data.message);
        fetchConfigurations();
      }
    } catch (err) {
      console.error('Delete error:', err);
      setError(err.response?.data?.error || 'Failed to delete configuration');
    }
  };

  /**
   * Download a configuration
   */
  const handleDownload = async (id, version) => {
    try {
      const response = await axios.get(
        `${API_URL}/admin/fba-zoning/${id}/download`,
        {
          headers: getAuthHeader(),
          responseType: 'blob'
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `FBA-Zoning-${version}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download configuration');
    }
  };

  /**
   * Download template
   */
  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/admin/fba-zoning/template/download`,
        {
          headers: getAuthHeader(),
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'FBA-Zoning-Template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Template download error:', err);
      setError('Failed to download template');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">FBA Zoning Management</h2>
          <p className="text-gray-400 text-sm mt-1">
            Manage FBA destination zoning configurations for shipment analysis
          </p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          <Download size={18} />
          Download Template
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-red-200">{error}</div>
        </div>
      )}

      {success && (
        <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="text-green-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-green-200">{success}</div>
        </div>
      )}

      {/* Upload Form */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Upload size={20} className="text-blue-400" />
          Upload New FBA Zoning Configuration
        </h3>

        <form onSubmit={handleUpload} className="space-y-4">
          {/* File Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Excel File (.xlsx, .xls)
            </label>
            <input
              id="fba-zoning-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setUploadFile(e.target.files[0])}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Required columns: Destination, Zone, State, Region
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Version */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Version *
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="e.g., v2.0, 2025-Q1"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            {/* Effective Date */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Effective Date
              </label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this configuration..."
              rows="2"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Make Active Checkbox */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="make-active"
              checked={makeActive}
              onChange={(e) => setMakeActive(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="make-active" className="text-sm text-gray-300">
              Make this the active configuration (will deactivate current version)
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={uploading}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Uploading...
              </>
            ) : (
              <>
                <Upload size={20} />
                Upload Configuration
              </>
            )}
          </button>
        </form>
      </div>

      {/* Configurations List */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileSpreadsheet size={20} className="text-blue-400" />
          Existing Configurations
        </h3>

        {loading ? (
          <div className="text-center py-8 text-gray-400">
            Loading configurations...
          </div>
        ) : configurations.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No configurations found. Upload your first FBA Zoning configuration above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Version</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Effective Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Rows</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Created By</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {configurations.map((config) => (
                  <tr key={config._id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    {/* Status */}
                    <td className="py-3 px-4">
                      {config.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-900/30 text-green-400 text-xs font-medium rounded">
                          <CheckCircle size={14} />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 text-gray-400 text-xs font-medium rounded">
                          <XCircle size={14} />
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Version */}
                    <td className="py-3 px-4">
                      <div className="text-white font-medium">{config.version}</div>
                      {config.description && (
                        <div className="text-xs text-gray-400 mt-1">{config.description}</div>
                      )}
                    </td>

                    {/* Effective Date */}
                    <td className="py-3 px-4 text-sm text-gray-300">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-gray-400" />
                        {new Date(config.effectiveDate).toLocaleDateString()}
                      </div>
                    </td>

                    {/* Row Count */}
                    <td className="py-3 px-4 text-sm text-gray-300">
                      {config.rowCount} destinations
                    </td>

                    {/* Created By */}
                    <td className="py-3 px-4 text-sm text-gray-300">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-gray-400" />
                        {config.createdBy?.name || 'Unknown'}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {/* Activate Button */}
                        {!config.isActive && (
                          <button
                            onClick={() => handleActivate(config._id, config.version)}
                            className="p-2 hover:bg-green-900/30 text-green-400 rounded-lg transition-colors"
                            title="Activate"
                          >
                            <ToggleRight size={18} />
                          </button>
                        )}

                        {/* Download Button */}
                        <button
                          onClick={() => handleDownload(config._id, config.version)}
                          className="p-2 hover:bg-blue-900/30 text-blue-400 rounded-lg transition-colors"
                          title="Download"
                        >
                          <Download size={18} />
                        </button>

                        {/* Delete Button */}
                        {!config.isActive && (
                          <button
                            onClick={() => handleDelete(config._id, config.version)}
                            className="p-2 hover:bg-red-900/30 text-red-400 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-blue-200">
            <p className="font-semibold mb-1">Important Notes:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-300">
              <li>Only one FBA Zoning configuration can be active at a time</li>
              <li>The active configuration is used for all separate tab uploads</li>
              <li>Active configurations cannot be deleted (deactivate first)</li>
              <li>Required columns: Destination, Zone, State, Region</li>
              <li>Changes take effect immediately for all users</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FBAZoningManager;
