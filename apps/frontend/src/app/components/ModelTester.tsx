import { useState } from 'react';
import VoiceRecorder from './VoiceRecorder';
import type { Model } from '../types';

interface ModelTesterProps {
  model: Model;
  onClose: () => void;
}

const ModelTester = ({ model, onClose }: ModelTesterProps) => {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobStatus, setJobStatus] = useState<'idle' | 'queued' | 'running' | 'completed' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);

  const isWhisperModel = model.backend === 'whisper' || 
                        model.supported_tasks.includes('speech_to_text') ||
                        model.name.toLowerCase().includes('whisper');

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
    if (!isWhisperModel && !prompt.trim()) return;
    if (isWhisperModel && !recordedAudio && !audioFile) return;

    setLoading(true);
    setJobStatus('queued');
    setError(null);
    setResult(null);

    try {
      let requestBody: FormData | string;
      const headers: Record<string, string> = {};

      if (isWhisperModel && (recordedAudio || audioFile)) {
        // For Whisper models, we need to upload the audio file
        const formData = new FormData();
        const audioFileToUpload = audioFile || new File([recordedAudio as Blob], 'recording.webm', { type: 'audio/webm' });
        formData.append('audio', audioFileToUpload);
        formData.append('task_type', 'speech_to_text');
        formData.append('parameters', JSON.stringify(model.config));

        // Use FormData for file upload with the audio-specific endpoint
        requestBody = formData;
        
        const response = await fetch(`http://localhost:8000/api/run/${model.name}/audio`, {
          method: 'POST',
          body: requestBody,
        });

        const data = await response.json();
        
        if (response.ok) {
          // Poll for job completion
          await pollJobResult(data.job_id);
        } else {
          setError(data.detail || 'Failed to run audio test');
        }
      } else {
        // For text models
        headers['Content-Type'] = 'application/json';
        requestBody = JSON.stringify({
          task_type: model.supported_tasks[0] || 'text_generation',
          prompt,
          parameters: model.config,
        });
        
        const response = await fetch(`http://localhost:8000/api/run/${model.name}`, {
          method: 'POST',
          headers,
          body: requestBody,
        });

        const data = await response.json();
        
        if (response.ok) {
          // Poll for job completion
          await pollJobResult(data.job_id);
        } else {
          setError(data.detail || 'Failed to run test');
        }
      }
    } catch (error) {
      setError('Network error occurred');
      console.error('Test error:', error);
    } finally {
      setLoading(false);
      if (jobStatus !== 'completed' && jobStatus !== 'failed') {
        setJobStatus('idle');
      }
    }
  };

  const handleRecordingComplete = (audioBlob: Blob, duration: number) => {
    setRecordedAudio(audioBlob);
    setRecordingDuration(duration);
    setAudioFile(null); // Clear file input if user recorded
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setRecordedAudio(null); // Clear recording if user uploaded file
      setRecordingDuration(0);
    }
  };

  const pollJobResult = async (jobId: string) => {
    const maxAttempts = 30; // 30 seconds timeout
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/jobs/${jobId}`);
        const job = await response.json();

        // Update job status
        if (job.status !== jobStatus) {
          setJobStatus(job.status);
        }

        if (job.status === 'completed') {
          if (job.result?.output) {
            // Handle Whisper transcription results
            if (isWhisperModel && job.result.output.transcriptions) {
              const transcriptions = job.result.output.transcriptions;
              if (transcriptions.length > 0) {
                setResult(transcriptions[0].transcription);
              } else {
                setResult('No transcription available');
              }
            } else {
              // Handle other model results
              setResult(typeof job.result.output === 'string' ? job.result.output : JSON.stringify(job.result.output, null, 2));
            }
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
      } catch {
        setError('Failed to get job result');
      }
    };

    poll();
  };

  const getCurrentPrompts = () => {
    const taskType = model.supported_tasks[0] || 'text_generation';
    return testPrompts[taskType as keyof typeof testPrompts] || testPrompts.text_generation;
  };

  // Job Status Skeleton Component
  const JobStatusSkeleton = () => {
    const getStatusInfo = () => {
      switch (jobStatus) {
        case 'queued':
          return {
            color: 'text-yellow-400',
            bgColor: 'bg-yellow-500/10 border-yellow-500/30',
            icon: '⏳',
            title: 'Job Queued',
            description: 'Your job is waiting in the queue...'
          };
        case 'running':
          return {
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/10 border-blue-500/30',
            icon: '⚡',
            title: 'Processing',
            description: isWhisperModel ? 'Transcribing audio...' : 'Generating response...'
          };
        default:
          return {
            color: 'text-gray-400',
            bgColor: 'bg-gray-500/10 border-gray-500/30',
            icon: '🔄',
            title: 'Processing',
            description: 'Processing your request...'
          };
      }
    };

    const statusInfo = getStatusInfo();

    return (
      <div className={`${statusInfo.bgColor} border rounded-lg p-6`}>
        <div className="flex items-center space-x-3 mb-4">
          <span className="text-2xl">{statusInfo.icon}</span>
          <div>
            <div className={`${statusInfo.color} font-medium`}>{statusInfo.title}</div>
            <div className="text-gray-500 text-sm">{statusInfo.description}</div>
          </div>
        </div>
        
        {/* Animated skeleton bars */}
        <div className="space-y-3">
          <div className="flex space-x-2">
            <div className="h-3 bg-gray-700 rounded-full animate-pulse w-3/4"></div>
            <div className="h-3 bg-gray-700 rounded-full animate-pulse w-1/4"></div>
          </div>
          <div className="flex space-x-2">
            <div className="h-3 bg-gray-700 rounded-full animate-pulse w-1/2"></div>
            <div className="h-3 bg-gray-700 rounded-full animate-pulse w-1/2"></div>
          </div>
          <div className="flex space-x-2">
            <div className="h-3 bg-gray-700 rounded-full animate-pulse w-5/6"></div>
            <div className="h-3 bg-gray-700 rounded-full animate-pulse w-1/6"></div>
          </div>
        </div>

        {/* Pulsing progress indicator */}
        <div className="mt-4 flex justify-center">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
          </div>
        </div>
      </div>
    );
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
          {/* Voice Recording for Whisper Models */}
          {isWhisperModel ? (
            <div className="space-y-6">
              {/* Voice Recording Section */}
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-4">Record Your Voice</h3>
                <div className="bg-gray-700/20 rounded-lg p-6">
                  <VoiceRecorder
                    onRecordingComplete={handleRecordingComplete}
                    maxDuration={60}
                    className="w-full"
                  />
                  {recordedAudio && (
                    <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <div className="text-green-400 text-sm">
                        ✅ Recording ready ({recordingDuration}s) - Click &quot;Run Test&quot; to transcribe
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* File Upload Alternative */}
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-2">Or Upload Audio File</h3>
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-6">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="audio-upload"
                  />
                  <label
                    htmlFor="audio-upload"
                    className="cursor-pointer flex flex-col items-center justify-center text-center"
                  >
                    <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <title>Upload Audio</title>
                      <path d="M7 16a4 4 0 0 1-.88-7.903A5 5 0 1 1 15.9 6L16 6a5 5 0 0 1 1 9.9M9 19l3 3m0 0 3-3m-3 3V10"/>
                    </svg>
                    <span className="text-gray-400">
                      {audioFile ? `Selected: ${audioFile.name}` : 'Click to upload audio file'}
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      Supports: MP3, WAV, M4A, OGG, FLAC
                    </span>
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Quick Test Prompts */}
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-3">Quick Test Prompts</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {getCurrentPrompts().map((testPrompt, promptIndex) => (
                    <button
                      key={`prompt-${testPrompt.slice(0, 20)}-${promptIndex}`}
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
            </>
          )}

          {/* Model Config */}
          <div className="bg-gray-700/20 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Model Configuration</h3>
            <pre className="text-xs text-gray-400 whitespace-pre-wrap">
              {JSON.stringify(model.config, null, 2)}
            </pre>
          </div>

          {/* Test Button */}
          <div className="flex items-center justify-between pt-4">
            <div className="text-xs text-gray-500">
              {isWhisperModel
                ? (recordedAudio || audioFile)
                  ? 'Audio ready for transcription'
                  : 'Record voice or upload audio file to test'
                : `${prompt.length}/1000 characters`
              }
            </div>
            <button
              type="button"
              onClick={handleTest}
              disabled={
                loading ||
                (isWhisperModel ? (!recordedAudio && !audioFile) : !prompt.trim())
              }
              className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-200 flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <title>Loading</title>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>{isWhisperModel ? 'Transcribe' : 'Run Test'}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <title>Run</title>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </div>

          {/* Results */}
          {(result || error || loading || jobStatus === 'queued' || jobStatus === 'running') && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-300">Test Result</h3>
              
              {/* Show skeleton while job is processing */}
              {(jobStatus === 'queued' || jobStatus === 'running') && !result && !error && (
                <JobStatusSkeleton />
              )}
              
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="text-red-400">❌ {error}</div>
                </div>
              )}

              {result && !loading && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="text-green-400 text-sm mb-2">
                    ✅ {isWhisperModel ? 'Transcription Complete' : 'Test Successful'}
                  </div>
                  <div className="bg-gray-800/50 rounded p-3">
                    {isWhisperModel ? (
                      <div className="space-y-2">
                        <div className="text-xs text-gray-400 mb-2">Transcribed Text:</div>
                        <div className="text-gray-300 text-sm leading-relaxed">
                          &ldquo;{result}&rdquo;
                        </div>
                      </div>
                    ) : (
                      <pre className="text-gray-300 whitespace-pre-wrap text-sm">
                        {result}
                      </pre>
                    )}
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
