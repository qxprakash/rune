// API Response Types
export interface SystemStatus {
  status: string;
  version: string;
  database: boolean;
  runners: Record<string, boolean>;
}

export interface ModelBackend {
  ollama: string;
  mlx: string;
  pytorch: string;
  gguf: string;
  whisper: string;
}

export interface JobType {
  text_generation: string;
  speech_to_text: string;
  text_to_speech: string;
  image_generation: string;
  image_to_text: string;
  embeddings: string;
}

export interface JobStatus {
  queued: string;
  running: string;
  completed: string;
  failed: string;
}

export interface Model {
  id: string;
  name: string;
  backend: string;
  supported_tasks: string[];
  config: Record<string, unknown>;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  model_name: string;
  backend: string;
  task_type: string;
  prompt: string;
  input_files: string[];
  output_files: string[];
  parameters: Record<string, unknown>;
  result?: Record<string, unknown>;
  status: string;
  error_message?: string;
  execution_time_ms?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface SystemStats {
  system: {
    platform: string;
    architecture: string;
    python_version: string;
  };
  cpu: {
    cpu_percent: number;
    cpu_count: number;
    cpu_count_logical: number;
  };
  memory: {
    total_gb: number;
    available_gb: number;
    used_gb: number;
    percent: number;
  };
  disk: {
    total_gb: number;
    used_gb: number;
    free_gb: number;
    percent: number;
  };
  gpu: {
    nvidia: { available: boolean };
    amd: { available: boolean };
    apple_silicon: { available: boolean };
    available: boolean;
  };
  processes: {
    total_processes: number;
    python_processes: number;
  };
}

export interface QueueStatus {
  queued_jobs: number;
  failed_jobs: number;
  workers: number;
  error?: string;
}
