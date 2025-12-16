import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getLocalizedStopName } from '@/utils/localizedStopName';

// --- Sub-Components ---

interface ActiveBusMarkerProps {
  bus: any;
  onClick: () => void;
  isExpanded: boolean;
}

const ActiveBusMarker: React.FC<ActiveBusMarkerProps> = ({ bus, onClick, isExpanded }) => {
  // Status '1' = At Station (Position at Node)
  // Status '0' = In Transit (Position on Line between stops)
  const isAtStation = bus.status === '1';
  const positionClass = isAtStation ? 'top-4' : 'top-16'; 

  return (
    <div 
      className={`absolute left-1/2 ${positionClass} transform -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center cursor-pointer group transition-all duration-500 ease-in-out`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {/* Bus Icon Badge */}
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white
        ${isAtStation ? 'bg-blue-500' : 'bg-emerald-500'}
        transition-transform hover:scale-110
      `}>
        <span className="text-sm">🚌</span>
      </div>

      {/* Plate Badge */}
      <span className="mt-1 px-1.5 py-0.5 bg-gray-800 text-white text-[10px] rounded-full shadow-sm font-mono opacity-80 group-hover:opacity-100 transition-opacity whitespace-nowrap">
        {bus.busPlate}
      </span>

      {/* Expanded Details (Popover-ish) */}
      {(isExpanded) && (
        <div className="absolute top-10 w-32 bg-white rounded-lg shadow-xl border border-gray-100 p-2 z-30 animate-in slide-in-from-top-2 fade-in duration-200">
           <div className="text-xs font-semibold text-gray-700 text-center mb-1">{bus.busPlate}</div>
           <div className="grid grid-cols-2 gap-1 text-[10px] text-gray-500">
             <div className="flex flex-col items-center bg-gray-50 p-1 rounded">
                <span>⚡ {bus.speed}</span>
                <span className="text-[8px] uppercase">km/h</span>
             </div>
             <div className="flex flex-col items-center bg-gray-50 p-1 rounded">
                <span>👥 {bus.passengerFlow}</span>
                <span className="text-[8px] uppercase">Pax</span>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

interface RouteTimelineItemProps {
  stop: any;
  index: number;
  isLast: boolean;
  buses: any[];
  trafficLevel: number;
  eta: string | null;
}

const RouteTimelineItem: React.FC<RouteTimelineItemProps> = ({ stop, index, isLast, buses, trafficLevel, eta }) => {
  const [expandedBus, setExpandedBus] = useState<number | null>(null);

  // Determine line color based on traffic level
  const getLineColor = (level: number) => {
     const val = parseInt(level.toString());
     if (val >= 4) return 'bg-red-900'; // Severe (4 or higher)

     switch (val) {
         case 1: return 'bg-emerald-400'; // Smooth
         case 2: return 'bg-yellow-400';  // Moderate
         case 3: return 'bg-red-500';     // Congested
         default: return 'bg-gray-200';   // Unknown
     }
  };

  return (
    <div id={`stop-${stop.staCode}`} className="relative flex group">
      {/* 1. Timeline Column */}
      <div className="flex flex-col items-center w-16 flex-shrink-0 relative">
        {/* Continuous Line */}
        {!isLast && (
          <div className={`absolute top-4 bottom-[-24px] w-2 z-0 transition-colors duration-500 rounded-full
            ${trafficLevel > 0 ? getLineColor(trafficLevel) : 'bg-gray-200'}
          `}></div>
        )}

        {/* Stop Node */}
        <div className={`relative z-10 w-4 h-4 rounded-full border-[3px] bg-white transition-all duration-300 box-border
           ${buses.length > 0 ? 'border-emerald-500 scale-125' : 'border-gray-300 group-hover:border-teal-400'}
        `}></div>

        {/* Active Buses on this Stop Node */}
        {buses.map((bus, i) => (
           <ActiveBusMarker 
              key={i} 
              bus={bus} 
              isExpanded={expandedBus === i}
              onClick={() => setExpandedBus(expandedBus === i ? null : i)}
           />
        ))}
      </div>

      {/* 2. Content Column */}
      <div className="flex-1 pb-8 pt-0 min-h-[80px] flex flex-col justify-start relative top-[-4px]">
        <div className="flex items-baseline justify-between">
           <div>
             <h3 className="text-base font-bold text-gray-800 leading-tight group-hover:text-teal-700 transition-colors">
               {index + 1}. {getLocalizedStopName(stop.staCode, stop.staName)}
             </h3>
             <div className="flex items-center gap-2 mt-0.5">
                <div className="text-xs text-gray-400 font-mono">
                  {stop.staCode}
                  {stop.laneName && <span className="ml-2 text-teal-600 bg-teal-50 px-1 rounded border border-teal-100">{stop.laneName}</span>}
                </div>
                {/* ETA Display */}
                {eta && (
                  <span className="text-xs font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100 animate-pulse">
                    {eta} min
                  </span>
                )}
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};


// --- Main Component ---

interface BusListProps {
  stops: any[];
  trafficData: any[]; 
}

const BusList: React.FC<BusListProps> = ({ stops, trafficData }) => {
    // Helper to find the nearest bus index before or at current stop
    // We'll traverse and memoize bus positions
    const busPositions: number[] = [];
    stops.forEach((stop, idx) => {
        if (stop.buses && stop.buses.length > 0) {
            busPositions.push(idx);
        }
    });

    return (
        <div className="py-6 px-2 relative">
            {/* Start Decoration */}
            <div className="absolute top-0 left-8 w-2 h-6 bg-gradient-to-b from-transparent to-gray-200 z-0 opacity-50 rounded-full"></div>
            
            {stops.map((stop, index) => {
                // Fallback to index-based matching if trafficData is array-aligned (likely the case)
                let segmentTraffic = 0;
                if (trafficData && trafficData[index]) {
                    segmentTraffic = trafficData[index].traffic;
                }

                // Calculate ETA
                let predictedEta: string | null = null;
                // Find closest bus BEHIND this stop (so index of bus < index of stop)
                // Filter positions less than current index, take the largest one (closest)
                const precedingBuses = busPositions.filter(p => p <= index);
                const closestBusIndex = precedingBuses.length > 0 ? precedingBuses[precedingBuses.length - 1] : -1;

                if (closestBusIndex !== -1 && closestBusIndex < index) {
                    const stopsAway = index - closestBusIndex;
                    // Heuristic: 2.5 mins per stop
                    const minutes = Math.ceil(stopsAway * 2.5);
                    predictedEta = minutes.toString();
                } else if (closestBusIndex === index) {
                    predictedEta = "Arrived";
                }

                // Don't show "Arrived" for the bus that is AT the stop (redundant with the icon), 
                // only show future ETAs for downstream stops
                if (predictedEta === "Arrived") predictedEta = null;

                return (
                    <RouteTimelineItem
                        key={stop.busstopcode || index}
                        stop={stop}
                        index={index}
                        isLast={index === stops.length - 1}
                        buses={stop.buses}
                        trafficLevel={segmentTraffic}
                        eta={predictedEta}
                    />
                );
            })}
             {/* End Decoration */}
             <div className="absolute bottom-0 left-8 w-2 h-6 bg-gradient-to-t from-transparent to-gray-200 z-0 opacity-50 rounded-full"></div>
        </div>
    );
};

export default BusList;


