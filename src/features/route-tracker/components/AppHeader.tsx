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
    <div className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white p-4 shadow-md sticky top-0 z-50">
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
          {!busData && (
            <img 
              src="/macau-bus/logo.jpg" 
              alt="Logo" 
              className="w-8 h-8 rounded-full shadow-sm mr-2 object-cover bg-white"
            />
          )} {t('app_title')}
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
        <div className="flex flex-row justify-between items-center bg-white/10 p-3 rounded-lg backdrop-blur-md shadow-sm">
          {/* Left: Route & Destination */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="bg-white text-teal-600 font-bold px-3 py-1 rounded text-xl shadow flex-shrink-0">
              {activeRoute}
            </div>
            <div className="flex-1 min-w-0 pr-2">
              <div className="text-xs text-teal-100 uppercase font-semibold tracking-wider">{t('to_destination')}</div>
              <div className="font-medium truncate text-white text-lg drop-shadow-sm leading-tight">
                {getLocalizedStopName(busData.stops[busData.stops.length-1]?.staCode, busData.stops[busData.stops.length-1]?.staName)}
              </div>
            </div>
          </div>

          {/* Right: Service Hours (Stacked) */}
          {(busData.firstBusTime || busData.lastBusTime) && (
             <div className="flex flex-col items-end gap-1.5 text-xs text-teal-50 font-bold flex-shrink-0 ml-1">
                {busData.firstBusTime && (
                  <div className="flex items-center gap-1.5 bg-black/10 px-2 py-1 rounded w-full justify-end">
                    <span className="opacity-75 uppercase text-[10px]">{t('first_bus', 'First')}</span>
                    <span className="font-mono">{busData.firstBusTime}</span>
                  </div>
                )}
                {busData.lastBusTime && (
                  <div className="flex items-center gap-1.5 bg-black/10 px-2 py-1 rounded w-full justify-end">
                     <span className="opacity-75 uppercase text-[10px]">{t('last_bus', 'Last')}</span>
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
