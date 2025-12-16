/**
 * AppHeader - Header component for the main app
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { getLocalizedStopName } from '@/utils/localizedStopName';

interface AppHeaderProps {
  activeRoute: string;
  busData: any;
  routeNo: string;
  hasOppositeDirection: boolean;
  onBack: () => void;
  onSearch: () => void;
  onSetRouteNo: (val: string) => void;
  onToggleDirection: () => void;
  onResetToHome: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeRoute,
  busData,
  routeNo,
  hasOppositeDirection,
  onBack,
  onSearch,
  onSetRouteNo,
  onToggleDirection,
  onResetToHome,
}) => {
  const { t } = useTranslation();
  
  return (
    <div className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white p-4 shadow-md sticky top-0 z-10">
      <div className="flex justify-between items-center mb-4">
        <h1 
          className="text-2xl font-bold tracking-tight cursor-pointer flex items-center gap-2"
          onClick={onResetToHome}
        >
          {busData && (
            <button 
              onClick={(e) => { e.stopPropagation(); onBack(); }}
              className="mr-1 hover:bg-white/20 rounded-full p-1 transition"
              title="Back"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path>
              </svg>
            </button>
          )}
          {!busData && "🚍"} {t('app_title')}
        </h1>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
        </div>
      </div>

      {!busData && (
        <div className="text-teal-100 text-sm mb-2">
          {t('subtitle', 'Real-time bus tracking & traffic')}
        </div>
      )}
      
      {/* Active Route Header (Compact) */}
      {busData && (
        <div className="flex flex-col gap-2 bg-white/10 p-3 rounded-lg backdrop-blur-md shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-white text-teal-600 font-bold px-3 py-1 rounded text-xl shadow">
              {activeRoute}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-teal-100 uppercase font-semibold tracking-wider">{t('to_destination')}</div>
              <div className="font-medium truncate text-white text-lg drop-shadow-sm">
                {getLocalizedStopName(busData.stops[busData.stops.length-1]?.staCode, busData.stops[busData.stops.length-1]?.staName)}
              </div>
            </div>
          </div>

          {/* Service Hours */}
          {(busData.firstBusTime || busData.lastBusTime) && (
             <div className="flex items-center gap-4 text-sm text-teal-50 font-bold border-t border-white/20 pt-2 mt-1">
                {busData.firstBusTime && (
                  <div className="flex items-center gap-1.5 bg-black/10 px-2 py-0.5 rounded">
                    <span className="opacity-75 text-xs uppercase">{t('first_bus', 'First')}</span>
                    <span className="font-mono">{busData.firstBusTime}</span>
                  </div>
                )}
                {busData.lastBusTime && (
                  <div className="flex items-center gap-1.5 bg-black/10 px-2 py-0.5 rounded">
                     <span className="opacity-75 text-xs uppercase">{t('last_bus', 'Last')}</span>
                     <span className="font-mono">{busData.lastBusTime}</span>
                  </div>
                )}
             </div>
          )}
        </div>
      )}
    </div>
  );
};
