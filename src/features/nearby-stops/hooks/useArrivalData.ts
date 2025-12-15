/**
 * useArrivalData - Custom hook for fetching and managing bus arrival data
 * 
 * Bus Status Logic:
 * - status 0: Bus has DEPARTED from the stop (already passed)
 * - status 1: Bus is AT the stop (arrived/at station)
 * 
 * For the target stop:
 * - Only show buses with status 1 (currently at the stop)
 * - Buses with status 0 have already left and should not be shown
 * 
 * For earlier stops (approaching):
 * - Include all buses regardless of status (they're still approaching the target)
 */

import { useState, useCallback } from 'react';
import { fetchBusListApi, fetchMapLocationApi, fetchTrafficApi } from '@/services/api';
import { getDistanceFromLatLonInKm } from '@/utils/distance';
import { getStopCoords, getStopName } from '@/utils/stopCodeMatcher';
import govData from '@/data/gov_data.json';
import type { ArrivalData, RouteEtaInfo, MapBus } from '@/features/nearby-stops/types';

const stopsData = govData.stops;

// ============================================================================
// Type Definitions
// ============================================================================

interface UseArrivalDataReturn {
  arrivalData: ArrivalData;
  loadingArrivals: Record<string, boolean>;
  stopBuses: MapBus[];
  lastUpdated: Date | null;
  fetchStopData: (stopCode: string) => Promise<void>;
}

