import React, { useState, useEffect, useCallback } from 'react';
import type { Model, Job, QueueStatus, SystemStatus } from '../types';
import JobRunner from './JobRunner';

interface DashboardProps {
  systemStatus: SystemStatus | null;
}

const Dashboard = ({ systemStatus }: DashboardProps) => {
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      // Fetch recent jobs
      const jobsResponse = await fetch('http://localhost:8000/api/jobs?limit=5');
      const jobsData = await jobsResponse.json();
      setRecentJobs(jobsData.jobs || []);

      // Fetch models
      const modelsResponse = await fetch('http://localhost:8000/api/models?limit=10');
      const modelsData = await modelsResponse.json();
      setModels(modelsData.models || []);

      // Fetch queue status
      const queueResponse = await fetch('http://localhost:8000/api/queue/status');
      const queueData = await queueResponse.json();
      setQueueStatus(queueData);

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-green-500/20 text-green-400 border-green-500/30',
      running: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      failed: 'bg-red-500/20 text-red-400 border-red-500/30',
      queued: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };
    return styles[status as keyof typeof styles] || styles.queued;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Welcome to your AI Lab</h1>
            <p className="text-gray-300">
              Your personal AI inference platform is ready. Start by registering models or running inference jobs.
            </p>
          </div>
          <JobRunner onJobCreate={(jobId) => {
            console.log('New job created:', jobId);
            // Refresh jobs data
            fetchDashboardData();
          }} />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Models</p>
              <p className="text-2xl font-bold text-white">{models.length}</p>
            </div>
            <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <title>Models</title>
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active Jobs</p>
              <p className="text-2xl font-bold text-white">
                {recentJobs.filter(job => job.status === 'running').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <title>Active Jobs</title>
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Queue Size</p>
              <p className="text-2xl font-bold text-white">{queueStatus?.queued_jobs || 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <title>Queue</title>
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active Runners</p>
              <p className="text-2xl font-bold text-white">
                {systemStatus ? Object.values(systemStatus.runners || {}).filter(Boolean).length : 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <title>Runners</title>
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Jobs */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white">Recent Jobs</h2>
          </div>
          <div className="p-6">
            {recentJobs.length > 0 ? (
              <div className="space-y-4">
                {recentJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 text-xs rounded-full border ${getStatusBadge(job.status)}`}>
                          {job.status}
                        </span>
                        <span className="text-sm font-medium text-white">{job.model_name}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 truncate max-w-xs">
                        {job.prompt}
                      </p>
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatTimeAgo(job.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No recent jobs found
              </div>
            )}
          </div>
        </div>

        {/* Available Models */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white">Available Models</h2>
          </div>
          <div className="p-6">
            {models.length > 0 ? (
              <div className="space-y-4">
                {models.slice(0, 5).map((model) => (
                  <div key={model.id} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-white">{model.name}</span>
                        <span className="text-xs px-2 py-1 bg-gray-600 text-gray-300 rounded">
                          {model.backend}
                        </span>
                      </div>
                      {model.description && (
                        <p className="text-xs text-gray-400 mt-1 truncate">
                          {model.description}
                        </p>
                      )}
                    </div>
                    <div className={`w-2 h-2 rounded-full ${
                      model.is_active ? 'bg-green-400' : 'bg-gray-500'
                    }`} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No models registered yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
