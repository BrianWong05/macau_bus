import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import jsMd5 from 'js-md5';
import MapComponent from './components/MapComponent';

function App() {
  const [routeNo, setRouteNo] = useState('');
  const [direction, setDirection] = useState('0'); // '0' or '1'
  const [busData, setBusData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasOppositeDirection, setHasOppositeDirection] = useState(true); // Default true until checked
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [mapBuses, setMapBuses] = useState([]); // Buses for Map View (lat/lon)
  const [trafficData, setTrafficData] = useState([]); // Traffic Info (Array of Segments)

  const isDev = import.meta.env.DEV;

  // Reverse-engineered Token Logic
  const generateDsatToken = (params) => {
    let queryString = "";
    Object.keys(params).forEach((key, index) => {
        queryString += (index === 0 ? "" : "&") + key + "=" + params[key];
    });
    
    const dirtyHash = jsMd5(queryString);
    const date = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const YYYY = date.getFullYear();
    const MM = pad(date.getMonth() + 1);
    const DD = pad(date.getDate());
    const HH = pad(date.getHours());
    const mm = pad(date.getMinutes());
    const timeStr = `${YYYY}${MM}${DD}${HH}${mm}`;
    
    let arr = dirtyHash.split("");
    const part3 = timeStr.slice(8);
    const part2 = timeStr.slice(4, 8);
    const part1 = timeStr.slice(0, 4);
    
    arr.splice(24, 0, part3);
    arr.splice(12, 0, part2);
    arr.splice(4, 0, part1);
    
    return arr.join("");
  };

  // Helper function to fetch route data for probing
  const fetchRouteDataInternal = async (rNo, dir) => {
        const date = new Date();
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        const request_id = `${yyyy}${mm}${dd}${hh}${min}${ss}`;

        const params = {
            routeName: rNo,
            dir: dir,
            lang: 'zh-tw',
            device: 'web'
        };

        const token = generateDsatToken(params);
        const qs = new URLSearchParams(params).toString();
        
        const targetUrl = isDev 
            ? `/macauweb/getRouteData.html`
            : `https://cors-anywhere.herokuapp.com/https://bis.dsat.gov.mo:37812/macauweb/getRouteData.html`;

        try {
             const response = await axios.post(targetUrl, qs, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'token': token
                }
            });
            return response.data;
        } catch (e) {
            console.error("Fetch Route Failed:", e);
            throw e;
        }
  };

  const handleSearch = async () => {
    if (!routeNo) return;
    setLoading(true);
    setError('');
    setBusData(null);
    setHasOppositeDirection(false); // Default false, enable only if probe succeeds

    try {
        console.log(`Searching for Route: ${routeNo}, Dir: ${direction}`);
        
        // 1. Fetch Route Stops (JSON API) using helper
        const data = await fetchRouteDataInternal(routeNo, direction);

        if (data && data.data && data.data.routeInfo && data.data.routeInfo.length > 0) {
             const stops = data.data.routeInfo;
             const routeName = data.data.routeCode; // e.g., 00033
             
             // Initial bus load
             fetchRealtimeBus(routeNo, direction, stops);

             // 2. Probe Opposite Direction for UI Toggle
             const oppositeDir = direction === '0' ? '1' : '0';
             console.log(`Probing opposite direction: ${oppositeDir}`);
             try {
                 const oppositeData = await fetchRouteDataInternal(routeNo, oppositeDir);
                 if (oppositeData && oppositeData.data && oppositeData.data.routeInfo && oppositeData.data.routeInfo.length > 0) {
                     console.log("Opposite direction exists.");
                     setHasOppositeDirection(true);
                 } else {
                     console.log("Opposite direction empty/invalid.");
                     setHasOppositeDirection(false);
                 }
            } catch (probeError) {
                 console.log("Opposite direction probe failed:", probeError);
                 setHasOppositeDirection(false);
             }

        } else {
            setError("Route not found or empty data.");
        }

    } catch (err) {
        console.error("Search Error:", err);
        setError(err.message || "Failed to fetch route data");
    } finally {
        setLoading(false);
    }
  };

  // Helper to map busType
  const getBusTypeLabel = (type) => {
      switch(type) {
          case '1': return 'Large'; // 大巴
          case '2': return 'Medium'; // 中巴
          case '3': return 'Small'; // 小巴
          default: return type;
      }
  };

  // Fetch Traffic Data (Official Endpoint)
  // https://bis.dsat.gov.mo:37812/ddbus/common/supermap/route/traffic
  const fetchTrafficData = async (rNoRaw, dir) => {
    try {
        const routeCodePadded = '000' + rNoRaw; // e.g. 00033
        
        const params = {
            lang: 'zh_tw', 
            routeCode: routeCodePadded,
            direction: dir,
            indexType: '00',
            device: 'web',
            categoryIds: 'BCAFBD938B8D48B0B3F598B44DD32E6C'
            // request_id: Excluded as per official payload
        };
        
        const token = generateDsatToken(params);
        
        const qs = new URLSearchParams(params).toString();
        // Use the OFFICIAL endpoint found by inspector
        const targetUrl = isDev 
            ? `/ddbus/common/supermap/route/traffic?${qs}&token=${token}`
            : `https://cors-anywhere.herokuapp.com/https://bis.dsat.gov.mo:37812/ddbus/common/supermap/route/traffic?${qs}&token=${token}`;

        console.log("Fetching Traffic/Route from:", targetUrl);

        // POST request as per official behavior
        const response = await axios.post(isDev ? '/ddbus/common/supermap/route/traffic' : 'https://cors-anywhere.herokuapp.com/https://bis.dsat.gov.mo:37812/ddbus/common/supermap/route/traffic',
             qs,
             {
                 headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'token': token,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json, text/javascript, */*; q=0.01'
                 }
             }
        );
        
        if (response.data && Array.isArray(response.data.data)) {
             const dataList = response.data.data;
             console.log("Traffic Data Array:", dataList.length);
             
             // Map data to segments
             // Each item likely corresponds to a stop index.
             // We return a list of objects: { coords: [[lat,lon], ...], traffic: level }
             const segments = dataList.map(item => {
                 let coords = [];
                 if (item.routeCoordinates) {
                     coords = item.routeCoordinates.split(';').filter(s => s).map(pair => {
                         const [lon, lat] = pair.split(',');
                         return [parseFloat(lat), parseFloat(lon)];
                     });
                 }
                 return {
                     traffic: item.newRouteTraffic || item.routeTraffic,
                     path: coords
                 };
             });

             return segments;
        }
        return [];
    } catch (e) {
        console.error("Traffic Fetch Error:", e);
        return [];
    }
  };

  const fetchRealtimeBus = async (rNo, dir, currentStops) => {
      // routeType varies (N2=0, N3=2, 33=2). 
      // Without a map, we probe both 0 and 2.
      const typesToProbe = ['0', '2'];
      
      // Parallel Probe for bus data
      const promises = typesToProbe.map(type => {
          const params = {
              action: 'dy',
              routeName: rNo,
              dir: dir,
              lang: 'zh-tw',
              routeType: type,
              device: 'web'
          };
          const token = generateDsatToken(params);
          return axios.post(isDev ? '/macauweb/routestation/bus' : 'https://cors-anywhere.herokuapp.com/https://bis.dsat.gov.mo:37812/macauweb/routestation/bus', 
              new URLSearchParams(params).toString(), 
              { 
                  headers: { 
                      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                      'token': token
                  } 
              }
          ).then(res => ({ type, data: res.data }))
           .catch(err => ({ type, error: err }));
      });

      // Also start Traffic Fetch
      const trafficPromise = fetchTrafficData(rNo, dir);

      try {
          const results = await Promise.all([...promises, trafficPromise]);
          const trafficResult = results.pop(); // Last one is traffic

          // Find successful bus result...
          const validResult = results.find(r => r.data && r.data.header === '000');
          
          if (validResult && validResult.data && validResult.data.data && validResult.data.data.routeInfo) {
              console.log(`Found valid data with routeType=${validResult.type}`);
              const realtimeStops = validResult.data.data.routeInfo;
              
              // Merge bus info and traffic into currentStops
              const updatedStops = currentStops.map(stop => {
                   const matchingStop = realtimeStops.find(rs => rs.staCode === stop.staCode);
                   if (matchingStop) {
                       return {
                           ...stop,
                           // Update Buses
                           buses: (matchingStop.busInfo || []).map(b => ({
                               ...b,
                               status: b.status, // 0=Moving, 1=Arrived
                               speed: b.speed,
                               busPlate: b.busPlate,
                               busType: b.busType,
                               isFacilities: b.isFacilities,
                               passengerFlow: b.passengerFlow
                           })),
                           // If traffic data has a key for this stop?
                           trafficLevel: trafficResult[stop.staCode] || trafficResult[stop.busstopcode] || 0
                       };
                   }
                   return { ...stop, buses: [], trafficLevel: trafficResult[stop.staCode] || trafficResult[stop.busstopcode] || 0 };
              });
              
              // Extract all active buses for summary
              const allBuses = updatedStops.flatMap(s => s.buses).map(b => ({
                  ...b,
                  plate: b.busPlate,
                  speed: b.speed
              }));

              setBusData(prev => ({
                  ...prev,
                  stops: updatedStops,
                  buses: allBuses
              }));
          } else {
             console.warn("No valid realtime data found in probes:", results);
          }
      } catch (e) {
          console.error("Realtime fetch failed", e);
      }
  };

  const fetchBusLocation = async (rNo, dir) => {
      // Generate request_id
      const date = new Date();
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      const ss = String(date.getSeconds()).padStart(2, '0');
      const request_id = `${yyyy}${mm}${dd}${hh}${min}${ss}`;

      // Map View API: User confirmed exact payload structure that works for padded codes.
      // Must include routeName, lang. Must EXCLUDE request_id.
      // routeCode must be PADDED (e.g. 00033).
      const routeCodePadded = rNo.length === 2 ? '000' + rNo : (rNo.length === 3 ? '00' + rNo : rNo);
      
      console.log("Fetching Map Location for:", routeCodePadded, dir);

      const params = {
          routeName: rNo,      // e.g. "33"
          dir: dir,
          lang: 'zh-tw',
          routeCode: routeCodePadded, // e.g. "00033"
          device: 'web'
          // request_id: REMOVED as it causes 500 with padded codes
      };
      const token = generateDsatToken(params);

      try {
        const res = await axios.post(isDev ? '/macauweb/routestation/location' : 'https://cors-anywhere.herokuapp.com/https://bis.dsat.gov.mo:37812/macauweb/routestation/location',
            new URLSearchParams(params).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'token': token,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json, text/javascript, */*; q=0.01'
                }
            }
        );

        if (res.data && res.data.data && res.data.data.busInfoList && res.data.data.busInfoList.length > 0) {
            console.log("Map Bus Locations found:", res.data.data.busInfoList);
            setMapBuses(res.data.data.busInfoList);
        } else {
             console.log("Location API empty (or no buses). Trying List API fallback...");
             
             // Define routeCodeRaw for fallback (routestation/bus expects raw "33")
             const routeCodeRaw = rNo.replace(/^0+/, ''); 

             try {
                const busParams = {
                    action: 'dy',
                    routeName: routeCodeRaw,
                    dir: dir,
                    lang: 'zh-tw',
                    device: 'web'
                };
                const busToken = generateDsatToken(busParams);
                const busRes = await axios.post(isDev ? '/macauweb/routestation/bus' : 'https://cors-anywhere.herokuapp.com/https://bis.dsat.gov.mo:37812/macauweb/routestation/bus',
                    new URLSearchParams(busParams).toString(),
                    { headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'token': busToken } }
                );
                if (busRes.data && busRes.data.data && busRes.data.data.routeInfo) {
                    let allBuses = [];
                    busRes.data.data.routeInfo.forEach(stop => {
                        if (stop.busInfo) allBuses = [...allBuses, ...stop.busInfo];
                    });
                    console.log("Fallback Buses found:", allBuses);
                    setMapBuses(allBuses); 
                } else {
                    setMapBuses([]);
                }
             } catch (fallbackErr) {
                 console.log("Fallback API failed:", fallbackErr);
                 setMapBuses([]);
             }
        }

        // Fetch Traffic INDEPENDENTLY of location success/fail
        try {
            const traffic = await fetchTrafficData(rNo.replace(/^0+/, ''), dir);
            setTrafficData(traffic);
        } catch (tErr) {
            console.log("Traffic fetch failed:", tErr);
        }
      } catch (e) {
          console.error("Map Bus Fetch Error:", e);
          setMapBuses([]);
      }
  };

  const toggleDirection = async () => {
      const newDir = direction === '0' ? '1' : '0';
      setDirection(newDir);
      
      // Seamlessly fetch new direction data without clearing current view immediately
      if (routeNo) {
          try {
             // Optional: visual indicator on button could go here
             const data = await fetchRouteDataInternal(routeNo, newDir);
             if (data && data.data && data.data.routeInfo && data.data.routeInfo.length > 0) {
                 const routeInfo = data.data.routeInfo;
                 const stops = routeInfo.map(stop => ({
                    ...stop,
                    buses: [] // Initialize empty buses array for each stop to prevent render error
                 }));

                 setBusData({
                    stops: stops,
                    buses: [], // Will be filled by auto-refresh or immediate trigger
                    raw: data.data
                 });
                 // Trigger immediate bus update for new stops
                 fetchRealtimeBus(routeNo, newDir, stops);
             }
          } catch (e) {
              console.error("Failed to switch direction", e);
              // Fallback? Keep existing view or show error?
          }
      }
  };

  // Auto Refresh Interval
  useEffect(() => {
      let interval;
      if (busData && routeNo) {
          // Immediate fetch on switch
          if (viewMode === 'map') {
              fetchBusLocation(routeNo, direction);
          } else {
             // list view update
             fetchRealtimeBus(routeNo, direction, busData.stops);
          }

          interval = setInterval(() => {
              console.log(`Auto-refreshing data (${viewMode})...`);
              if (viewMode === 'map') {
                  fetchBusLocation(routeNo, direction);
              } else {
                  // Pass current stops so we don't lose structure, but update content
                  fetchRealtimeBus(routeNo, direction, busData.stops);
              }
          }, 5000);
      }
      return () => clearInterval(interval);
  }, [busData, routeNo, direction, viewMode]); // Added viewMode dependency

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6">
        <h1 className="text-xl font-bold mb-4 text-center text-teal-600">Macau Bus Waiting</h1>
        
        {/* Search Input */}
        <div className="flex gap-2 mb-4">
          <input 
            type="text" 
            value={routeNo} 
            onChange={(e) => setRouteNo(e.target.value)} 
            placeholder="Route No. (e.g. 33, N2)"
            className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button 
            onClick={handleSearch}
            className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600 transition"
          >
            Search
          </button>
        </div>

        {/* Direction Toggle - Hidden if no opposite direction or no data */}
        {busData && hasOppositeDirection && (
            <div className="flex justify-center mb-4 gap-4">
                <button 
                    onClick={toggleDirection}
                    className="text-sm text-teal-600 underline"
                >
                    Switch Direction (Current: {direction === '0' ? 'Forward' : 'Backward'})
                </button>
            </div>
        )}

        {/* View Toggle (List | Map) */}
        {busData && (
             <div className="flex justify-center mb-4">
                <div className="bg-gray-200 p-1 rounded-lg flex">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`px-4 py-1 rounded-md text-sm transition ${viewMode === 'list' ? 'bg-white shadow text-teal-600 font-bold' : 'text-gray-500'}`}
                    >
                        List
                    </button>
                    <button
                        onClick={() => setViewMode('map')}
                        className={`px-4 py-1 rounded-md text-sm transition ${viewMode === 'map' ? 'bg-white shadow text-teal-600 font-bold' : 'text-gray-500'}`}
                    >
                        Map
                    </button>
                </div>
             </div>
        )}

        {/* Refresh Button - Only for List View? Or both? */}
        {busData && viewMode === 'list' && (
           <div className="flex justify-end mb-2">
             <button 
               onClick={() => fetchRealtimeBus(routeNo, direction, busData.stops)}
               className="text-gray-500 text-sm flex items-center gap-1 hover:text-teal-600"
             >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
               </svg>
               Refresh
             </button>
           </div>
        )}

        {/* Loading / Error */}
        {loading && <p className="text-center text-gray-500">Loading...</p>}
        {error && <p className="text-center text-red-500 text-sm">{error}</p>}

        {/* Results */}
        {busData && (
          <div className="border-t pt-4">
             <h2 className="text-lg font-semibold mb-2">Route: {routeNo}</h2>
             <div className="space-y-2">
                {/* 
                   We need to display the list of stops.
                   If we have bus locations, we should mark them.
                   Since busInfo structure is unknown (empty in debug), 
                   we will list all stops and list any buses at the top if unmatchable.
                */}
                
                {/* Active Buses Summary */}
                {busData.buses.length > 0 ? (
                    <div className="bg-green-50 p-2 rounded mb-2 text-sm text-green-800">
                        {busData.buses.length} Active Buses Found.
                        {/* Try to dump bus info if available */}
                        <pre className="text-xs overflow-auto max-h-20">{JSON.stringify(busData.buses, null, 2)}</pre>
                    </div>
                ) : (
                    <div className="bg-yellow-50 p-2 rounded mb-2 text-sm text-yellow-800">
                        No active buses found (or API restriction).
                    </div>
                )}

                {/* Stops List (Timeline) */}
                {busData && viewMode === 'list' && (
                    <div className="relative pl-4 border-l-2 border-gray-200 ml-4 space-y-8 pb-10">
                        {busData.stops.map((stop, index) => (
                            <div key={stop.busstopcode || index} className="relative">
                                {/* Timeline Line Segment (Connects to next stop) */}
                                {index < busData.stops.length - 1 && (
                                    <div className={`absolute left-0 top-2 bottom-[-40px] w-1.5 z-0 transition-colors duration-500
                                        ${(!stop.trafficLevel || stop.trafficLevel <= 0) ? 'bg-gray-300' : ''}
                                        ${stop.trafficLevel == 1 ? 'bg-green-500' : ''}
                                        ${stop.trafficLevel == 2 ? 'bg-yellow-400' : ''}
                                        ${stop.trafficLevel >= 3 ? 'bg-red-500' : ''}
                                    `}>
                                    </div>
                                )}
                                
                                {/* Stop Dot */}
                                <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 ${
                                    stop.buses.some(b => b.status === '1') 
                                    ? 'bg-blue-500 border-blue-500 animate-pulse'
                                    : stop.trafficLevel >= 3 
                                      ? 'bg-white border-red-500' 
                                      : stop.trafficLevel === 2 
                                        ? 'bg-white border-yellow-500' 
                                        : stop.trafficLevel === 1
                                          ? 'bg-white border-green-500'
                                          : 'bg-white border-gray-300'
                                }`}></div>
                                
                                {/* Arrived Buses (Status 1) */}
                                {stop.buses.filter(b => b.status === '1').length > 0 && (
                                     <div className="absolute top-0 -left-36 w-32 flex flex-col items-end gap-1 z-20 transform -translate-y-1">
                                        {stop.buses.filter(b => b.status === '1').map((bus, bi) => (
                                            <div key={bi} className="flex flex-col items-end gap-1 z-20 w-full">
                                                <div className="bg-white border border-blue-500 text-blue-700 text-xs px-2 py-1 rounded-full shadow-sm flex items-center justify-end gap-1 whitespace-nowrap w-full">
                                                    <span className="font-bold">{bus.busPlate}</span>
                                                    <span>🚌</span>
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
                                )}
                                
                                 {/* Stop Name & Code */}
                                <div className="pl-4"> 
                                    <div className="font-bold text-gray-800 text-sm leading-none">{index + 1}. {stop.staName}</div>
                                    <div className="text-xs text-gray-400 mt-1 flex gap-2 items-center">
                                        <span>{stop.staCode}</span>
                                        {stop.laneName && <span className="text-teal-600 bg-teal-50 px-1 rounded border border-teal-100">{stop.laneName}</span>}
                                    </div>
                                     {/* Traffic Status Text (Debug/Optional) */}
                                    {/* stop.trafficLevel > 0 && (
                                        <div className="text-[10px] text-gray-400 mt-0.5">
                                            Traffic: {stop.trafficLevel === 1 ? 'Smooth' : stop.trafficLevel === 2 ? 'Slow' : 'Congested'}
                                        </div>
                                    ) */}
                                </div>

                                {/* Moving Buses (Status 0) */}
                                {stop.buses.filter(b => b.status === '0').map((bus, bi) => (
                                    <div key={bi} className="absolute top-10 -left-36 w-32 flex justify-end z-0 transform -translate-y-1/2">
                                        <div className="flex flex-col items-end gap-1 w-full">
                                             {/* Bus Pill with Speed */}
                                             {/* Removed overflow-hidden to allow full width display if needed, but flex wrap helps */}
                                            <div className="bg-white border border-teal-500 text-teal-700 text-xs px-2 py-1 rounded-full shadow-sm flex items-center justify-end gap-0.5 whitespace-nowrap w-full">
                                                <span className="font-bold">{bus.busPlate}</span>
                                                <span>🚌</span>
                                                <span className="text-[10px] font-medium border-l border-teal-200 pl-1 ml-0.5">
                                                   {bus.speed}km/h
                                                </span>
                                            </div>

                                            {/* Additional Badges Row */}
                                            <div className="flex gap-1 justify-end w-full flex-wrap">
                                                {/* Bus Type Badge */}
                                                {bus.busType && (
                                                    <div className="text-[9px] bg-teal-50 text-teal-800 border border-teal-200 px-1.5 rounded-full shadow-sm whitespace-nowrap">
                                                        {getBusTypeLabel(bus.busType)}
                                                    </div>
                                                )}
                                                 {/* Wheelchair Badge */}
                                                {bus.isFacilities === '1' && (
                                                    <div className="text-[9px] bg-teal-50 text-teal-800 border border-teal-200 px-1 rounded-full shadow-sm" title="Wheelchair Accessible">
                                                        ♿
                                                    </div>
                                                )}
                                                {/* Passenger Flow Badge */}
                                                {parseInt(bus.passengerFlow) > -1 && (
                                                    <div className="text-[9px] bg-purple-50 text-purple-800 border border-purple-200 px-1.5 rounded-full shadow-sm whitespace-nowrap">
                                                        👤 {bus.passengerFlow}
                                                    </div>
                                                )}
                                            </div>

                                        </div>
                                        {/* Connector Line to Timeline */}
                                        <div className="absolute right-[-18px] top-1/2 w-4 h-[2px] bg-teal-300"></div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}

        {/* Map View */}
        {busData && viewMode === 'map' && (
            <MapComponent 
                stations={busData.stops} 
                buses={mapBuses} 
                traffic={trafficData} // Pass traffic segments
            />
        )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper for 1-based index
const orderIndex = (i) => i + 1 + ".";

export default App;
