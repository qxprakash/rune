import { useState } from 'react';

interface AddModelModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const AddModelModal = ({ onClose, onSuccess }: AddModelModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    backend: 'ollama',
    description: '',
    supported_tasks: ['text_generation'],
    config: '{\n  "temperature": 0.7,\n  "max_tokens": 512\n}',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backends = [
    { value: 'ollama', label: 'Ollama', description: 'Local Ollama server' },
    { value: 'mlx', label: 'MLX', description: 'Apple Silicon optimized' },
    { value: 'pytorch', label: 'PyTorch', description: 'Hugging Face transformers' },
    { value: 'whisper', label: 'Whisper', description: 'Speech recognition' },
  ];

  const taskTypes = [
    'text_generation',
    'speech_to_text',
    'text_to_speech',
    'image_generation',
    'image_to_text',
    'embeddings',
  ];

  const getDefaultConfig = (backend: string) => {
    const configs = {
      ollama: {
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
      },
      mlx: {
        temperature: 0.7,
        max_tokens: 512,
        top_p: 0.9,
        model_path: 'mlx-community/model-name',
      },
      pytorch: {
        temperature: 0.7,
        max_new_tokens: 512,
        do_sample: true,
        top_p: 0.9,
        device: 'auto',
      },
      whisper: {
        language: null,
        task: 'transcribe',
        return_timestamps: false,
      },
    };
    return JSON.stringify(configs[backend as keyof typeof configs] || {}, null, 2);
  };

  const handleBackendChange = (backend: string) => {
    setFormData(prev => ({
      ...prev,
      backend,
      config: getDefaultConfig(backend),
      supported_tasks: backend === 'whisper' ? ['speech_to_text'] : ['text_generation'],
    }));
  };

  const handleTaskToggle = (task: string) => {
    setFormData(prev => ({
      ...prev,
      supported_tasks: prev.supported_tasks.includes(task)
        ? prev.supported_tasks.filter(t => t !== task)
        : [...prev.supported_tasks, task],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let parsedConfig = {};
      try {
        parsedConfig = JSON.parse(formData.config);
      } catch {
        throw new Error('Invalid JSON in configuration');
      }

      const response = await fetch('http://localhost:8000/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          backend: formData.backend,
          description: formData.description || undefined,
          supported_tasks: formData.supported_tasks,
          config: parsedConfig,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        setError(data.detail || 'Failed to create model');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">➕ Add New Model</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <title>Close</title>
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Model Name */}
          <div>
            <label htmlFor="model-name" className="block text-sm font-medium text-gray-300 mb-2">
              Model Name *
            </label>
            <input
              id="model-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="e.g., llama3.2:3b, whisper-base"
              required
            />
          </div>

          {/* Backend */}
          <div>
            <label htmlFor="backend" className="block text-sm font-medium text-gray-300 mb-2">
              Backend *
            </label>
            <select
              id="backend"
              value={formData.backend}
              onChange={(e) => handleBackendChange(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              {backends.map((backend) => (
                <option key={backend.value} value={backend.value}>
                  {backend.label} - {backend.description}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
              placeholder="Optional description of the model"
            />
          </div>

          {/* Supported Tasks */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Supported Tasks *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {taskTypes.map((task) => (
                <label key={task} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.supported_tasks.includes(task)}
                    onChange={() => handleTaskToggle(task)}
                    className="rounded border-gray-600 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 bg-gray-700"
                  />
                  <span className="text-sm text-gray-300">{task.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Configuration */}
          <div>
            <label htmlFor="config" className="block text-sm font-medium text-gray-300 mb-2">
              Configuration (JSON) *
            </label>
            <textarea
              id="config"
              value={formData.config}
              onChange={(e) => setFormData(prev => ({ ...prev, config: e.target.value }))}
              rows={8}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder='{"temperature": 0.7}'
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Model-specific parameters in JSON format
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="text-red-400 text-sm">{error}</div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-400 border border-gray-600 rounded-lg hover:text-white hover:border-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.name || !formData.supported_tasks.length || loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Creating...' : 'Create Model'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddModelModal;
