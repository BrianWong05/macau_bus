import { useState, useEffect, useRef } from 'react';
import MapComponent from '@/components/MapComponent';
import BusList from '@/components/BusList';
import RouteDashboard from '@/pages/RouteDashboard';
import { useRouteData, AppHeader, RouteControls, RouteStatusBanner } from '@/features/route-tracker';
import { fetchTrafficApi } from '@/services/api';
import { BottomNavigation, NavigationTab } from '@/components/BottomNavigation';
import { RoutePlanner } from '@/pages/RoutePlanner';

function App() {
  const [routeNo, setRouteNo] = useState(''); // Input value
  const [activeRoute, setActiveRoute] = useState(''); // Actual confirmed route for fetching
  const [direction, setDirection] = useState('0'); // '0' or '1'
  const [viewMode, setViewMode] = useState<'dashboard' | 'list' | 'map'>('dashboard'); // 'list' | 'map'
  const [scrollToStop, setScrollToStop] = useState<string | null>(null);
  const [previousSearchMode, setPreviousSearchMode] = useState<'route' | 'stop'>('route');
  const [expandedStopCode, setExpandedStopCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NavigationTab>('live');

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

  // Import BusStop type or define it. Since it is not imported yet, let's import it first or use any for now but imports are better.
  // I will add import in the next step.
  const stopsRef = useRef<any[]>([]);

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
                  for (let i = 0; i < allStops.length; i++) {
                      const stopEl = allStops[i] as HTMLElement;
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
      setViewMode('dashboard');
      setHasOppositeDirection(true);
      // Note: previousSearchMode is passed to RouteDashboard so it can restore the mode
  };

  const handleSearch = () => {
    setActiveRoute(routeNo); // Sync local state
    executeSearch(routeNo, direction);
  };

  const handleSelectRoute = (route: string, stopCode?: string, dir?: string | null) => {
      const finalDir = dir || '0';
      setRouteNo(route);
      setDirection(finalDir);
      setActiveRoute(route); // Sync local state
      setViewMode('list');
      executeSearch(route, finalDir);
      if (stopCode) setScrollToStop(stopCode);
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
          // setBusData(...); // Managed by logic

          let interval: ReturnType<typeof setInterval>;
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
                        .then((traffic: any) => {
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
                       .then((traffic: any) => {
                           if (activeRouteRef.current === activeRoute) setTrafficData(traffic);
                       })
                       .catch((e: any) => console.error("Traffic interval error:", e));
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
    <div className="fixed inset-0 bg-gray-100 font-sans overflow-hidden">
      <div className="max-w-md mx-auto bg-white h-full shadow-lg flex flex-col relative">
        
        {/* Live Status Tab */}
        {activeTab === 'live' && (
          <>
            {/* Header */}
            <AppHeader
              activeRoute={activeRoute}
              busData={busData}
              routeNo={routeNo}
              hasOppositeDirection={hasOppositeDirection}
              onBack={handleBack}
              onSearch={handleSearch}
              onSetRouteNo={setRouteNo}
              onToggleDirection={toggleDirection}
              onResetToHome={() => {
                setBusData(null);
                setTrafficData([]);
                setActiveRoute('');
                setRouteNo('');
                setViewMode('dashboard');
              }}
            />

            {/* Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden relative pb-16">
                
                {/* 2. Route Dashboard (Route List) */}
                {!busData && (
                    <RouteDashboard 
                      onSelectRoute={handleSelectRoute} 
                      initialSearchMode={previousSearchMode}
                      onSearchModeChange={setPreviousSearchMode}
                      expandedStop={expandedStopCode}
                      onExpandedStopChange={setExpandedStopCode}
                    />
                )}

                {/* 3. Active Bus Detail View */}
                {busData && (
                    <div className="flex-1 flex flex-col relative overflow-hidden">
                        
                         {/* Controls Bar & Refresh */}
                         <RouteControls
                           viewMode={viewMode as 'list' | 'map'}
                           onViewModeChange={setViewMode}
                           direction={direction}
                           hasOppositeDirection={hasOppositeDirection}
                           onToggleDirection={toggleDirection}
                           lastUpdated={lastUpdated}
                           onRefresh={() => {
                               if (viewMode === 'map') fetchBusLocation(activeRoute, direction);
                               else fetchRealtimeBus(activeRoute, direction, stopsRef.current);
                           }}
                           loading={loading}
                         />

                         <div className="flex-1 overflow-y-auto relative bg-white">
                            {/* Active Buses Banner */}
                            <RouteStatusBanner 
                               activeBusCount={busData.buses.length}
                               hasGPSWeakness={mapBuses.some(b => b.staCode)}
                            />

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
          </>
        )}

        {/* Route Planner Tab */}
        {activeTab === 'planner' && (
          <div className="flex-1 overflow-y-auto pb-16 relative">
            <RoutePlanner 
              onViewRouteStatus={(route, stopCode) => {
                setActiveTab('live');
                handleSelectRoute(route, stopCode);
              }}
            />
          </div>
        )}

        {/* Bottom Navigation */}
        <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
}

export default App;
