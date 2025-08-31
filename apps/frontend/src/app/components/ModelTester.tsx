import { useState } from 'react';
import type { Model } from '../types';

interface ModelTesterProps {
  model: Model;
  onClose: () => void;
}

const ModelTester = ({ model, onClose }: ModelTesterProps) => {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testPrompts = {
    text_generation: [
      "Hello! Please introduce yourself.",
      "Write a short story about a robot learning to paint.",
      "Explain quantum computing in simple terms.",
      "What are the benefits of renewable energy?",
    ],
    speech_to_text: [
      "Upload an audio file to test transcription",
    ],
    embeddings: [
      "The quick brown fox jumps over the lazy dog",
      "Machine learning is transforming technology",
    ]
  };

  const handleTest = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`http://localhost:8000/api/run/${model.name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_type: model.supported_tasks[0] || 'text_generation',
          prompt,
          parameters: model.config,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Poll for job completion
        await pollJobResult(data.job_id);
      } else {
        setError(data.detail || 'Failed to run test');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const pollJobResult = async (jobId: string) => {
    const maxAttempts = 30; // 30 seconds timeout
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/jobs/${jobId}`);
        const job = await response.json();

        if (job.status === 'completed') {
          if (job.result?.output) {
            setResult(job.result.output);
          } else {
            setResult(JSON.stringify(job.result, null, 2));
          }
        } else if (job.status === 'failed') {
          setError(job.error_message || 'Job failed');
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 1000); // Poll every second
        } else {
          setError('Test timed out');
        }
      } catch (err) {
        setError('Failed to get job result');
      }
    };

    poll();
  };

  const getCurrentPrompts = () => {
    const taskType = model.supported_tasks[0] || 'text_generation';
    return testPrompts[taskType as keyof typeof testPrompts] || testPrompts.text_generation;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">🧪 Test Model</h2>
              <p className="text-gray-400 text-sm mt-1">
                {model.name} ({model.backend})
              </p>
            </div>
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

        <div className="p-6 space-y-6">
          {/* Quick Test Prompts */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Quick Test Prompts</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {getCurrentPrompts().map((testPrompt, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setPrompt(testPrompt)}
                  className="text-left p-3 bg-gray-700/30 hover:bg-gray-700/50 rounded-lg text-sm text-gray-300 transition-colors"
                >
                  {testPrompt}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Prompt */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-2">Custom Prompt</h3>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
              placeholder="Enter your test prompt..."
            />
          </div>

          {/* Model Config */}
          <div className="bg-gray-700/20 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Model Configuration</h3>
            <pre className="text-xs text-gray-400 whitespace-pre-wrap">
              {JSON.stringify(model.config, null, 2)}
            </pre>
          </div>

          {/* Test Button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleTest}
              disabled={!prompt.trim() || loading}
              className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
                  <span>Running Test...</span>
                </div>
              ) : (
                'Run Test'
              )}
            </button>
          </div>

          {/* Results */}
          {(result || error) && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-300">Test Result</h3>
              
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="text-red-400">❌ {error}</div>
                </div>
              )}

              {result && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="text-green-400 text-sm mb-2">✅ Test Successful</div>
                  <div className="bg-gray-800/50 rounded p-3">
                    <pre className="text-gray-300 whitespace-pre-wrap text-sm">
                      {result}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <div>
              Task Types: {model.supported_tasks.join(', ')}
            </div>
            <div>
              Status: {model.is_active ? '🟢 Active' : '🔴 Inactive'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelTester;
