import type { SystemStatus } from '../types';

// Icons as simple SVG components
const CpuIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

const DatabaseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
  </svg>
);

const BrainIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.51 2.51 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.51 2.51 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
  </svg>
);

const ActivityIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
  </svg>
);

interface HeaderProps {
  systemStatus: SystemStatus | null;
}

const Header: React.FC<HeaderProps> = ({ systemStatus }) => {
  const getStatusColor = (status: string | boolean) => {
    if (typeof status === 'boolean') {
      return status ? 'text-green-400' : 'text-red-400';
    }
    switch (status) {
      case 'ok':
        return 'text-green-400';
      case 'degraded':
        return 'text-yellow-400';
      default:
        return 'text-red-400';
    }
  };

  const getStatusDot = (status: string | boolean) => {
    const color = getStatusColor(status);
    return (
      <div className={`w-2 h-2 rounded-full ${color.replace('text-', 'bg-')} status-pulse`} />
    );
  };

  return (
    <header className="bg-gray-900/50 border-b border-gray-800 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <BrainIcon />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Rune AI Lab
            </h1>
          </div>
          <div className="hidden sm:block text-gray-400 text-sm">
            Turn your hardware into an AI powerhouse
          </div>
        </div>

        {systemStatus && (
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <CpuIcon />
              {getStatusDot(systemStatus.status)}
              <span className={`text-sm ${getStatusColor(systemStatus.status)}`}>
                System
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <DatabaseIcon />
              {getStatusDot(systemStatus.database)}
              <span className={`text-sm ${getStatusColor(systemStatus.database)}`}>
                Database
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <ActivityIcon />
              {getStatusDot(Object.values(systemStatus.runners || {}).some(Boolean))}
              <span className={`text-sm ${getStatusColor(Object.values(systemStatus.runners || {}).some(Boolean))}`}>
                Runners
              </span>
            </div>

            <div className="text-xs text-gray-500">
              v{systemStatus.version}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
