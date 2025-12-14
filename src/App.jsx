import { useState, useEffect, useRef } from 'react';
import MapComponent from './components/MapComponent';
import BusList from './components/BusList';
import RouteDashboard from './components/RouteDashboard';
import NearbyStops from './components/NearbyStops';
import { fetchRouteDataApi, fetchTrafficApi, fetchBusListApi, fetchMapLocationApi } from './services/api';

function App() {
  const [routeNo, setRouteNo] = useState(''); // Input value
  const [activeRoute, setActiveRoute] = useState(''); // Actual confirmed route for fetching
  const [direction, setDirection] = useState('0'); // '0' or '1'
  const [busData, setBusData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasOppositeDirection, setHasOppositeDirection] = useState(true); // Default true until checked
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [mapBuses, setMapBuses] = useState([]); // Buses for Map View (lat/lon)
  const [trafficData, setTrafficData] = useState([]); // Traffic Info (Array of Segments)
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showNearby, setShowNearby] = useState(false); // Last successful fetch time
  const [scrollToStop, setScrollToStop] = useState(null); // Stop code to scroll to after load

  // Ref to track active route for preventing race conditions (async fetches returning after route switch)
  const activeRouteRef = useRef('');
  const stopsRef = useRef([]);

  useEffect(() => {
      activeRouteRef.current = activeRoute;
  }, [activeRoute]);


  const executeSearch = async (routeToFetch, dirToFetch) => {
    if (!routeToFetch) return;
    setLoading(true);
    setError('');
    setActiveRoute(routeToFetch); 
    activeRouteRef.current = routeToFetch;
    
    // Only clear data if we are switching to a completely different route to avoid flash
    // If switching direction on same route, keep old data until new data arrives
    if (routeToFetch !== activeRoute) {
        setBusData(null);
        setMapBuses([]); 
        setTrafficData([]);
        setHasOppositeDirection(false); 
    }

    try {
        console.log(`Searching for Route: ${routeToFetch}, Dir: ${dirToFetch}`);
        
        // 1. Fetch Route Stops
        const data = await fetchRouteDataApi(routeToFetch, dirToFetch);
        
        if (activeRouteRef.current !== routeToFetch) return;

        if (data && data.data && data.data.routeInfo && data.data.routeInfo.length > 0) {
             const stops = data.data.routeInfo.map(stop => ({
                 ...stop,
                 buses: [],
                 trafficLevel: 0
             }));
             
             setBusData({
                 stops: stops,
                 buses: [],
                 raw: data.data,
                 direction: dirToFetch // Track direction to prevent race conditions during toggle
             });
             
             fetchRealtimeBus(routeToFetch, dirToFetch, stops);

             // 2. Probe Opposite Direction
             const oppositeDir = dirToFetch === '0' ? '1' : '0';
             try {
                  const oppositeData = await fetchRouteDataApi(routeToFetch, oppositeDir);
                  if (oppositeData && oppositeData.data && oppositeData.data.routeInfo && oppositeData.data.routeInfo.length > 0) {
                      if (activeRouteRef.current === routeToFetch) setHasOppositeDirection(true);
                  } else {
                      if (activeRouteRef.current === routeToFetch) setHasOppositeDirection(false);
                  }
             } catch (probeError) {
                  console.log("Opposite direction probe failed:", probeError);
                  if (activeRouteRef.current === routeToFetch) setHasOppositeDirection(false);
             }

        } else {
            setError("Route not found or empty data.");
        }

    } catch (err) {
        console.error("Search Error:", err);
        setError(err.message || "Failed to fetch route data");
    } finally {
        if (activeRouteRef.current === routeToFetch) setLoading(false);
    }
  };

  // Scroll to target stop when data loads
  useEffect(() => {
      if (scrollToStop && busData && busData.stops) {
          // Small delay to ensure DOM is rendered
          setTimeout(() => {
              // Normalize the stop code for ID matching
              const normalizedCode = scrollToStop.replace(/[/_]/g, '-');
              const baseCode = scrollToStop.split(/[/_-]/)[0];
              
              // Try multiple ID formats
              let el = document.getElementById(`stop-${scrollToStop}`);
              if (!el) el = document.getElementById(`stop-${normalizedCode}`);
              if (!el) {
                  // Try to find by base code (e.g., T309 matches T309-1)
                  const allStops = document.querySelectorAll('[id^="stop-"]');
                  for (const stopEl of allStops) {
                      const stopBase = stopEl.id.replace('stop-', '').split(/[/_-]/)[0];
                      if (stopBase === baseCode) {
                          el = stopEl;
                          break;
                      }
                  }
              }
              
              if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.classList.add('ring-2', 'ring-teal-400');
                  setTimeout(() => el.classList.remove('ring-2', 'ring-teal-400'), 2000);
              }
              setScrollToStop(null);
          }, 500);
      }
  }, [scrollToStop, busData]);

  const handleBack = () => {
      setBusData(null);
      setActiveRoute('');
      setMapBuses([]);
      setTrafficData([]);
      setViewMode('list');
      setHasOppositeDirection(true);
  };

  const handleSearch = () => {
    executeSearch(routeNo, direction);
  };

  const handleSelectRoute = (route, dir = '0') => {
      setRouteNo(route);
      setDirection(dir);
      setViewMode('list');
      executeSearch(route, dir);
  };
  
  const fetchRealtimeBus = async (rNo, dir, currentStops) => {
      // routeType varies (N2=0, N3=2, 33=2). 
      const typesToProbe = ['0', '2'];
      
      // Parallel Probe for bus list data
      const promises = typesToProbe.map(type => fetchBusListApi(rNo, dir, type));

      // Also start Traffic Fetch
      const trafficPromise = fetchTrafficApi(rNo.replace(/^0+/, ''), dir);

      try {
          const results = await Promise.all([...promises, trafficPromise]);
          
          // Guard: Race Condition Check
          if (activeRouteRef.current !== rNo) {
             console.log(`Ignoring stale result for ${rNo} (Current: ${activeRouteRef.current})`);
             return; 
          }

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
                           // Traffic result is array of segments. 
                           // Actually trafficResult is segments array from new API logic.
                           // Need to map segments to stops if we want color? 
                           // Current implementation just passes trafficResult to MapComponent.
                           // Timeline uses stop.trafficLevel.
                           trafficLevel: 0 // Placeholder as traffic logic was simplified in extracted API
                       };
                   }
                   return { ...stop, buses: [], trafficLevel: 0 };
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
      try {
        const data = await fetchMapLocationApi(rNo, dir);

        // Guard: Race Condition Check
        if (activeRouteRef.current !== rNo) {
            console.log(`Ignoring stale Map result for ${rNo}`);
            return;
        }
        
        setLastUpdated(new Date()); // Update timestamp

        // Must match fixed logic: busInfoList might be at root
        const busList = data.busInfoList || (data.data && data.data.busInfoList);

        if (busList && busList.length > 0) {
            console.log("Map GPS Buses found:", busList.length);
            setMapBuses(busList);
        } else {
             // console.log("Location API empty (or no buses). Trying List API fallback...");
             const typesToProbe = ['0', '2'];
             
             // Try to fetch detailed list data for hydration
             let found = false;
             for (const type of typesToProbe) {
                 if (found) break;
                 const busRes = await fetchBusListApi(rNo, dir, type);
                 
                 if (activeRouteRef.current !== rNo) return; // Guard

                 if (busRes.data && busRes.data.data && busRes.data.data.routeInfo) {
                    let allBuses = [];
                    
                    busRes.data.data.routeInfo.forEach(stop => {
                        if (stop.busInfo) {
                            // Inject staCode so MapComponent can hydrate location
                            const busesAtStop = stop.busInfo.map(b => ({
                                ...b,
                                staCode: stop.staCode
                            }));
                            allBuses = [...allBuses, ...busesAtStop];
                        }
                    });

                    if (allBuses.length > 0) {
                        console.log("Fallback Buses found (with staCode):", allBuses);
                        setMapBuses(allBuses);
                        found = true;
                    }
                 }
             }
             if (!found && activeRouteRef.current === rNo) setMapBuses([]);
        }

        // Fetch Traffic INDEPENDENTLY of location success/fail
        try {
            const traffic = await fetchTrafficApi(rNo.replace(/^0+/, ''), dir);
            if (activeRouteRef.current === rNo) setTrafficData(traffic);
        } catch (tErr) {
            console.log("Traffic fetch failed:", tErr);
        }
      } catch (e) {
          console.error("Map Bus Fetch Error:", e);
          if (activeRouteRef.current === rNo) setMapBuses([]);
      }
  };

  const toggleDirection = async () => {
      const newDir = direction === '0' ? '1' : '0';
      setDirection(newDir);
      
      // Use executeSearch to handle data fetching with "no-flash" logic
      if (activeRoute) {
          executeSearch(activeRoute, newDir);
      }
  };

  // Auto Refresh Interval
      // Update ref whenever stops change, so interval views fresh data
      useEffect(() => {
          if (busData && busData.stops) {
              stopsRef.current = busData.stops;
          }
      }, [busData]);

      useEffect(() => {
          // Reset data on route/dir swap
          // setBusData(...); // Managed by logic

          let interval;
          // Depend on activeRoute!
          if (activeRoute) {
              // Guard: If we are switching directions (busData.direction matches OLD, direction matches NEW), 
              // DO NOT run interval/fetch. Wait for executeSearch to update busData with new direction.
              if (busData && busData.direction !== direction) {
                  console.log("Skipping interval during direction switch...");
                  return;
              }

              // Immediate fetch on switch (only if not just a data refresh re-trigger)
              if (viewMode === 'map') {
                  fetchBusLocation(activeRoute, direction);
              } else {
                  if (stopsRef.current.length > 0) {
                     fetchRealtimeBus(activeRoute, direction, stopsRef.current);
                     
                     // Also fetch traffic for List View coloring
                     fetchTrafficApi(activeRoute.replace(/^0+/, ''), direction)
                        .then(traffic => {
                            if (activeRouteRef.current === activeRoute) setTrafficData(traffic);
                        })
                        .catch(console.error);
                  }
              }

              interval = setInterval(() => {
                   if (viewMode === 'map') {
                      fetchBusLocation(activeRoute, direction);
                   } else {
                      // Use ref to get latest stops without re-triggering effect
                      fetchRealtimeBus(activeRoute, direction, stopsRef.current);

                      // Refresh Traffic too
                      fetchTrafficApi(activeRoute.replace(/^0+/, ''), direction)
                       .then(traffic => {
                           if (activeRouteRef.current === activeRoute) setTrafficData(traffic);
                       })
                       .catch(e => console.error("Traffic interval error:", e));
                   }
              }, 3000); // 3-second refresh
          }
          return () => clearInterval(interval);
      }, [activeRoute, direction, viewMode]); // Removed busData dependency

  // Debug: Monitor Map Buses
  useEffect(() => {
    if (viewMode === 'map' && mapBuses.length > 0) {
        // console.log("Current Map Buses State:", mapBuses);
        const coords = mapBuses.map(b => {
            if (b.latitude && b.longitude) {
                return `${b.busPlate}: ${b.latitude}, ${b.longitude} (Speed: ${b.speed})`;
            }
            return `${b.busPlate}: Station ${b.staCode} (Fallback)`;
        });
        console.log("Bus Locations Update:", coords);
    }
  }, [mapBuses, viewMode]);

  return (
    <div className="h-screen bg-gray-100 font-sans overflow-hidden">
      <div className="max-w-md mx-auto bg-white h-full shadow-lg flex flex-col relative">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white p-4 shadow-md sticky top-0 z-10">
          <div className="flex justify-between items-center mb-4">
             <h1 
                className="text-2xl font-bold tracking-tight cursor-pointer flex items-center gap-2"
                onClick={() => {
                    setBusData(null);
                    setTrafficData(null);
                    setActiveRoute('');
                    setRouteNo('');
                    setShowNearby(false);
                    setViewMode('dashboard');
                }}
             >
                {busData && (
                    <button 
                        onClick={handleBack}
                        className="mr-1 hover:bg-white/20 rounded-full p-1 transition"
                        title="Back"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg>
                    </button>
                )}
                {!busData && "🚍"} Macau Bus
             </h1>
             <button 
                onClick={() => setShowNearby(true)}
                className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition backdrop-blur-sm"
                title="Nearby Stops"
             >
                📍
             </button>
          </div>

          {!busData && !showNearby && (
             <div className="text-teal-100 text-sm mb-4">
                Real-time bus tracking & traffic
             </div>
          )}
          
          {/* Search Bar - Only show on Home Screen */}
          {!busData && !showNearby && (
             <div className="flex gap-2">
               <input 
                 type="text" 
                 value={routeNo} 
                 onChange={(e) => setRouteNo(e.target.value)} 
                 placeholder="Route No. (e.g. 33, N2)"
                 className="flex-1 text-gray-800 border-0 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-white/50 shadow-inner"
               />
               <button 
                 onClick={handleSearch}
                 className="bg-white text-teal-600 px-6 py-3 rounded font-bold hover:bg-teal-50 shadow-lg transition"
               >
                 GO
               </button>
             </div>
          )}
          
          {/* Active Route Header (Compact) */}
          {busData && (
              <div className="flex items-center gap-3 bg-white/10 p-2 rounded-lg backdrop-blur-md">
                 <div className="bg-white text-teal-600 font-bold px-3 py-1 rounded text-xl shadow">
                    {activeRoute}
                 </div>
                 <div className="flex-1 min-w-0">
                    <div className="text-xs text-teal-100 uppercase font-semibold tracking-wider">To Destination</div>
                    <div className="font-medium truncate">{busData.stops[busData.stops.length-1]?.staName}</div>
                 </div>
              </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-y-auto relative">
            
            {/* 1. Nearby Stops Modal */}
            {showNearby && (
                <NearbyStops 
                    onClose={() => setShowNearby(false)}
                    onSelectRoute={(route, stopCode, dir) => {
                        handleSelectRoute(route, dir || '0');
                        if (stopCode) setScrollToStop(stopCode);
                        setShowNearby(false);
                    }}
                />
            )}

            {/* 2. Route Dashboard (Route List) */}
            {!busData && !showNearby && (
                <RouteDashboard onSelectRoute={handleSelectRoute} />
            )}

            {/* 3. Active Bus Detail View */}
            {busData && !showNearby && (
                <div className="flex-1 flex flex-col relative">
                    
                     {/* Controls Bar */}
                     <div className="bg-white border-b px-4 py-2 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                        
                         {/* View Toggle */}
                         <div className="bg-gray-100 p-1 rounded-lg flex">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${viewMode === 'list' ? 'bg-white shadow text-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                List
                            </button>
                            <button
                                onClick={() => setViewMode('map')}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${viewMode === 'map' ? 'bg-white shadow text-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Map
                            </button>
                        </div>

                        {/* Direction Toggle */}
                        {hasOppositeDirection && (
                            <button 
                                onClick={toggleDirection}
                                className="bg-teal-50 text-teal-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-teal-100 transition flex items-center gap-1"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                                Switch Dir
                            </button>
                        )}
                     </div>

                     {/* Refresh Status */}
                     <div className="bg-gray-50 px-4 py-1 flex justify-between items-center text-[10px] text-gray-400 border-b">
                        <span>
                             {lastUpdated ? `Updated: ${lastUpdated.toLocaleTimeString()}` : 'Connecting...'}
                        </span>
                        <button 
                            onClick={() => {
                                if (viewMode === 'map') fetchBusLocation(activeRoute, direction);
                                else fetchRealtimeBus(activeRoute, direction, stopsRef.current);
                            }}
                            className="hover:text-teal-600 flex items-center gap-1"
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Refresh
                        </button>
                     </div>

                     <div className="flex-1 overflow-y-auto relative bg-white">
                        {/* Active Buses Banner */}
                        {busData.buses.length > 0 ? (
                            <div className="bg-green-50/80 backdrop-blur px-4 py-2 border-b border-green-100 text-xs font-medium text-green-700 flex items-center gap-2 sticky top-0 z-10">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                                {busData.buses.length} buses live on route
                            </div>
                        ) : (
                             <div className="bg-yellow-50/80 backdrop-blur px-4 py-2 border-b border-yellow-100 text-xs font-medium text-yellow-700 sticky top-0 z-10">
                                {mapBuses.some(b => b.staCode) ? 
                                    "⚠️ GPS Weak - Tracking by Station" : 
                                    "connecting to bus network..."}
                            </div>
                        )}

                        {viewMode === 'list' ? (
                            <BusList stops={busData.stops} trafficData={trafficData} />
                        ) : (
                             /* Map Component Container */
                            <div className="h-[500px] w-full relative">
                                <MapComponent 
                                    stations={busData.stops} 
                                    buses={mapBuses}
                                    traffic={trafficData}
                                />
                             </div>
                        )}
                     </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}

export default App;
