/**
 * useRouteData - Custom hook for managing route data, bus positions, and traffic
 */

import { useState, useCallback, useRef } from 'react';
import {
  fetchRouteDataApi,
  fetchTrafficApi,
  fetchRouteOperationTimeApi,
  fetchBusListApi,
  fetchMapLocationApi,
} from '@/services/api';
import type { RouteData, BusStop, MapBus, TrafficSegment } from '@/features/route-tracker/types';

interface UseRouteDataReturn {
  busData: RouteData | null;
  mapBuses: MapBus[];
  trafficData: TrafficSegment[];
  loading: boolean;
  error: string;
  hasOppositeDirection: boolean;
  lastUpdated: Date | null;
  executeSearch: (route: string, direction: string) => Promise<void>;
  fetchRealtimeBus: (route: string, direction: string, stops: BusStop[]) => Promise<void>;
  fetchBusLocation: (route: string, direction: string) => Promise<void>;
  setBusData: React.Dispatch<React.SetStateAction<RouteData | null>>;
  setMapBuses: React.Dispatch<React.SetStateAction<MapBus[]>>;
  setTrafficData: React.Dispatch<React.SetStateAction<TrafficSegment[]>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  setHasOppositeDirection: React.Dispatch<React.SetStateAction<boolean>>;
  activeRouteRef: React.MutableRefObject<string>;
}

export const useRouteData = (): UseRouteDataReturn => {
  const [busData, setBusData] = useState<RouteData | null>(null);
  const [mapBuses, setMapBuses] = useState<MapBus[]>([]);
  const [trafficData, setTrafficData] = useState<TrafficSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasOppositeDirection, setHasOppositeDirection] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const activeRouteRef = useRef<string>('');

  const fetchRealtimeBus = useCallback(
    async (rNo: string, dir: string, currentStops: BusStop[]) => {
      const typesToProbe = ['0', '2'];
      const promises = typesToProbe.map((type) => fetchBusListApi(rNo, dir, type));
      const trafficPromise = fetchTrafficApi(rNo.replace(/^0+/, ''), dir);

      try {
        const results = await Promise.all([...promises, trafficPromise]);

        if (activeRouteRef.current !== rNo) return;

        const trafficResult = results.pop();
        setTrafficData(trafficResult || []);

        const validResult = results.find(
          (r: any) => r?.data?.header === '000'
        );

        if (validResult?.data?.data?.routeInfo) {
          const realtimeStops = validResult.data.data.routeInfo;

          const updatedStops = currentStops.map((stop) => {
            const matchingStop = realtimeStops.find(
              (rs: any) => rs.staCode === stop.staCode
            );
            if (matchingStop) {
              return {
                ...stop,
                buses: (matchingStop.busInfo || []).map((b: any) => ({
                  ...b,
                  status: b.status,
                  speed: b.speed,
                  busPlate: b.busPlate,
                })),
                trafficLevel: 0,
              };
            }
            return { ...stop, buses: [], trafficLevel: 0 };
          });

          const allBuses = updatedStops.flatMap((s) => s.buses);

          setBusData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              stops: updatedStops,
              buses: allBuses,
            };
          });

          setLastUpdated(new Date());
        }
      } catch (e) {
        console.error('Realtime fetch failed', e);
      }
    },
    []
  );

  const fetchBusLocation = useCallback(async (rNo: string, dir: string) => {
    try {
      const data = await fetchMapLocationApi(rNo, dir);

      if (activeRouteRef.current !== rNo) return;

      setLastUpdated(new Date());

      const busInfoList = data?.busInfoList || data?.data?.busInfoList || [];

      if (Array.isArray(busInfoList) && busInfoList.length > 0) {
        setMapBuses(
          busInfoList.map((b: any) => ({
            busPlate: b.busPlate,
            latitude: Number(b.latitude),
            longitude: Number(b.longitude),
            status: b.status,
            speed: b.speed,
          }))
        );
      } else {
        // Fallback: Try list API when location API is empty
        const typesToProbe = ['0', '2'];
        let found = false;
        
        for (const type of typesToProbe) {
          if (found) break;
          const busRes = await fetchBusListApi(rNo, dir, type);
          
          if (activeRouteRef.current !== rNo) return;
          
          if (busRes?.data?.data?.routeInfo) {
            const allBuses: any[] = [];
            busRes.data.data.routeInfo.forEach((stop: any) => {
              if (stop.busInfo) {
                stop.busInfo.forEach((b: any) => {
                  allBuses.push({ ...b, staCode: stop.staCode });
                });
              }
            });
            
            if (allBuses.length > 0) {
              setMapBuses(allBuses);
              found = true;
            }
          }
        }
        
        if (!found && activeRouteRef.current === rNo) {
          setMapBuses([]);
        }
      }

      // Fetch Traffic independently
      try {
        const traffic = await fetchTrafficApi(rNo.replace(/^0+/, ''), dir);
        if (activeRouteRef.current === rNo) setTrafficData(traffic || []);
      } catch {
        // Traffic fetch failed, continue
      }
    } catch (e) {
      console.error('Bus location fetch failed', e);
      if (activeRouteRef.current === rNo) setMapBuses([]);
    }
  }, []);

  const executeSearch = useCallback(
    async (routeToFetch: string, dirToFetch: string) => {
      if (!routeToFetch) return;

      setLoading(true);
      setError('');
      activeRouteRef.current = routeToFetch;

      try {
        // Fetch Route Data (Stops)
        const dataPromise = fetchRouteDataApi(routeToFetch, dirToFetch);
        // Fetch Operation Time (Parallel)
        const opTimePromise = fetchRouteOperationTimeApi(routeToFetch, dirToFetch);

        const [data, opTimeData] = await Promise.all([dataPromise, opTimePromise]);

        if (activeRouteRef.current !== routeToFetch) return;

        if (data?.data?.routeInfo?.length > 0) {
          const stops: BusStop[] = data.data.routeInfo.map((stop: any) => ({
            ...stop,
            buses: [],
            trafficLevel: 0,
          }));

          // Parse OpTime
          // Structure from logs: [{"data":[{"dir":"0","display":"0","firstBusTime":"06:15","lastBusTime":"00:00","msg":"","routeName":"2"}],"header":{"status":"000"}}]
          // It's an array containing an object with a data array.
          const opTimeInfo = Array.isArray(opTimeData) && opTimeData.length > 0 ? opTimeData[0]?.data?.[0] : null;
          
          const firstBusTime = opTimeInfo?.firstBusTime || opTimeInfo?.startTime || '';
          const lastBusTime = opTimeInfo?.lastBusTime || opTimeInfo?.endTime || '';

          setBusData({
            stops,
            buses: [],
            raw: data.data,
            direction: dirToFetch,
            firstBusTime,
            lastBusTime,
          });

          fetchRealtimeBus(routeToFetch, dirToFetch, stops);

          // Probe opposite direction
          const oppositeDir = dirToFetch === '0' ? '1' : '0';
          try {
            const oppositeData = await fetchRouteDataApi(routeToFetch, oppositeDir);
            if (activeRouteRef.current === routeToFetch) {
              setHasOppositeDirection(
                oppositeData?.data?.routeInfo?.length > 0
              );
            }
          } catch {
            if (activeRouteRef.current === routeToFetch) {
              setHasOppositeDirection(false);
            }
          }
        } else {
          setError('Route not found or empty data.');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch route data');
      } finally {
        if (activeRouteRef.current === routeToFetch) {
          setLoading(false);
        }
      }
    },
    [fetchRealtimeBus]
  );

  return {
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
  };
};
