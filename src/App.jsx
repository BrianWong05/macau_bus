import { useState, useEffect, useRef } from 'react';
import MapComponent from './components/MapComponent';
import BusList from './components/BusList';
import RouteDashboard from './components/RouteDashboard';
import NearbyStops from './components/NearbyStops';
import { useRouteData, AppHeader } from './features/route-tracker';
import { fetchTrafficApi } from './services/api';

function App() {
  const [routeNo, setRouteNo] = useState(''); // Input value
  const [activeRoute, setActiveRoute] = useState(''); // Actual confirmed route for fetching
  const [direction, setDirection] = useState('0'); // '0' or '1'
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [showNearby, setShowNearby] = useState(false);
  const [scrollToStop, setScrollToStop] = useState(null);

  // Use extracted hook for route data management
  const {
    busData,
    mapBuses,
    trafficData,
    loading,
    error,
    hasOppositeDirection,
    lastUpdated,
    executeSearch,
    fetchRealtimeBus,
    fetchBusLocation,
    setBusData,
    setMapBuses,
    setTrafficData,
    setLoading,
    setError,
    setHasOppositeDirection,
    activeRouteRef,
  } = useRouteData();

  const stopsRef = useRef([]);

  useEffect(() => {
      activeRouteRef.current = activeRoute;
  }, [activeRoute, activeRouteRef]);

  // Note: executeSearch is now provided by useRouteData hook

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
    setActiveRoute(routeNo); // Sync local state
    executeSearch(routeNo, direction);
  };

  const handleSelectRoute = (route, dir = '0') => {
      setRouteNo(route);
      setDirection(dir);
      setActiveRoute(route); // Sync local state
      setViewMode('list');
      executeSearch(route, dir);
  };
  
  // Note: fetchRealtimeBus and fetchBusLocation are now provided by useRouteData hook

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
        <AppHeader
          activeRoute={activeRoute}
          busData={busData}
          routeNo={routeNo}
          showNearby={showNearby}
          hasOppositeDirection={hasOppositeDirection}
          onBack={handleBack}
          onSearch={handleSearch}
          onSetRouteNo={setRouteNo}
          onToggleDirection={toggleDirection}
          onShowNearby={() => setShowNearby(true)}
          onResetToHome={() => {
            setBusData(null);
            setTrafficData(null);
            setActiveRoute('');
            setRouteNo('');
            setShowNearby(false);
            setViewMode('dashboard');
          }}
        />

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
