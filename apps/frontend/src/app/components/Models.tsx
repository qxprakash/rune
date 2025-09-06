import { useState, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import type { Model } from '../types';
import ModelTester from './ModelTester';
import AddModelModal from './AddModelModal';
import DeregisterModelModal from './DeregisterModelModal';
import BulkDeregisterModal from './BulkDeregisterModal';

const Models = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [discoverModels, setDiscoverModels] = useState<Record<string, string[]>>({});
  const [discovering, setDiscovering] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTester, setShowTester] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [showDeregister, setShowDeregister] = useState(false);
  const [showBulkDeregister, setShowBulkDeregister] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());

  const fetchModels = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/api/models');
      const data = await response.json();
      setModels(data.models || []);
    } catch (error) {
      console.error('Failed to fetch models:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleDiscoverModels = async () => {
    setDiscovering(true);
    try {
      const response = await fetch('http://localhost:8000/api/models/discover');
      const data = await response.json();
      setDiscoverModels(data);
    } catch (error) {
      console.error('Failed to discover models:', error);
    } finally {
      setDiscovering(false);
    }
  };

  const registerDiscoveredModel = async (backend: string, modelName: string) => {
    try {
      const response = await fetch('http://localhost:8000/api/models/register-discovered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backend, model_names: [modelName] })
      });
      
      if (response.ok) {
        await fetchModels(); // Refresh the list
        // Remove from discovered list
        setDiscoverModels(prev => ({
          ...prev,
          [backend]: prev[backend].filter(name => name !== modelName)
        }));
      }
    } catch (error) {
      console.error('Failed to register model:', error);
    }
  };

  const getBackendColor = (backend: string) => {
    const colors = {
      ollama: 'bg-green-500/20 text-green-400 border-green-500/30',
      mlx: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      pytorch: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      whisper: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      gguf: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    };
    return colors[backend as keyof typeof colors] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  const handleSelectAll = () => {
    if (selectedModels.size === models.length) {
      setSelectedModels(new Set());
    } else {
      setSelectedModels(new Set(models.map(m => m.id)));
    }
  };

  const handleDeregisterModel = (model: Model) => {
    setSelectedModel(model);
    setShowDeregister(true);
  };

  const handleCloseModals = () => {
    setShowDeregister(false);
    setShowBulkDeregister(false);
    setBulkSelectMode(false);
    setSelectedModels(new Set());
    setSelectedModel(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-400">Loading models...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Models</h1>
          <p className="text-gray-400">Manage your AI model registry</p>
        </div>
        <div className="flex space-x-3">
          {models.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setBulkSelectMode(!bulkSelectMode)}
                className={`px-4 py-2 border rounded-lg transition-colors ${
                  bulkSelectMode
                    ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                    : 'bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30'
                }`}
              >
                {bulkSelectMode ? 'Exit Bulk Mode' : 'Bulk Operations'}
              </button>
              {bulkSelectMode && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-4 py-2 bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded-lg hover:bg-gray-500/30 transition-colors"
                >
                  {selectedModels.size === models.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
              {bulkSelectMode && selectedModels.size > 0 && (
                <button
                  type="button"
                  onClick={() => setShowBulkDeregister(true)}
                  className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  Deregister Selected ({selectedModels.size})
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={handleDiscoverModels}
            disabled={discovering}
            className="px-4 py-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
          >
            {discovering ? 'Discovering...' : 'Discover Models'}
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Model
          </button>
        </div>
      </div>

      {/* Discovered Models Section */}
      {Object.keys(discoverModels).length > 0 && (
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Discovered Models</h2>
          <div className="space-y-4">
            {Object.entries(discoverModels).map(([backend, modelList]) => (
              modelList.length > 0 && (
                <div key={backend} className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wide">
                    {backend}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {modelList.map((modelName) => (
                      <div key={modelName} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                        <span className="text-sm text-white font-mono">{modelName}</span>
                        <button
                          type="button"
                          onClick={() => registerDiscoveredModel(backend, modelName)}
                          className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                        >
                          Register
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* Models Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {models.map((model) => (
          <div key={model.id} className="bg-gray-800/30 border border-gray-700 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center flex-1">
                {bulkSelectMode && (
                  <input
                    type="checkbox"
                    checked={selectedModels.has(model.id)}
                    onChange={() => handleModelSelect(model.id)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3"
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">{model.name}</h3>
                  <span className={`inline-block px-2 py-1 text-xs rounded-full border ${getBackendColor(model.backend)}`}>
                    {model.backend}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  model.is_active ? 'bg-green-400' : 'bg-gray-500'
                } status-pulse`} />
                {!bulkSelectMode && (
                  <button
                    type="button"
                    onClick={() => handleDeregisterModel(model)}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Deregister model"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {model.description && (
              <p className="text-gray-400 text-sm mb-4">{model.description}</p>
            )}

            <div className="space-y-2 mb-4">
              <div className="text-xs text-gray-500">
                <span className="font-medium">Tasks:</span> {model.supported_tasks.join(', ')}
              </div>
              <div className="text-xs text-gray-500">
                <span className="font-medium">Created:</span> {formatDate(model.created_at)}
              </div>
            </div>

            {/* Configuration Preview */}
            {Object.keys(model.config).length > 0 && (
              <div className="bg-gray-700/30 rounded p-3 mb-4">
                <div className="text-xs font-medium text-gray-400 mb-2">Configuration</div>
                <div className="space-y-1">
                  {Object.entries(model.config).slice(0, 3).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-gray-500">{key}:</span>
                      <span className="text-gray-300 font-mono">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                  {Object.keys(model.config).length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{Object.keys(model.config).length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedModel(model);
                  setShowTester(true);
                }}
                className="flex-1 px-3 py-2 text-sm bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-500/30 transition-colors"
              >
                Test Model
              </button>
              <button
                type="button"
                className="px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Edit
              </button>
            </div>
          </div>
        ))}

        {/* Add New Model Card */}
        <button
          type="button" 
          className="bg-gray-800/20 border-2 border-dashed border-gray-600 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:border-gray-500 transition-colors"
          onClick={() => console.log('Add model modal would open here')}
        >
          <svg className="w-12 h-12 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <title>Add Model</title>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          <h3 className="text-lg font-medium text-gray-400 mb-2">Add New Model</h3>
          <p className="text-sm text-gray-500">Register a new AI model for inference</p>
        </button>
      </div>

      {models.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <title>No Models</title>
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-400 mb-2">No models registered</h3>
          <p className="text-gray-500 mb-6">Get started by discovering available models or adding one manually</p>
          <button
            type="button"
            onClick={handleDiscoverModels}
            className="px-6 py-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/30 transition-colors"
          >
            Discover Models
          </button>
        </div>
      )}

      {/* Model Tester Modal */}
      {showTester && selectedModel && (
        <ModelTester 
          model={selectedModel}
          onClose={() => {
            setShowTester(false);
            setSelectedModel(null);
          }}
        />
      )}

      {/* Add Model Modal */}
      {showAddModal && (
        <AddModelModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchModels();
          }}
        />
      )}

      {/* Deregister Model Modal */}
      {showDeregister && selectedModel && (
        <DeregisterModelModal
          model={selectedModel}
          onClose={handleCloseModals}
          onSuccess={() => {
            handleCloseModals();
            fetchModels();
          }}
        />
      )}

      {/* Bulk Deregister Modal */}
      {showBulkDeregister && (
        <BulkDeregisterModal
          models={models}
          onClose={handleCloseModals}
          onSuccess={() => {
            handleCloseModals();
            fetchModels();
          }}
        />
      )}
    </div>
  );
};

export default Models;
