/**
 * useArrivalData - Custom hook for fetching and managing bus arrival data
 */

import { useState, useCallback } from 'react';
import { fetchBusListApi, fetchMapLocationApi, fetchTrafficApi } from '../../../services/api';
import { getDistanceFromLatLonInKm } from '../../../utils/distance';
import { getStopCoords, getStopName } from '../../../utils/stopCodeMatcher';
import govData from '../../../data/gov_data.json';
import type { ArrivalData, RouteEtaInfo } from '../types';

const stopsData = govData.stops;

interface MapBus {
  busPlate: string;
  latitude: number;
  longitude: number;
  route?: string;
  dir?: string;
}

interface UseArrivalDataReturn {
  arrivalData: ArrivalData;
  loadingArrivals: Record<string, boolean>;
  stopBuses: MapBus[];
  lastUpdated: Date | null;
  fetchStopData: (stopCode: string) => Promise<void>;
}

// Helper functions
const isValidResponse = (r: any) =>
  r?.data?.data?.routeInfo && r.data.data.routeInfo.length > 0;

const findStopIndex = (stops: any[], stopCode: string) => {
  return stops.findIndex((s) => {
    const sCode = (s.staCode || '').replace(/\//g, '-').replace(/_/g, '-');
    const target = (stopCode || '').replace(/\//g, '-').replace(/_/g, '-');
    const targetBase = target.split('-')[0];
    if (sCode === target) return true;
    if (sCode === targetBase || sCode.split('-')[0] === targetBase) return true;
    return false;
  });
};

// Traffic-adjusted travel time calculation
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
      if (routeTrafficData && routeTrafficData[j]) {
        const traffic = routeTrafficData[j].traffic || 1;
        if (traffic >= 3) trafficMultiplier = 2.0;
        else if (traffic >= 2) trafficMultiplier = 1.5;
      }
      totalTime += segmentDistKm * 1.5 * trafficMultiplier;
    }
  }
  return totalTime;
};

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

export const useArrivalData = (): UseArrivalDataReturn => {
  const [arrivalData, setArrivalData] = useState<ArrivalData>({});
  const [loadingArrivals, setLoadingArrivals] = useState<Record<string, boolean>>({});
  const [stopBuses, setStopBuses] = useState<MapBus[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStopData = useCallback(async (stopCode: string) => {
    // Normalize lookup
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

      // Parse routes
      let stopRoutes = (stop as any).routes || [];
      if (stopRoutes.length === 0 && (stop as any).raw?.ROUTE_NOS) {
        stopRoutes = [...new Set((stop as any).raw.ROUTE_NOS.split(',').map((r: string) => r.trim()))] as string[];
      }

      await Promise.all(
        stopRoutes.map(async (route: string) => {
          const checkDir = async (d: string): Promise<RouteEtaInfo | null> => {
            try {
              const [res2, res0] = await Promise.all([
                fetchBusListApi(route, d, '2'),
                fetchBusListApi(route, d, '0'),
              ]);

              let candidates: any[] = [];
              if (isValidResponse(res2)) candidates.push(res2.data.data.routeInfo);
              if (isValidResponse(res0)) candidates.push(res0.data.data.routeInfo);

              let bestStops: any[] | null = null;
              let bestIdx = -1;
              for (const cStops of candidates) {
                const idx = findStopIndex(cStops, stopCode);
                if (idx !== -1) {
                  if (!bestStops || cStops.flatMap((s: any) => s.busInfo || []).length > bestStops.flatMap((s: any) => s.busInfo || []).length) {
                    bestStops = cStops;
                    bestIdx = idx;
                  }
                }
              }

              if (bestStops && bestIdx !== -1) {
                // Fetch traffic data
                let routeTrafficData: any[] = [];
                try {
                  const trafficSegments = await fetchTrafficApi(route, d);
                  routeTrafficData = trafficSegments || [];
                } catch { /* ignore */ }

                const stops = bestStops;
                const stopIdx = bestIdx;
                let incomingBuses: any[] = [];
                let minStops = 999;
                let minTimeEst = 999;

                // Collect incoming buses
                for (let i = 0; i <= stopIdx; i++) {
                  if (stops[i].busInfo?.length > 0) {
                    const stopsAway = stopIdx - i;
                    const pathDistKm = calcPathDistance(stops, i, stopIdx);
                    const rideTime = calcTravelTime(stops, i, stopIdx, routeTrafficData);
                    const dwellTime = stopsAway * 0.5;
                    let eta = Math.round(rideTime + dwellTime);
                    if (eta === 0 && stopsAway > 0 && pathDistKm > 0.1) eta = 1;

                    stops[i].busInfo.forEach((b: any) => {
                      incomingBuses.push({
                        plate: b.busPlate,
                        stopsAway,
                        currentStop: getStopName(stops[i].staCode),
                        eta,
                        distanceM: Math.round(pathDistKm * 1000),
                      });
                    });

                    if (stopsAway < minStops) {
                      minStops = stopsAway;
                      minTimeEst = eta;
                    }
                  }
                }

                incomingBuses.sort((a, b) => a.eta - b.eta);
                const topBuses = incomingBuses.slice(0, 2);
                const destination = stops[stops.length - 1]?.staName || '';
                const actualTotal = stops.flatMap((s: any) => s.busInfo || []).length;

                let status: 'active' | 'arriving' | 'no-service' | 'no-approaching' = 'no-service';
                if (minStops === 0) status = 'arriving';
                else if (minStops < 999) status = 'active';
                else if (actualTotal > 0) status = 'no-approaching';

                // Fetch GPS for map
                const targetPlates = incomingBuses.slice(-2).map((b) => b.plate);
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
                  currentStopIdx: stopIdx,
                  status,
                  minStops,
                  minEta: minTimeEst,
                  direction: d,
                };
              }
            } catch { /* ignore */ }
            return null;
          };

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
