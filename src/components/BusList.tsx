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
    <div className="relative flex group">
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
        <div 
          id={`stop-${stop.staCode.replace(/[\/\s]/g, '-')}`}
          className="flex items-baseline justify-between p-2 rounded-lg -ml-2 transition-all duration-300"
        >
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

// Helper: Calculate travel time between two stop indices
const calcTravelTime = (
  stops: any[],
  fromIdx: number,
  toIdx: number,
  trafficData: any[]
): number => {
  let totalTime = 0;
  for (let j = fromIdx; j < toIdx; j++) {
    const s1 = stops[j];
    const s2 = stops[j + 1];
    
    // Safety check for coordinates
    if (!s1?.latitude || !s1?.longitude || !s2?.latitude || !s2?.longitude) continue;

    const segmentDistKm = getDistanceFromLatLonInKm(
        parseFloat(s1.latitude), parseFloat(s1.longitude), 
        parseFloat(s2.latitude), parseFloat(s2.longitude)
    );

    let trafficMultiplier = 1.0;
    if (trafficData && trafficData[j]) {
       const traffic = trafficData[j].traffic || 1;
       if (traffic >= 3) trafficMultiplier = 2.0; // Congested/Severe
       else if (traffic >= 2) trafficMultiplier = 1.5; // Moderate
    }
    
    // Base speed ~40km/h => 1.5 min/km
    totalTime += segmentDistKm * 1.5 * trafficMultiplier;
  }
  return totalTime;
};

// --- Main Component ---

interface BusListProps {
  stops: any[];
  trafficData: any[]; 
}

const BusList: React.FC<BusListProps> = ({ stops, trafficData }) => {
    // 1. Memoize valid bus positions (buses active on the route)
    // We store { index, busInfo } for every bus found
    const activeBuses: { index: number; bus: any }[] = [];
    stops.forEach((stop, idx) => {
        if (stop.buses && stop.buses.length > 0) {
            stop.buses.forEach((bus: any) => {
                 activeBuses.push({ index: idx, bus });
            });
        }
    });

    return (
        <div className="py-6 relative w-fit mx-auto min-w-[340px] max-w-full px-4">
            {/* Start Decoration */}
            <div className="absolute top-0 left-12 w-2 h-6 bg-gradient-to-b from-transparent to-gray-200 z-0 opacity-50 rounded-full"></div>
            
            {stops.map((stop, index) => {
                let segmentTraffic = 0;
                if (trafficData && trafficData[index]) {
                    segmentTraffic = trafficData[index].traffic;
                }

                // Calculate ETA using Physics-Based Logic
                let predictedEta: string | null = null;
                
                // Find the nearest bus BEHIND this stop
                // Filter buses where busIndex <= index
                // Note: If bus is AT this stop (busIndex === index), eta is "Arrived"/Null
                const approachingBuses = activeBuses.filter(b => b.index <= index);
                const nearestBus = approachingBuses.length > 0 ? approachingBuses[approachingBuses.length - 1] : null;

                if (nearestBus) {
                     if (nearestBus.index === index) {
                         // Bus is at this stop
                         predictedEta = "Arrived"; 
                     } else {
                         // Bus is at a previous stop. Calculate travel time from [busIndex] to [index]
                         const travelTime = calcTravelTime(stops, nearestBus.index, index, trafficData);
                         
                         // Add Dwell Time: 0.75 min (45s) per intervening stop
                         const interveningStops = index - nearestBus.index;
                         const dwellTime = interveningStops * 0.75;
                         
                         const totalEta = Math.round(travelTime + dwellTime);
                         
                         // If < 1 min but logic says it's away, show 1 min
                         predictedEta = (totalEta < 1 ? 1 : totalEta).toString();
                     }
                }
                
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


