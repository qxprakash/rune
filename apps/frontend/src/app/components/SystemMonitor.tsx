import { useState, useEffect } from 'react';
import type { SystemStats, QueueStatus } from '../types';

const SystemMonitor = () => {
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSystemData = async () => {
      try {
        // Fetch system stats
        const statsResponse = await fetch('http://localhost:8000/api/system/stats');
        const statsData = await statsResponse.json();
        setSystemStats(statsData);

        // Fetch queue status
        const queueResponse = await fetch('http://localhost:8000/api/queue/status');
        const queueData = await queueResponse.json();
        setQueueStatus(queueData);
        
      } catch (error) {
        console.error('Failed to fetch system data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSystemData();
    const interval = setInterval(fetchSystemData, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-400';
    if (percentage >= 70) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getUsageBarColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-400">Loading system information...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">System Monitor</h1>
        <p className="text-gray-400">Monitor your AI lab&apos;s hardware and performance</p>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* CPU */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">CPU</h3>
            <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <title>CPU</title>
              <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
              <rect x="9" y="9" width="6" height="6"/>
            </svg>
          </div>
          
          {systemStats && (
            <>
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Usage</span>
                  <span className={`font-mono ${getUsageColor(systemStats.cpu.cpu_percent)}`}>
                    {systemStats.cpu.cpu_percent.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${getUsageBarColor(systemStats.cpu.cpu_percent)}`}
                    style={{ width: `${systemStats.cpu.cpu_percent}%` }}
                  />
                </div>
              </div>
              
              <div className="text-sm text-gray-400">
                <div>Cores: {systemStats.cpu.cpu_count}</div>
                <div>Threads: {systemStats.cpu.cpu_count_logical}</div>
              </div>
            </>
          )}
        </div>

        {/* Memory */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Memory</h3>
            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <title>Memory</title>
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <path d="m8 11 2 2 4-4"/>
            </svg>
          </div>
          
          {systemStats && (
            <>
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Usage</span>
                  <span className={`font-mono ${getUsageColor(systemStats.memory.percent)}`}>
                    {systemStats.memory.percent.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${getUsageBarColor(systemStats.memory.percent)}`}
                    style={{ width: `${systemStats.memory.percent}%` }}
                  />
                </div>
              </div>
              
              <div className="text-sm text-gray-400">
                <div>{systemStats.memory.used_gb.toFixed(1)} / {systemStats.memory.total_gb.toFixed(1)} GB</div>
                <div>Available: {systemStats.memory.available_gb.toFixed(1)} GB</div>
              </div>
            </>
          )}
        </div>

        {/* Disk */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Storage</h3>
            <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <title>Storage</title>
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="m21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
          </div>
          
          {systemStats && (
            <>
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Usage</span>
                  <span className={`font-mono ${getUsageColor(systemStats.disk.percent)}`}>
                    {systemStats.disk.percent.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${getUsageBarColor(systemStats.disk.percent)}`}
                    style={{ width: `${systemStats.disk.percent}%` }}
                  />
                </div>
              </div>
              
              <div className="text-sm text-gray-400">
                <div>{systemStats.disk.used_gb.toFixed(1)} / {systemStats.disk.total_gb.toFixed(1)} GB</div>
                <div>Free: {systemStats.disk.free_gb.toFixed(1)} GB</div>
              </div>
            </>
          )}
        </div>

        {/* GPU */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">GPU</h3>
            <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <title>GPU</title>
              <rect x="2" y="7" width="20" height="10" rx="2" ry="2"/>
              <line x1="6" y1="11" x2="6" y2="13"/>
              <line x1="10" y1="11" x2="10" y2="13"/>
              <line x1="14" y1="11" x2="14" y2="13"/>
              <line x1="18" y1="11" x2="18" y2="13"/>
            </svg>
          </div>
          
          {systemStats && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">NVIDIA</span>
                <span className={`w-2 h-2 rounded-full ${
                  systemStats.gpu.nvidia.available ? 'bg-green-400' : 'bg-gray-500'
                }`} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Apple Silicon</span>
                <span className={`w-2 h-2 rounded-full ${
                  systemStats.gpu.apple_silicon.available ? 'bg-green-400' : 'bg-gray-500'
                }`} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">AMD</span>
                <span className={`w-2 h-2 rounded-full ${
                  systemStats.gpu.amd.available ? 'bg-green-400' : 'bg-gray-500'
                }`} />
              </div>
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="text-xs text-gray-500">
                  Status: {systemStats.gpu.available ? 
                    <span className="text-green-400">GPU Available</span> : 
                    <span className="text-gray-400">CPU Only</span>
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* System Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Info */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">System Information</h3>
          
          {systemStats && (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Platform</span>
                <span className="text-white">{systemStats.system.platform}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Architecture</span>
                <span className="text-white">{systemStats.system.architecture}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Python Version</span>
                <span className="text-white">{systemStats.system.python_version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Processes</span>
                <span className="text-white">{systemStats.processes.total_processes}</span>
              </div>
            </div>
          )}
        </div>

        {/* Queue Status */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Job Queue</h3>
          
          {queueStatus && (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Queued Jobs</span>
                <span className="text-yellow-400 font-mono">{queueStatus.queued_jobs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Active Workers</span>
                <span className="text-green-400 font-mono">{queueStatus.workers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Failed Jobs</span>
                <span className="text-red-400 font-mono">{queueStatus.failed_jobs}</span>
              </div>
              {queueStatus.error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="text-red-400 text-sm">
                    Queue Error: {queueStatus.error}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Performance Chart Placeholder */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Performance Metrics</h3>
          <div className="text-sm text-gray-400">Real-time monitoring</div>
        </div>
        
        <div className="flex items-center justify-center h-48 bg-gray-700/30 rounded-lg">
          <div className="text-center">
            <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <title>Chart</title>
              <path d="m3 3 7.07 16.97 2.51-7.39 3.27-9.57"/>
              <path d="m13 13 3 3 4-4"/>
            </svg>
            <p className="text-gray-500">Performance charts coming soon</p>
            <p className="text-xs text-gray-600 mt-2">CPU, Memory, and GPU usage over time</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemMonitor;
