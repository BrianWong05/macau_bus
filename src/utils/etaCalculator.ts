/**
 * ETA calculation utilities with traffic-adjusted travel times
 */

import { getDistanceFromLatLonInKm } from './distance';
import { getStopCoords } from './stopCodeMatcher';

interface TrafficSegment {
  traffic: number;
  path?: [number, number][];
}

interface Stop {
  staCode: string;
  busInfo?: unknown[];
}

/**
 * Traffic level to multiplier mapping
 * 1 = Smooth (green) -> 1.0x
 * 2 = Moderate (yellow) -> 1.5x
 * 3+ = Congested (red) -> 2.0x
 */
export const getTrafficMultiplier = (trafficLevel: number): number => {
  if (trafficLevel >= 3) return 2.0;  // Congested (red)
  if (trafficLevel >= 2) return 1.5;  // Moderate (yellow)
  return 1.0; // Smooth (green)
};

/**
 * Base speed: 1.5 min/km (~40 km/h)
 */
const BASE_MIN_PER_KM = 1.5;

/**
 * Dwell time per stop (minutes)
 */
const DWELL_TIME_PER_STOP = 0.5;

/**
 * Calculate path distance between two stop indices (in km)
 */
export const calcPathDistance = (
  stops: Stop[],
  fromIdx: number,
  toIdx: number
): number => {
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

/**
 * Calculate traffic-adjusted travel time (in minutes)
 * Applies traffic multipliers per segment individually
 */
export const calcTravelTime = (
  stops: Stop[],
  fromIdx: number,
  toIdx: number,
  trafficData: TrafficSegment[] = []
): number => {
  let totalTime = 0;
  for (let j = fromIdx; j < toIdx; j++) {
    const p1 = getStopCoords(stops[j].staCode);
    const p2 = getStopCoords(stops[j + 1].staCode);
    if (p1 && p2) {
      const segmentDistKm = getDistanceFromLatLonInKm(p1.lat, p1.lon, p2.lat, p2.lon);

      // Get traffic level for this segment
      const trafficLevel = trafficData[j]?.traffic || 1;
      const multiplier = getTrafficMultiplier(trafficLevel);

      totalTime += segmentDistKm * BASE_MIN_PER_KM * multiplier;
    }
  }
  return totalTime;
};

/**
 * Calculate full ETA including travel time and dwell time
 */
export const calculateEta = (
  stops: Stop[],
  fromIdx: number,
  toIdx: number,
  trafficData: TrafficSegment[] = []
): number => {
  const stopsAway = toIdx - fromIdx;
  const rideTime = calcTravelTime(stops, fromIdx, toIdx, trafficData);
  const dwellTime = stopsAway * DWELL_TIME_PER_STOP;
  
  let eta = Math.round(rideTime + dwellTime);
  
  // Ensure at least 1 minute if there are stops away
  const pathDist = calcPathDistance(stops, fromIdx, toIdx);
  if (eta === 0 && stopsAway > 0 && pathDist > 0.1) {
    eta = 1;
  }
  
  return eta;
};
