import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RouteLeg } from '@/services/RouteFinder';
import { WalkIcon } from '@/components/Icons';

interface TransferIndicatorProps {
  fromLeg: RouteLeg;
  toLeg: RouteLeg;
}

export const TransferIndicator: React.FC<TransferIndicatorProps> = () => {
  const { t } = useTranslation();

  return (
    <div className="relative">
      {/* Connecting Line */}
      <div className="absolute left-4 top-0 bottom-0 w-1 bg-gray-300" />

      {/* Transfer Badge */}
      <div className="flex gap-3 py-3">
        <div className="relative z-10 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-orange-100 border-2 border-orange-400 flex items-center justify-center">
            <WalkIcon className="w-4 h-4 text-orange-600" />
          </div>
        </div>
        <div className="flex items-center">
          <span className="text-sm font-medium text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-200">
            {t('route_result.transfer', 'Transfer')}
          </span>
        </div>
      </div>
    </div>
  );
};
