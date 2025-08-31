import { useState, useRef, useCallback } from 'react';

interface FileUploadProps {
  accept: string;
  maxSize: number; // in MB
  onFileSelect: (file: File) => void;
  supportedTypes: string[];
  title: string;
}

const FileUpload = ({ accept, maxSize, onFileSelect, supportedTypes, title }: FileUploadProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): boolean => {
    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      setErrorMessage(`File size must be less than ${maxSize}MB`);
      setUploadStatus('error');
      return false;
    }

    // Check file type
    const isValidType = supportedTypes.some(type => 
      file.type.includes(type) || file.name.toLowerCase().endsWith(type)
    );
    
    if (!isValidType) {
      setErrorMessage(`Supported formats: ${supportedTypes.join(', ')}`);
      setUploadStatus('error');
      return false;
    }

    return true;
  }, [maxSize, supportedTypes]);

  const handleFile = useCallback((file: File) => {
    if (validateFile(file)) {
      setUploadStatus('success');
      setErrorMessage('');
      onFileSelect(file);
    }
  }, [validateFile, onFileSelect]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files?.[0]) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.[0]) {
      handleFile(files[0]);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const getStatusIcon = () => {
    switch (uploadStatus) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'uploading':
        return '⟳';
      default:
        return '↑';
    }
  };

  const getStatusColor = () => {
    switch (uploadStatus) {
      case 'success':
        return 'border-green-500/50 bg-green-500/10';
      case 'error':
        return 'border-red-500/50 bg-red-500/10';
      default:
        return dragActive ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-gray-600 bg-gray-800/30';
    }
  };

  return (
    <div className="w-full">
      <label htmlFor="file-upload" className="text-sm font-medium text-gray-300 mb-2 block">
        {title}
      </label>
      
      <button
        type="button"
        className={`w-full relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${getStatusColor()}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          id="file-upload"
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileInput}
          className="hidden"
        />
        
        <div className="flex flex-col items-center space-y-2">
          <div className={`text-2xl ${
            uploadStatus === 'success' ? 'text-green-400' :
            uploadStatus === 'error' ? 'text-red-400' :
            dragActive ? 'text-cyan-400' : 'text-gray-400'
          }`}>
            {getStatusIcon()}
          </div>
          
          <div>
            <p className={`text-sm font-medium ${
              uploadStatus === 'success' ? 'text-green-400' :
              uploadStatus === 'error' ? 'text-red-400' :
              'text-gray-300'
            }`}>
              {uploadStatus === 'success' ? 'File selected successfully!' :
               uploadStatus === 'error' ? 'Upload failed' :
               dragActive ? 'Drop file here' : 'Click to upload or drag and drop'}
            </p>
            
            {uploadStatus === 'idle' && (
              <p className="text-xs text-gray-500 mt-1">
                Supported: {supportedTypes.join(', ')} (max {maxSize}MB)
              </p>
            )}
            
            {uploadStatus === 'error' && errorMessage && (
              <p className="text-xs text-red-400 mt-1">{errorMessage}</p>
            )}
          </div>
        </div>
      </button>
    </div>
  );
};

export default FileUpload;
