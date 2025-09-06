import { useState } from 'react';
import type { Model } from '../types';

interface BulkDeregisterModalProps {
  models: Model[];
  onClose: () => void;
  onSuccess: () => void;
}

interface BulkDeregistrationResult {
  successful: Array<{
    model_id: string;
    model_name: string;
    cleanup: {
      model_deleted: boolean;
      jobs_affected: number;
      cache_cleared: boolean;
    };
  }>;
  failed: Array<{
    model_id: string;
    model_name?: string;
    error: string;
  }>;
  skipped: Array<{
    model_id: string;
    model_name: string;
    reason: string;
  }>;
  total_requested: number;
  summary: {
    successful_count: number;
    failed_count: number;
    skipped_count: number;
    success_rate: string;
  };
}

const BulkDeregisterModal = ({ models, onClose, onSuccess }: BulkDeregisterModalProps) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkDeregistrationResult | null>(null);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [options, setOptions] = useState({
    force: false,
    inactive_only: true,
  });
  const [step, setStep] = useState<'select' | 'result'>('select');

  // Filter models based on options
  const availableModels = models.filter(model => 
    options.inactive_only ? !model.is_active : true
  );

  const handleSelectAll = () => {
    if (selectedModels.size === availableModels.length) {
      setSelectedModels(new Set());
    } else {
      setSelectedModels(new Set(availableModels.map(m => m.id)));
    }
  };

  const handleModelSelect = (modelId: string) => {
    const newSelected = new Set(selectedModels);
    if (newSelected.has(modelId)) {
      newSelected.delete(modelId);
    } else {
      newSelected.add(modelId);
    }
    setSelectedModels(newSelected);
  };

  const handleBulkDeregister = async () => {
    if (selectedModels.size === 0) return;

    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/models/deregister-bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_ids: Array.from(selectedModels),
          force: options.force,
          inactive_only: options.inactive_only,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
        setStep('result');
      } else {
        const errorData = await response.json();
        // Handle error - could create a simple error result
        setResult({
          successful: [],
          failed: [{ model_id: 'bulk', error: errorData.detail || 'Bulk operation failed' }],
          skipped: [],
          total_requested: selectedModels.size,
          summary: {
            successful_count: 0,
            failed_count: selectedModels.size,
            skipped_count: 0,
            success_rate: '0%',
          },
        });
        setStep('result');
      }
    } catch (error) {
      setResult({
        successful: [],
        failed: [{ model_id: 'bulk', error: error instanceof Error ? error.message : 'Network error' }],
        skipped: [],
        total_requested: selectedModels.size,
        summary: {
          successful_count: 0,
          failed_count: selectedModels.size,
          skipped_count: 0,
          success_rate: '0%',
        },
      });
      setStep('result');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (result && result.summary.successful_count > 0) {
      onSuccess();
    } else {
      onClose();
    }
  };

  const renderSelectStep = () => (
    <>
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <title>Bulk Deregister</title>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Bulk Deregister Models</h3>
          <p className="text-gray-400">Select models to remove from the system</p>
        </div>
      </div>

      {/* Options */}
      <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
        <h4 className="text-white font-medium mb-3">Options</h4>
        <div className="space-y-3">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={options.inactive_only}
              onChange={(e) => {
                setOptions(prev => ({ ...prev, inactive_only: e.target.checked }));
                setSelectedModels(new Set()); // Clear selection when filter changes
              }}
              className="w-4 h-4 bg-gray-700 border-gray-600 rounded text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
            />
            <span className="text-gray-300 text-sm">Only show inactive models</span>
          </label>
          
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={options.force}
              onChange={(e) => setOptions(prev => ({ ...prev, force: e.target.checked }))}
              className="w-4 h-4 bg-gray-700 border-gray-600 rounded text-red-600 focus:ring-red-500 focus:ring-offset-0"
            />
            <span className="text-gray-300 text-sm">Force deregistration (cancel active jobs)</span>
          </label>
        </div>
      </div>

      {/* Model Selection */}
      <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-medium">
            Select Models ({selectedModels.size}/{availableModels.length})
          </h4>
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            {selectedModels.size === availableModels.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-2">
          {availableModels.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">
              No models available with current filters
            </p>
          ) : (
            availableModels.map((model) => (
              <label key={model.id} className="flex items-center space-x-3 p-2 hover:bg-gray-700/50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedModels.has(model.id)}
                  onChange={() => handleModelSelect(model.id)}
                  className="w-4 h-4 bg-gray-700 border-gray-600 rounded text-red-600 focus:ring-red-500 focus:ring-offset-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-mono text-sm truncate">{model.name}</span>
                    <div className="flex items-center space-x-2 ml-2">
                      <span className="text-xs text-gray-400">{model.backend}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        model.is_active 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {model.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      {selectedModels.size > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <title>Warning</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="text-sm">
              <p className="text-amber-200 font-medium mb-1">Bulk Deregistration Warning</p>
              <p className="text-amber-100">
                This will permanently remove {selectedModels.size} model{selectedModels.size > 1 ? 's' : ''} from the system.
                {options.force && ' Any active jobs will be cancelled.'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleBulkDeregister}
          disabled={loading || selectedModels.size === 0}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {loading && (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <title>Loading</title>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          <span>
            {loading 
              ? 'Deregistering...' 
              : `Deregister ${selectedModels.size} Model${selectedModels.size > 1 ? 's' : ''}`
            }
          </span>
        </button>
      </div>
    </>
  );

  const renderResultStep = () => (
    <>
      <div className="flex items-center space-x-3 mb-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
          result && result.summary.successful_count > 0 
            ? 'bg-green-500/20' 
            : 'bg-red-500/20'
        }`}>
          {result && result.summary.successful_count > 0 ? (
            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <title>Success</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <title>Error</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Bulk Deregistration Results</h3>
          <p className="text-gray-400">
            {result?.summary.successful_count || 0} successful, {result?.summary.failed_count || 0} failed
          </p>
        </div>
      </div>

      {result && (
        <>
          {/* Summary */}
          <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
            <h4 className="text-white font-medium mb-3">Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-center p-3 bg-green-500/10 rounded">
                <div className="text-2xl font-bold text-green-400">{result.summary.successful_count}</div>
                <div className="text-green-200">Successful</div>
              </div>
              <div className="text-center p-3 bg-red-500/10 rounded">
                <div className="text-2xl font-bold text-red-400">{result.summary.failed_count}</div>
                <div className="text-red-200">Failed</div>
              </div>
            </div>
            {result.summary.skipped_count > 0 && (
              <div className="mt-2 text-center p-3 bg-yellow-500/10 rounded">
                <div className="text-xl font-bold text-yellow-400">{result.summary.skipped_count}</div>
                <div className="text-yellow-200 text-sm">Skipped</div>
              </div>
            )}
            <div className="text-center mt-3 text-gray-300">
              Success Rate: <span className="font-bold text-white">{result.summary.success_rate}</span>
            </div>
          </div>

          {/* Successful Models */}
          {result.successful.length > 0 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
              <h4 className="text-green-200 font-medium mb-3">Successfully Deregistered</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {result.successful.map((item, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-green-100 font-mono">{item.model_name}</span>
                    <span className="text-green-300 text-xs">
                      {item.cleanup.jobs_affected} jobs affected
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Failed Models */}
          {result.failed.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
              <h4 className="text-red-200 font-medium mb-3">Failed to Deregister</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {result.failed.map((item, index) => (
                  <div key={index} className="text-sm">
                    <div className="flex justify-between items-start">
                      <span className="text-red-100 font-mono">{item.model_name || item.model_id}</span>
                    </div>
                    <p className="text-red-300 text-xs mt-1">{item.error}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skipped Models */}
          {result.skipped.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
              <h4 className="text-yellow-200 font-medium mb-3">Skipped Models</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {result.skipped.map((item, index) => (
                  <div key={index} className="text-sm">
                    <div className="flex justify-between items-start">
                      <span className="text-yellow-100 font-mono">{item.model_name}</span>
                    </div>
                    <p className="text-yellow-300 text-xs mt-1">{item.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleClose}
          className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Done
        </button>
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {step === 'select' ? renderSelectStep() : renderResultStep()}
        </div>
      </div>
    </div>
  );
};

export default BulkDeregisterModal;
