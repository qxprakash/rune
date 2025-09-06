'use client';

import type { SystemStatus } from '../types';

// Icons as simple SVG components - using suppressHydrationWarning to prevent DarkReader conflicts
const HomeIcon = () => (
  <svg 
    className="w-5 h-5" 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
    suppressHydrationWarning={true}
  >
    <title>Home</title>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9,22 9,12 15,12 15,22"/>
  </svg>
);

const ModelsIcon = () => (
  <svg 
    className="w-5 h-5" 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
    suppressHydrationWarning={true}
  >
    <title>Models</title>
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);

const JobsIcon = () => (
  <svg 
    className="w-5 h-5" 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
    suppressHydrationWarning={true}
  >
    <title>Jobs</title>
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);

const SystemIcon = () => (
  <svg 
    className="w-5 h-5" 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
    suppressHydrationWarning={true}
  >
    <title>System</title>
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
    <rect x="9" y="9" width="6" height="6"/>
    <line x1="9" y1="1" x2="9" y2="4"/>
    <line x1="15" y1="1" x2="15" y2="4"/>
    <line x1="9" y1="20" x2="9" y2="23"/>
    <line x1="15" y1="20" x2="15" y2="23"/>
    <line x1="20" y1="9" x2="23" y2="9"/>
    <line x1="20" y1="14" x2="23" y2="14"/>
    <line x1="1" y1="9" x2="4" y2="9"/>
    <line x1="1" y1="14" x2="4" y2="14"/>
  </svg>
);

type View = 'dashboard' | 'models' | 'jobs' | 'system';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  systemStatus: SystemStatus | null;
}

const Sidebar = ({ currentView, onViewChange, systemStatus }: SidebarProps) => {
  const menuItems = [
    { id: 'dashboard' as View, label: 'Dashboard', icon: HomeIcon },
    { id: 'models' as View, label: 'Models', icon: ModelsIcon },
    { id: 'jobs' as View, label: 'Jobs', icon: JobsIcon },
    { id: 'system' as View, label: 'System', icon: SystemIcon },
  ];

  const getRunnerCount = () => {
    if (!systemStatus?.runners) return 0;
    return Object.values(systemStatus.runners).filter(Boolean).length;
  };

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo area */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">R</span>
          </div>
          <div>
            <h2 className="font-semibold text-white">AI Lab</h2>
            <p className="text-xs text-gray-400">Local Instance</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onViewChange(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <IconComponent />
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Status footer */}
      <div className="p-4 border-t border-gray-800">
        <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Status</span>
            <div className={`w-2 h-2 rounded-full ${
              systemStatus?.status === 'ok' ? 'bg-green-400' : 'bg-red-400'
            } status-pulse`} />
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Runners</span>
            <span className="text-white font-mono">
              {getRunnerCount()}/4
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Database</span>
            <span className={`${
              systemStatus?.database ? 'text-green-400' : 'text-red-400'
            }`}>
              {systemStatus?.database ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
