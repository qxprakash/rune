import { useState } from 'react';
import type { Model } from '../types';

interface DeregisterModelModalProps {
  model: Model;
  onClose: () => void;
  onSuccess: () => void;
}

interface DeregistrationResult {
  success: boolean;
  message?: string;
  error?: string;
  conflict?: {
    error: string;
    details: {
      running_jobs: number;
      queued_jobs: number;
      total_associated_jobs: number;
      job_counts: Record<string, number>;
      suggestion: string;
    };
    model_name: string;
  };
  deregistration_details?: {
    model_deleted: boolean;
    jobs_affected: number;
    job_counts: Record<string, number>;
    cache_cleared: boolean;
  };
}

const DeregisterModelModal = ({ model, onClose, onSuccess }: DeregisterModelModalProps) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DeregistrationResult | null>(null);
  const [step, setStep] = useState<'confirm' | 'result'>('confirm');
  const [forceDeregistration, setForceDeregistration] = useState(false);

  const handleDeregister = async (force: boolean = false) => {
    setLoading(true);
    try {
      const url = `http://localhost:8000/api/models/${model.id}/deregister${force ? '?force=true' : ''}`;
      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        setResult({
          success: true,
          message: data.message,
          deregistration_details: data.deregistration_details,
        });
        setStep('result');
      } else if (response.status === 409) {
        // Conflict - model has active jobs
        const errorData = await response.json();
        setResult({
          success: false,
          conflict: errorData.detail,
        });
        setStep('result');
      } else {
        const errorData = await response.json();
        setResult({
          success: false,
          error: errorData.detail || 'Failed to deregister model',
        });
        setStep('result');
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      });
      setStep('result');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (result?.success) {
      onSuccess();
    } else {
      onClose();
    }
  };

  const renderConfirmStep = () => (
    <>
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Deregister Model</h3>
          <p className="text-gray-400">This action cannot be undone</p>
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
        <h4 className="text-white font-medium mb-2">Model Details</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Name:</span>
            <span className="text-white font-mono">{model.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Backend:</span>
            <span className="text-white">{model.backend}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Status:</span>
            <span className={`font-medium ${model.is_active ? 'text-green-400' : 'text-gray-400'}`}>
              {model.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
        <div className="flex items-start space-x-3">
          <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div className="text-sm">
            <p className="text-amber-200 font-medium mb-1">Warning</p>
            <p className="text-amber-100">
              Deregistering this model will permanently remove it from the system. 
              Any running or queued jobs using this model may be affected.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-3 mb-6">
        <input
          type="checkbox"
          id="force"
          checked={forceDeregistration}
          onChange={(e) => setForceDeregistration(e.target.checked)}
          className="w-4 h-4 bg-gray-700 border-gray-600 rounded text-red-600 focus:ring-red-500 focus:ring-offset-0"
        />
        <label htmlFor="force" className="text-sm text-gray-300">
          Force deregistration (cancel any active jobs)
        </label>
      </div>

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
          onClick={() => handleDeregister(forceDeregistration)}
          disabled={loading}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {loading && (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          <span>{loading ? 'Deregistering...' : 'Deregister Model'}</span>
        </button>
      </div>
    </>
  );

  const renderResultStep = () => (
    <>
      <div className="flex items-center space-x-3 mb-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
          result?.success ? 'bg-green-500/20' : 'bg-red-500/20'
        }`}>
          {result?.success ? (
            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">
            {result?.success ? 'Deregistration Successful' : 'Deregistration Failed'}
          </h3>
          <p className="text-gray-400">
            {result?.success ? 'Model has been removed from the system' : 'Unable to deregister model'}
          </p>
        </div>
      </div>

      {result?.success && result.deregistration_details && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
          <h4 className="text-green-200 font-medium mb-3">Cleanup Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">Model Deleted:</span>
              <span className={`font-medium ${result.deregistration_details.model_deleted ? 'text-green-400' : 'text-red-400'}`}>
                {result.deregistration_details.model_deleted ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Jobs Affected:</span>
              <span className="text-white">{result.deregistration_details.jobs_affected}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Cache Cleared:</span>
              <span className={`font-medium ${result.deregistration_details.cache_cleared ? 'text-green-400' : 'text-yellow-400'}`}>
                {result.deregistration_details.cache_cleared ? 'Yes' : 'Partial'}
              </span>
            </div>
            {Object.keys(result.deregistration_details.job_counts).length > 0 && (
              <div className="pt-2 border-t border-green-500/20">
                <span className="text-gray-300 block mb-1">Job Status Counts:</span>
                {Object.entries(result.deregistration_details.job_counts).map(([status, count]) => (
                  <div key={status} className="flex justify-between text-xs">
                    <span className="text-gray-400 capitalize">{status}:</span>
                    <span className="text-white">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {result?.conflict && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
          <h4 className="text-amber-200 font-medium mb-3">Active Jobs Found</h4>
          <p className="text-amber-100 text-sm mb-3">{result.conflict.error}</p>
          
          <div className="space-y-2 text-sm mb-4">
            <div className="flex justify-between">
              <span className="text-gray-300">Running Jobs:</span>
              <span className="text-white font-medium">{result.conflict.details.running_jobs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Queued Jobs:</span>
              <span className="text-white font-medium">{result.conflict.details.queued_jobs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Total Associated:</span>
              <span className="text-white font-medium">{result.conflict.details.total_associated_jobs}</span>
            </div>
          </div>

          <div className="bg-amber-500/20 rounded p-3 mb-4">
            <p className="text-amber-100 text-xs">
              <strong>Suggestion:</strong> {result.conflict.details.suggestion}
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleDeregister(true)}
            disabled={loading}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            <span>{loading ? 'Force Deregistering...' : 'Force Deregister Anyway'}</span>
          </button>
        </div>
      )}

      {result?.error && !result.conflict && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
          <h4 className="text-red-200 font-medium mb-2">Error Details</h4>
          <p className="text-red-100 text-sm">{result.error}</p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleClose}
          className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          {result?.success ? 'Done' : 'Close'}
        </button>
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {step === 'confirm' ? renderConfirmStep() : renderResultStep()}
        </div>
      </div>
    </div>
  );
};

export default DeregisterModelModal;
