import { useState } from 'react';
import type { Model } from '../types';
import FileUpload from './FileUpload';

interface JobRunnerProps {
  onJobCreate?: (jobId: string) => void;
}

const JobRunner = ({ onJobCreate }: JobRunnerProps) => {
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [prompt, setPrompt] = useState('');
  const [taskType, setTaskType] = useState('text_generation');
  const [parameters, setParameters] = useState('{}');
  const [inputFiles, setInputFiles] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [showModal, setShowModal] = useState(false);

  const fetchModels = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/models');
      const data = await response.json();
      setModels(data.models?.filter((model: Model) => model.is_active) || []);
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  const handleOpenModal = () => {
    setShowModal(true);
    fetchModels();
  };

  const handleRunJob = async () => {
    if (!selectedModel || !prompt.trim()) return;

    setLoading(true);
    try {
      let parsedParams = {};
      try {
        parsedParams = JSON.parse(parameters);
      } catch {
        parsedParams = {};
      }

      const response = await fetch(`http://localhost:8000/api/run/${selectedModel.name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_type: taskType,
          prompt,
          input_files: inputFiles,
          parameters: parsedParams,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        onJobCreate?.(data.job_id);
        // Reset form
        setPrompt('');
        setParameters('{}');
        setInputFiles([]);
        setShowModal(false);
        alert('Job created successfully!');
      } else {
        alert(`Error: ${data.detail || 'Failed to create job'}`);
      }
    } catch (error) {
      console.error('Failed to run job:', error);
      alert('Failed to create job. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const taskTypes = [
    { value: 'text_generation', label: 'Text Generation' },
    { value: 'speech_to_text', label: 'Speech to Text' },
    { value: 'text_to_speech', label: 'Text to Speech' },
    { value: 'image_generation', label: 'Image Generation' },
    { value: 'image_to_text', label: 'Image to Text' },
    { value: 'embeddings', label: 'Embeddings' },
  ];

  const getDefaultParams = (backend: string) => {
    const defaults = {
      ollama: { temperature: 0.7, top_p: 0.9, top_k: 40 },
      mlx: { temperature: 0.7, max_tokens: 512, top_p: 0.9 },
      pytorch: { temperature: 0.7, max_new_tokens: 512, do_sample: true },
      whisper: { language: null, task: 'transcribe' },
    };
    return JSON.stringify(defaults[backend as keyof typeof defaults] || {}, null, 2);
  };

  if (!showModal) {
    return (
      <button
        type="button"
        onClick={handleOpenModal}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
      >
        🚀 Run Job
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">🚀 Run AI Job</h2>
            <button
              type="button"
              onClick={() => setShowModal(false)}
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

        <div className="p-6 space-y-6">
          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Model
            </label>
            <select
              value={selectedModel?.id || ''}
              onChange={(e) => {
                const model = models.find(m => m.id === e.target.value);
                setSelectedModel(model || null);
                if (model) {
                  setParameters(getDefaultParams(model.backend));
                }
              }}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="">Choose a model...</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.backend})
                </option>
              ))}
            </select>
          </div>

          {/* Task Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Task Type
            </label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              {taskTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Prompt / Input Text
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
              placeholder="Enter your prompt here..."
            />
          </div>

          {/* Input Files */}
          {(taskType === 'speech_to_text' || taskType === 'image_to_text') && (
            <div className="space-y-4">
              <FileUpload
                title="Input Files"
                accept={taskType === 'speech_to_text' ? 'audio/*,.mp3,.wav,.m4a,.ogg' : 'image/*,.jpg,.jpeg,.png,.webp'}
                maxSize={taskType === 'speech_to_text' ? 100 : 10}
                supportedTypes={taskType === 'speech_to_text' ? ['mp3', 'wav', 'm4a', 'ogg'] : ['jpg', 'jpeg', 'png', 'webp']}
                onFileSelect={(file) => {
                  setUploadedFiles(prev => [...prev, file]);
                  setInputFiles(prev => [...prev, file.name]);
                }}
              />
              
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-300">Selected Files:</div>
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-700/50 p-3 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="text-cyan-400">📁</div>
                        <div>
                          <div className="text-sm text-white">{file.name}</div>
                          <div className="text-xs text-gray-500">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadedFiles(prev => prev.filter((_, i) => i !== index));
                          setInputFiles(prev => prev.filter((_, i) => i !== index));
                        }}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Parameters */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Parameters (JSON)
            </label>
            <textarea
              value={parameters}
              onChange={(e) => setParameters(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder='{"temperature": 0.7, "max_tokens": 512}'
            />
            <p className="text-xs text-gray-500 mt-1">
              Model-specific parameters in JSON format
            </p>
          </div>

          {/* Model Info */}
          {selectedModel && (
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Model Information</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Backend:</span>
                  <span className="text-white">{selectedModel.backend}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Supported Tasks:</span>
                  <span className="text-white">{selectedModel.supported_tasks.join(', ')}</span>
                </div>
                {selectedModel.description && (
                  <div className="mt-2">
                    <span className="text-gray-400">Description:</span>
                    <p className="text-white text-xs mt-1">{selectedModel.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 px-4 py-2 text-gray-400 border border-gray-600 rounded-lg hover:text-white hover:border-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRunJob}
              disabled={!selectedModel || !prompt.trim() || loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Creating Job...' : 'Run Job'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobRunner;
