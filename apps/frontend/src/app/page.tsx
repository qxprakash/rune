'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Models from './components/Models';
import Jobs from './components/Jobs';
import SystemMonitor from './components/SystemMonitor';
import type { SystemStatus } from './types';

type View = 'dashboard' | 'models' | 'jobs' | 'system';

export default function Home() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  const fetchSystemStatus = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/api/health');
      const status = await response.json();
      setSystemStatus(status);
    } catch (error) {
      console.error('Failed to fetch system status:', error);
    }
  }, []);

  useEffect(() => {
    // Fetch initial system status
    fetchSystemStatus();
    // Set up periodic status updates
    const interval = setInterval(fetchSystemStatus, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [fetchSystemStatus]);

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard systemStatus={systemStatus} />;
      case 'models':
        return <Models />;
      case 'jobs':
        return <Jobs />;
      case 'system':
        return <SystemMonitor />;
      default:
        return <Dashboard systemStatus={systemStatus} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView}
        systemStatus={systemStatus}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header systemStatus={systemStatus} />
        <main className="flex-1 overflow-auto p-6">
          {renderCurrentView()}
        </main>
      </div>
    </div>
  );
}