interface IncomingBus {
  plate: string;
  stopsAway: number;
  currentStop: string;
  nextStop: string | null; // Next stop name when bus has departed (status 0)
  eta: number;
  distanceM: number;
  trafficSegments: number[];
  busStopIdx: number;
  targetStopIdx: number;
  busStatus: number | string;
  isEnRoute: boolean; // true = arriving (en route from previous stop), false = at station or approaching
  isDeparted: boolean; // true = bus has departed from current stop (status 0)
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Check if API response contains valid route info */
const isValidResponse = (r: any): boolean =>
  r?.data?.data?.routeInfo && r.data.data.routeInfo.length > 0;

/** Find the index of a stop in the route by matching stop code */
const findStopIndex = (stops: any[], stopCode: string): number => {
  const normalizeCode = (code: string) => (code || '').replace(/[\/_-]/g, '-');
  const target = normalizeCode(stopCode);
  const targetBase = target.split('-')[0];
  
  return stops.findIndex((s) => {
    const sCode = normalizeCode(s.staCode);
    const sBase = sCode.split('-')[0];
    return sCode === target || sCode === targetBase || sBase === targetBase;
  });
};

/** Calculate traffic-adjusted travel time between two stops */
const calcTravelTime = (
  stops: any[],
  fromIdx: number,
  toIdx: number,
  routeTrafficData: any[]
): number => {
  let totalTime = 0;
  for (let j = fromIdx; j < toIdx; j++) {
    const p1 = getStopCoords(stops[j].staCode);
    const p2 = getStopCoords(stops[j + 1].staCode);
    if (p1 && p2) {
      const segmentDistKm = getDistanceFromLatLonInKm(p1.lat, p1.lon, p2.lat, p2.lon);
      let trafficMultiplier = 1.0;
      if (routeTrafficData?.[j]) {
        const traffic = routeTrafficData[j].traffic || 1;
        if (traffic >= 3) trafficMultiplier = 2.0;
        else if (traffic >= 2) trafficMultiplier = 1.5;
      }
      totalTime += segmentDistKm * 1.5 * trafficMultiplier;
    }
  }
  return totalTime;
};

/** Calculate total path distance between two stops */
const calcPathDistance = (stops: any[], fromIdx: number, toIdx: number): number => {
  let pathDistKm = 0;
  for (let j = fromIdx; j < toIdx; j++) {
    const p1 = getStopCoords(stops[j].staCode);
    const p2 = getStopCoords(stops[j + 1].staCode);
    if (p1 && p2) {
      pathDistKm += getDistanceFromLatLonInKm(p1.lat, p1.lon, p2.lat, p2.lon);
    }
  }
  return pathDistKm;
};

/** Check if bus status indicates it's at the station (not departed) */
const isBusAtStation = (status: any): boolean => {
  return status === 1 || status === '1';
};

/** Check if bus status indicates it has departed */
const hasBusDeparted = (status: any): boolean => {
  return status === 0 || status === '0';
};

// ============================================================================
// Main Hook
// ============================================================================

export const useArrivalData = (): UseArrivalDataReturn => {
  const [arrivalData, setArrivalData] = useState<ArrivalData>({});
  const [loadingArrivals, setLoadingArrivals] = useState<Record<string, boolean>>({});
  const [stopBuses, setStopBuses] = useState<MapBus[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStopData = useCallback(async (stopCode: string) => {
    // Find stop in local data
    const stop = stopsData.find((s: any) => {
      const raw = s.code || s.raw?.P_ALIAS || s.raw?.ALIAS || '';
      return raw.replace(/[_-]/g, '/') === stopCode;
    });

    if (!stop) {
      setLoadingArrivals((prev) => ({ ...prev, [stopCode]: false }));
      return;
    }

    try {
      const newArrivals: Record<string, RouteEtaInfo | string> = {};
      let allIncomingBuses: MapBus[] = [];

      // Get routes that pass through this stop
      let stopRoutes = (stop as any).routes || [];
      if (stopRoutes.length === 0 && (stop as any).raw?.ROUTE_NOS) {
        stopRoutes = [...new Set((stop as any).raw.ROUTE_NOS.split(',').map((r: string) => r.trim()))] as string[];
      }

      // Fetch data for each route
      await Promise.all(
        stopRoutes.map(async (route: string) => {
          const checkDir = async (d: string): Promise<RouteEtaInfo | null> => {
            try {
              // Fetch route data from multiple API endpoints
              const [res2, res0] = await Promise.all([
                fetchBusListApi(route, d, '2'),
                fetchBusListApi(route, d, '0'),
              ]);

              // Collect valid route candidates
              const candidates: any[][] = [];
              if (isValidResponse(res2)) candidates.push(res2.data.data.routeInfo);
              if (isValidResponse(res0)) candidates.push(res0.data.data.routeInfo);

              // Find the best candidate with the most buses
              let bestStops: any[] | null = null;
              let bestIdx = -1;
              for (const cStops of candidates) {
                const idx = findStopIndex(cStops, stopCode);
                if (idx !== -1) {
                  const busCount = cStops.flatMap((s: any) => s.busInfo || []).length;
                  const bestBusCount = bestStops?.flatMap((s: any) => s.busInfo || []).length || 0;
                  if (!bestStops || busCount > bestBusCount) {
                    bestStops = cStops;
                    bestIdx = idx;
                  }
                }
              }

              if (!bestStops || bestIdx === -1) return null;

              // Fetch traffic data for ETA calculation
              let routeTrafficData: any[] = [];
              try {
                routeTrafficData = await fetchTrafficApi(route, d) || [];
              } catch { /* ignore traffic fetch errors */ }

              const stops = bestStops;
              const targetStopIdx = bestIdx;
              const incomingBuses: IncomingBus[] = [];

              // ================================================================
              // COLLECT INCOMING BUSES
              // Iterate through all stops up to and including the target stop
              // ================================================================
              for (let stopIdx = 0; stopIdx <= targetStopIdx; stopIdx++) {
                const busesAtStop = stops[stopIdx].busInfo || [];
                if (busesAtStop.length === 0) continue;

                const stopsAway = targetStopIdx - stopIdx;

                // Calculate ETA and distance
                const pathDistKm = calcPathDistance(stops, stopIdx, targetStopIdx);
                const rideTime = calcTravelTime(stops, stopIdx, targetStopIdx, routeTrafficData);
                const dwellTime = stopsAway * 0.5; // 30 seconds per stop
                let eta = Math.round(rideTime + dwellTime);
                if (eta === 0 && stopsAway > 0 && pathDistKm > 0.1) eta = 1;

                // Get traffic segments for progress bar
                const segmentTraffic = routeTrafficData
                  .slice(stopIdx, targetStopIdx)
                  .map((t: any) => t?.traffic || 1);

                busesAtStop.forEach((bus: any) => {
                  // ============================================================
                  // BUS STATUS LOGIC
                  // ============================================================
                  // 
                  // status 0 = Bus has DEPARTED from current stop
                  // status 1 = Bus is AT current stop
                  //
                  // SPECIAL CASE - EN ROUTE:
                  // If bus is at stop N-1 with status 0 (departed), it means the bus
                  // is actually IN TRANSIT to stop N (target). Treat as "arriving".
                  //
                  // At TARGET stop (stopsAway === 0):
                  //   - status 1: Bus is AT the stop -> INCLUDE (show "Arrived")
                  //   - status 0: Bus has DEPARTED -> EXCLUDE (already passed)
                  //
                  // At PREVIOUS stop (stopsAway === 1):
                  //   - status 0: Bus DEPARTED, EN ROUTE to target -> treat as arriving
                  //   - status 1: Bus still at previous stop -> show "1 stop away"
                  //
                  // At EARLIER stops (stopsAway > 1):
                  //   - Include ALL buses (they're still approaching the target)
                  // ============================================================

                  const isEnRoute = stopsAway === 1 && hasBusDeparted(bus.status);
                  const effectiveStopsAway = isEnRoute ? 0 : stopsAway;
                  const effectiveEta = isEnRoute ? 0 : eta;

                  if (stopsAway === 0) {
                    // At target stop: only include if currently at station
                    if (!isBusAtStation(bus.status)) return;
                  }
                  // For earlier stops (including en-route): include all

                  const isDeparted = hasBusDeparted(bus.status);
                  const nextStopName = isDeparted && stopIdx + 1 < stops.length 
                    ? getStopName(stops[stopIdx + 1].staCode) 
                    : null;

                  incomingBuses.push({
                    plate: bus.busPlate,
                    stopsAway: effectiveStopsAway,
                    currentStop: getStopName(stops[stopIdx].staCode),
                    nextStop: nextStopName,
                    eta: effectiveEta,
                    distanceM: isEnRoute ? 0 : Math.round(pathDistKm * 1000),
                    trafficSegments: segmentTraffic,
                    busStopIdx: stopIdx,
                    targetStopIdx,
                    busStatus: bus.status,
                    isEnRoute, // true = arriving (en route), false = could be at station or approaching
                    isDeparted, // true = bus has departed from current stop
                  });
                });
              }

              // Sort by ETA (closest first)
              incomingBuses.sort((a, b) => a.eta - b.eta);
              
              // Get top 2 buses for display
              const topBuses = incomingBuses.slice(0, 2);
              const destination = stops[stops.length - 1]?.staName || '';
              const actualTotal = stops.flatMap((s: any) => s.busInfo || []).length;

              // ================================================================
              // DETERMINE ROUTE STATUS
              // ================================================================
              // 'arrived': At least one bus is currently AT the target stop (status 1)
              // 'active': Buses are approaching but none at the target stop yet
              // 'no-approaching': Route has active buses but none heading to this stop
              // 'no-service': No buses operating on this route
              // ================================================================
              let status: 'active' | 'arrived' | 'no-service' | 'no-approaching' = 'no-service';
              const busAtTargetStop = incomingBuses.some(b => b.stopsAway === 0);
              
              if (busAtTargetStop) {
                status = 'arrived';
              } else if (incomingBuses.length > 0) {
                status = 'active';
              } else if (actualTotal > 0) {
                status = 'no-approaching';
              }

              // Fetch GPS data for map display
              const targetPlates = incomingBuses.slice(0, 2).map((b) => b.plate);
              if (targetPlates.length > 0) {
                try {
                  const gpsData = await fetchMapLocationApi(route, d);
                  const busList = gpsData.busInfoList || gpsData.data?.busInfoList || [];
                  const matchedBuses = busList
                    .filter((b: any) => targetPlates.includes(b.busPlate))
                    .map((b: any) => ({ ...b, route, dir: d }));
                  if (matchedBuses.length > 0) {
                    allIncomingBuses.push(...matchedBuses);
                  }
                } catch { /* ignore GPS errors */ }
              }

              return {
                buses: topBuses,
                destination,
                totalStops: stops.length,
                currentStopIdx: targetStopIdx,
                status,
                minStops: incomingBuses[0]?.stopsAway ?? 999,
                minEta: incomingBuses[0]?.eta ?? 999,
                direction: d,
              };
            } catch {
              return null;
            }
          };

          // Try direction 0 first, then direction 1
          const info0 = await checkDir('0');
          if (info0) {
            newArrivals[route] = info0;
            return;
          }
          const info1 = await checkDir('1');
          if (info1) {
            newArrivals[route] = info1;
          } else {
            newArrivals[route] = 'No Service / Wrong Sta';
          }
        })
      );

      setArrivalData((prev) => ({ ...prev, [stopCode]: newArrivals }));
      setStopBuses(allIncomingBuses);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Arrival fetch failed', err);
    } finally {
      setLoadingArrivals((prev) => ({ ...prev, [stopCode]: false }));
    }
  }, []);

  return {
    arrivalData,
    loadingArrivals,
    stopBuses,
    lastUpdated,
    fetchStopData,
  };
};
