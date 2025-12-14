import React, { useState, useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Feature imports
// Feature imports
import { NearbyStopsHeader } from '../features/nearby-stops/components/NearbyStopsHeader';
import { NearbyMapView } from '../features/nearby-stops/components/NearbyMapView';
import { NearbyStopsList } from '../features/nearby-stops/components/NearbyStopsList';
import { useArrivalData } from '../features/nearby-stops/hooks/useArrivalData';
import { useNearbyDiscovery } from '../features/nearby-stops/hooks/useNearbyDiscovery';
import { LoadingState, ErrorState } from './shared';
import { NearbyStop } from '../features/nearby-stops/types';

interface NearbyStopsProps {
  onClose: () => void;
  onSelectRoute: (route: string, stopCode: string | null, dir?: string | null) => void;
}

const NearbyStops: React.FC<NearbyStopsProps> = ({ onClose, onSelectRoute }) => {
  const [expandedStop, setExpandedStop] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list'); 
  
  // Use extracted hooks
  const { nearbyStops, loading, error, permissionDenied, userLocation, refresh } = useNearbyDiscovery();
  const { arrivalData, loadingArrivals, stopBuses, lastUpdated, fetchStopData } = useArrivalData();

  // Auto-Refresh Effect
  useEffect(() => {
      let intervalId: ReturnType<typeof setInterval>;
      if (expandedStop) {
          fetchStopData(expandedStop);
          intervalId = setInterval(() => {
              fetchStopData(expandedStop);
          }, 5000);
      }
      return () => {
          if (intervalId) clearInterval(intervalId);
      };
  }, [expandedStop, fetchStopData]);

  const handleExpandStop = (stop: NearbyStop) => {
      if (expandedStop === stop.code) {
          setExpandedStop(null);
      } else {
          setExpandedStop(stop.code);
      }
  };

  const handleManualRefresh = () => {
      if (expandedStop) {
          fetchStopData(expandedStop);
      } else {
          refresh();
      }
  };

  return (
    <div className="flex flex-col h-full bg-white animate-fade-in-up">
        <NearbyStopsHeader
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRefresh={handleManualRefresh}
          onClose={onClose}
        />

        <div className="flex-1 overflow-y-auto relative">
            {loading && <LoadingState message="Finding nearby stops..." />}

            {!loading && error && (
                <ErrorState error={error} showPermissionHint={permissionDenied} />
            )}
            
            {!loading && viewMode === 'list' && (
                <NearbyStopsList
                  nearbyStops={nearbyStops}
                  expandedStop={expandedStop}
                  arrivalData={arrivalData}
                  loadingArrivals={loadingArrivals}
                  lastUpdated={lastUpdated}
                  permissionDenied={permissionDenied}
                  onExpandStop={handleExpandStop}
                  onSelectRoute={onSelectRoute}
                  onClose={onClose}
                />
            )}

            {!loading && viewMode === 'map' && userLocation && (
                <NearbyMapView
                  userLocation={userLocation}
                  nearbyStops={nearbyStops}
                  stopBuses={stopBuses}
                  expandedStop={expandedStop}
                  onStopSelect={(stop) => { setViewMode('list'); handleExpandStop(stop); }}
                />
            )}
        </div>
    </div>
  );
};

export default NearbyStops;
