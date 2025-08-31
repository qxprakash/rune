import { useState, useRef, useCallback } from 'react';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  maxDuration?: number; // in seconds
  className?: string;
}

const VoiceRecorder = ({ 
  onRecordingComplete, 
  onRecordingStart,
  onRecordingStop,
  maxDuration = 60,
  className = ""
}: VoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      onRecordingStop?.();
    }
  }, [isRecording, onRecordingStop]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      streamRef.current = stream;
      chunksRef.current = [];
      
      // Set up audio visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      // Start audio level monitoring
      const updateAudioLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average);
          animationRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };
      updateAudioLevel();
      
      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { 
          type: mediaRecorder.mimeType || 'audio/webm' 
        });
        onRecordingComplete(audioBlob, duration);
        cleanup();
      };
      
      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setDuration(0);
      onRecordingStart?.();
      
      // Start duration timer
      intervalRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration >= maxDuration) {
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      console.error('Error starting recording:', err);
    }
  }, [maxDuration, onRecordingComplete, onRecordingStart, cleanup, duration, stopRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getAudioLevelColor = () => {
    if (audioLevel > 150) return 'bg-red-500';
    if (audioLevel > 100) return 'bg-yellow-500';
    if (audioLevel > 50) return 'bg-green-500';
    return 'bg-gray-500';
  };

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      {error && (
        <div className="w-full p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
      
      {/* Recording Controls */}
      <div className="flex items-center space-x-4">
        {/* Start/Recording Indicator */}
        <div className="relative">
          <button
            type="button"
            onClick={isRecording ? undefined : startRecording}
            disabled={!!error || isRecording}
            className={`w-20 h-20 rounded-full border-4 transition-all duration-200 flex items-center justify-center ${
              isRecording 
                ? 'border-red-500 bg-red-500/20 shadow-lg shadow-red-500/30 cursor-default' 
                : 'border-cyan-500 bg-cyan-500/20 hover:bg-cyan-500/30 shadow-lg shadow-cyan-500/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isRecording ? (
              <div className="w-6 h-6 bg-red-500 rounded-full animate-pulse" />
            ) : (
              <svg className="w-8 h-8 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                <title>Record</title>
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
              </svg>
            )}
          </button>
          
          {/* Audio Level Ring */}
          {isRecording && (
            <div 
              className={`absolute inset-0 rounded-full border-4 ${getAudioLevelColor()} animate-pulse`}
              style={{ 
                transform: `scale(${1 + (audioLevel / 500)})`,
                opacity: audioLevel / 255 
              }}
            />
          )}
        </div>

        {/* Stop Button - Only visible during recording */}
        {isRecording && (
          <button
            type="button"
            onClick={stopRecording}
            className="w-16 h-16 rounded-full bg-gray-700 hover:bg-gray-600 border-2 border-gray-500 transition-all duration-200 flex items-center justify-center shadow-lg"
          >
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <title>Stop Recording</title>
              <path d="M6 6h12v12H6z"/>
            </svg>
          </button>
        )}
      </div>
      
      {/* Status Display */}
      <div className="text-center">
        {isRecording ? (
          <div className="space-y-2">
            <div className="text-red-400 font-medium">🔴 Recording in progress</div>
            <div className="text-lg font-mono text-white">
              {formatDuration(duration)}
            </div>
            <div className="text-xs text-gray-400">
              Max: {formatDuration(maxDuration)}
            </div>
            <div className="text-xs text-yellow-400">
              Click the stop button (⏹) to finish recording
            </div>
            
            {/* Audio Level Bar */}
            <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-100 ${getAudioLevelColor()}`}
                style={{ width: `${Math.min(audioLevel / 2, 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="text-gray-400">
            <div className="font-medium mb-1">
              {error ? 'Recording unavailable' : 'Click the microphone to start recording'}
            </div>
            <div className="text-xs">
              Speak clearly into your microphone
            </div>
          </div>
        )}
      </div>
      
      {/* Instructions */}
      {!isRecording && !error && (
        <div className="text-xs text-gray-500 text-center max-w-xs space-y-1">
          <div>Make sure your microphone is connected and permissions are granted.</div>
          <div>Recording will automatically stop after {maxDuration} seconds.</div>
          <div className="pt-1 border-t border-gray-700">
            <strong>Shortcuts:</strong> Space to toggle • Esc to stop
          </div>
        </div>
      )}

      {/* Recording shortcuts reminder */}
      {isRecording && (
        <div className="text-xs text-gray-500 text-center">
          Press <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-300">Esc</kbd> or click stop button to end recording
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
