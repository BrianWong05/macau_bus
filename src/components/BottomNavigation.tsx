import React from 'react';
import { useTranslation } from 'react-i18next';

// ============== Icons ==============

const BusIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="4" width="18" height="14" rx="2" />
    <path d="M3 10h18" />
    <circle cx="7" cy="20" r="2" />
    <circle cx="17" cy="20" r="2" />
  </svg>
);

const RouteIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
);

// ============== Types ==============

export type NavigationTab = 'live' | 'planner';

interface BottomNavigationProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
}

// ============== Component ==============

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation();

  const tabs: { id: NavigationTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'live', label: t('nav.live_status', 'Live Status'), icon: BusIcon },
    { id: 'planner', label: t('nav.route_planner', 'Route Planner'), icon: RouteIcon },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="max-w-md mx-auto flex">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`flex-1 flex flex-col items-center justify-center py-3 transition-colors ${
                isActive 
                  ? 'text-teal-600' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'text-teal-500' : ''}`} />
              <span className={`text-xs mt-1 font-medium ${isActive ? 'text-teal-600' : ''}`}>
                {label}
              </span>
              {/* Active Indicator */}
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-teal-500 rounded-b-full" />
              )}
            </button>
          );
        })}
      </div>
      {/* Safe area padding for iOS */}
      <div className="h-safe-area-inset-bottom bg-white" />
    </nav>
  );
};

export default BottomNavigation;
