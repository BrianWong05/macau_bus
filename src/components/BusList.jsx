
import React from 'react';

// Helper to map busType
const getBusTypeLabel = (type) => {
    switch(type) {
        case '1': return 'Large'; // 大巴
        case '2': return 'Medium'; // 中巴
        case '3': return 'Small'; // 小巴
        default: return type;
    }
};

const BusList = ({ stops, trafficData }) => {
    return (
        <div className="pb-10">
            {stops.map((stop, index) => {
                // Resolve traffic level for the segment starting at this stop
                const segmentTraffic = trafficData && trafficData[index] ? trafficData[index].traffic : 0;
                
                return (
                    <div key={stop.busstopcode || index} id={`stop-${stop.staCode}`} className="grid grid-cols-[140px_24px_1fr] gap-x-2 min-h-[80px] transition-all duration-300">
                        
                        {/* Col 1: Bus Info (Right Aligned) */}
                        <div className="flex flex-col items-end gap-2 py-2">
                            {stop.buses.length > 0 && stop.buses.map((bus, bi) => (
                                <div key={bi} className={`flex flex-col items-end gap-1 w-full animate-in fade-in slide-in-from-right-4 duration-300 
                                    ${bus.status === '0' ? 'mt-16' : 'mt-6'} 
                                `}>
                                    <div className={`border text-xs px-2 py-1 rounded-full shadow-sm flex items-center justify-end gap-1 whitespace-nowrap w-fit ml-auto transition-transform
                                        ${bus.status === '1' ? 'bg-white border-blue-500 text-blue-700' : 'bg-white border-teal-400 text-teal-600 border-dashed'}
                                    `}>
                                        <span className="font-bold">{bus.busPlate}</span>
                                        <span>{bus.status === '1' ? '🚌' : '🚍'}</span> 
                                        <span className="text-[10px] font-medium border-l border-blue-200 pl-1 ml-0.5">
                                            {bus.speed}km/h
                                        </span>
                                    </div>
                                    <div className="flex gap-1 justify-end w-full flex-wrap">
                                        {bus.busType && (
                                            <div className="text-[9px] bg-blue-100 text-blue-800 border border-blue-200 px-1.5 rounded-full shadow-sm whitespace-nowrap">
                                                {getBusTypeLabel(bus.busType)}
                                            </div>
                                        )}
                                        {bus.isFacilities === '1' && (
                                            <div className="text-[9px] bg-blue-100 text-blue-800 border border-blue-200 px-1 rounded-full shadow-sm" title="Wheelchair Accessible">
                                                ♿
                                            </div>
                                        )}
                                        {parseInt(bus.passengerFlow) > -1 && (
                                            <div className="text-[9px] bg-purple-100 text-purple-800 border border-purple-200 px-1.5 rounded-full shadow-sm whitespace-nowrap">
                                                👤 {bus.passengerFlow}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Col 2: Timeline (Line + Dot) */}
                        <div className="relative z-0 flex flex-col items-center pt-8">
                            {/* Connecting Line (Only if not last stop) */}
                            {index < stops.length - 1 && (
                                <div className={`absolute top-10 bottom-[-32px] w-1.5 z-[-1] transition-colors duration-500
                                    ${(!segmentTraffic || segmentTraffic <= 0) ? 'bg-gray-300' : ''}
                                    ${segmentTraffic == 1 ? 'bg-green-500' : ''}
                                    ${segmentTraffic == 2 ? 'bg-yellow-400' : ''}
                                    ${segmentTraffic >= 3 ? 'bg-red-500' : ''}
                                `}></div>
                            )}
                             {/* Stop Dot */}
                             <div className={`relative z-10 w-3.5 h-3.5 rounded-full border-2 bg-white ${
                                stop.buses.some(b => b.status === '1') 
                                ? 'border-blue-500 ring-2 ring-blue-200'
                                : segmentTraffic >= 3 
                                  ? 'border-red-500' 
                                  : segmentTraffic === 2 
                                    ? 'border-yellow-500' 
                                    : segmentTraffic === 1
                                      ? 'border-green-500'
                                      : 'border-gray-300'
                            }`}></div>
                        </div>

                        {/* Col 3: Stop Details */}
                        <div className="py-2 pl-1 pt-8"> 
                            <div className="font-bold text-gray-800 text-sm leading-tight">{index + 1}. {stop.staName}</div>
                            <div className="text-xs text-gray-400 mt-1 flex gap-2 items-center flex-wrap">
                                <span>{stop.staCode}</span>
                                {stop.laneName && <span className="text-teal-600 bg-teal-50 px-1 rounded border border-teal-100">{stop.laneName}</span>}
                            </div>
                        </div>

                    </div>
                );
            })}
        </div>
    );
};

export default BusList;


