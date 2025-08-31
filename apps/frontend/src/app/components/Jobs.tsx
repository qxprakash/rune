import { useState, useEffect } from 'react';
import type { Job } from '../types';

const Jobs = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/jobs?limit=50');
        const data = await response.json();
        setJobs(data.jobs || []);
      } catch (error) {
        console.error('Failed to fetch jobs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
    const interval = setInterval(fetchJobs, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-green-500/20 text-green-400 border-green-500/30',
      running: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 animate-pulse',
      failed: 'bg-red-500/20 text-red-400 border-red-500/30',
      queued: 'bg-blue-500/20 text-blue-400 border-blue-500/30 animate-bounce',
    };
    return styles[status as keyof typeof styles] || styles.queued;
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      completed: '✅',
      running: '⚡',
      failed: '❌',
      queued: '⏳',
    };
    return icons[status as keyof typeof icons] || '🔄';
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredJobs = jobs.filter(job => {
    if (filter === 'all') return true;
    return job.status === filter;
  });

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Jobs</h1>
        </div>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
              <div className="h-8 bg-gray-700 rounded animate-pulse mb-2"></div>
              <div className="h-4 bg-gray-700 rounded animate-pulse w-20"></div>
            </div>
          ))}
        </div>

        {/* Table Skeleton */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg">
          <div className="p-6 border-b border-gray-700">
            <div className="h-6 bg-gray-700 rounded animate-pulse w-48"></div>
          </div>
          
          <div className="divide-y divide-gray-700">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-6 py-4">
                <div className="flex items-center space-x-6">
                  <div className="h-4 bg-gray-700 rounded animate-pulse w-20"></div>
                  <div className="h-4 bg-gray-700 rounded animate-pulse w-24"></div>
                  <div className="h-6 bg-gray-700 rounded-full animate-pulse w-16"></div>
                  <div className="h-4 bg-gray-700 rounded animate-pulse w-20"></div>
                  <div className="h-4 bg-gray-700 rounded animate-pulse w-16"></div>
                  <div className="h-4 bg-gray-700 rounded animate-pulse w-20"></div>
                  <div className="h-4 bg-gray-700 rounded animate-pulse w-16"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Jobs</h1>
          <p className="text-gray-400">Monitor and manage inference jobs</p>
        </div>
        <div className="flex space-x-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          >
            <option value="all">All Jobs</option>
            <option value="running">Running</option>
            <option value="queued">Queued</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <button
            type="button"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            New Job
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['completed', 'running', 'queued', 'failed'].map(status => {
          const count = jobs.filter(job => job.status === status).length;
          return (
            <div key={status} className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-white">{count}</div>
              <div className="text-sm text-gray-400 capitalize">{status}</div>
            </div>
          );
        })}
      </div>

      {/* Jobs List */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">
            Job History ({filteredJobs.length} jobs)
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Job ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Model
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Task Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredJobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-mono text-gray-300">
                      {job.id.substring(0, 8)}...
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-white">{job.model_name}</div>
                    <div className="text-xs text-gray-500">{job.backend}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full border flex items-center space-x-1 ${getStatusBadge(job.status)}`}>
                      <span>{getStatusIcon(job.status)}</span>
                      <span>{job.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-300">{job.task_type}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-300">
                      {job.execution_time_ms ? formatDuration(job.execution_time_ms) : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-300">{formatDate(job.created_at)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => setSelectedJob(job)}
                      className="text-cyan-400 hover:text-cyan-300 text-sm"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredJobs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No jobs found for the selected filter
            </div>
          )}
        </div>
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Job Details</h2>
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="text-gray-400 hover:text-white"
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
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-400">Job ID</div>
                  <div className="text-white font-mono">{selectedJob.id}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Status</div>
                  <span className={`inline-block px-2 py-1 text-xs rounded-full border ${getStatusBadge(selectedJob.status)}`}>
                    {selectedJob.status}
                  </span>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Model</div>
                  <div className="text-white">{selectedJob.model_name}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Backend</div>
                  <div className="text-white">{selectedJob.backend}</div>
                </div>
              </div>

              {/* Prompt */}
              <div>
                <div className="text-sm text-gray-400 mb-2">Prompt</div>
                <div className="bg-gray-700/50 rounded-lg p-4 text-gray-300">
                  {selectedJob.prompt}
                </div>
              </div>

              {/* Parameters */}
              {Object.keys(selectedJob.parameters).length > 0 && (
                <div>
                  <div className="text-sm text-gray-400 mb-2">Parameters</div>
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                      {JSON.stringify(selectedJob.parameters, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Result */}
              {selectedJob.result && (
                <div>
                  <div className="text-sm text-gray-400 mb-2">Result</div>
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                      {JSON.stringify(selectedJob.result, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Error */}
              {selectedJob.error_message && (
                <div>
                  <div className="text-sm text-gray-400 mb-2">Error</div>
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
                    {selectedJob.error_message}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-400">Created</div>
                  <div className="text-gray-300">{formatDate(selectedJob.created_at)}</div>
                </div>
                {selectedJob.started_at && (
                  <div>
                    <div className="text-gray-400">Started</div>
                    <div className="text-gray-300">{formatDate(selectedJob.started_at)}</div>
                  </div>
                )}
                {selectedJob.completed_at && (
                  <div>
                    <div className="text-gray-400">Completed</div>
                    <div className="text-gray-300">{formatDate(selectedJob.completed_at)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Jobs;
