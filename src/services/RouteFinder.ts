/**
 * RouteFinder - Client-side Pathfinding for the Macau Bus Network
 * 
 * Provides pathfinding capabilities using BFS (Breadth-First Search)
 * optimized for fewest transfers rather than fewest stops.
 */
import { fetchTrafficApi } from '@/services/api';
import { calcTravelTime } from '@/utils/etaCalculator';
import type { Stop as EtaStop, TrafficSegment } from '@/utils/etaCalculator';
import govData from '@/data/gov_data.json';

/**
 * RouteFinder - Client-side Pathfinding for the Macau Bus Network
 */

// ============== Types ==============

export interface BusStop {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  routes: string[];
  nameEn?: string; // English Name
  namePt?: string; // Portuguese Name
}

export interface BusRoute {
  id: string;
  baseRoute?: string;
  direction?: string;
  stops: string[];
}

export interface BusGraph {
  stops: Record<string, BusStop>;
  routes: Record<string, BusRoute>;
}

export interface RouteLeg {
  routeId: string;      // e.g. "26A_0"
  routeName: string;    // e.g. "26A" (without direction suffix)
  direction: string;    // "0" or "1"
  fromStop: string;     // Stop ID
  toStop: string;       // Stop ID
  fromStopName: string; // Human-readable
  toStopName: string;   // Human-readable
  stopCount: number;    // Number of stops on this leg
  stops: string[];      // All stop IDs in order for this leg
  duration: number;     // Estimated duration in minutes
}

export interface RouteResult {
  legs: RouteLeg[];
  totalStops: number;
  transferCount: number;
  totalDuration: number; // Estimated total duration in minutes
}

// ============== RouteFinder Class ==============

export class RouteFinder {
  private graph: BusGraph | null = null;
  private isLoaded: boolean = false;
  private loadPromise: Promise<void> | null = null;

  constructor(preloadedData?: BusGraph) {
    if (preloadedData) {
      this.graph = preloadedData;
      this.isLoaded = true;
    }
  }

  /**
   * Initialize/load the bus graph data
   */
  async load(dataUrl: string = '/macau_bus/bus_data.json'): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const response = await fetch(dataUrl);
        if (!response.ok) {
          throw new Error(`Failed to load bus data: ${response.status}`);
        }
        const data = await response.json();
        this.graph = data as BusGraph;

        // Enrich with multilingual data from gov_data
        if (this.graph && this.graph.stops) {
            const govStops = (govData as any).stops || [];
            
            // Create a lookup map for speed
            // Map keys: ALIAS and P_ALIAS to the stop object
            const govMap = new Map<string, any>();
            govStops.forEach((gs: any) => {
                if (gs.raw?.ALIAS) govMap.set(gs.raw.ALIAS.toUpperCase(), gs);
                if (gs.raw?.P_ALIAS) govMap.set(gs.raw.P_ALIAS.toUpperCase(), gs);
            });

            // Iterate graph stops and merge
            Object.values(this.graph.stops).forEach(stop => {
                // Try to find match by ID (which corresponds to ALIAS/P_ALIAS usually)
                // Stop IDs in bus_data are like "M1/5", "M225".
                // gov_data ALIAS matches this usually.
                
                // Normalization: "M1-5" vs "M1/5"? gov_data has "M11_1" for "P_ALIAS" but "M11" for "ALIAS".
                // Lets try exact match first, then replace / with _
                
                let match = govMap.get(stop.id.toUpperCase());
                if (!match) {
                     const altId = stop.id.replace('/', '_').toUpperCase();
                     match = govMap.get(altId);
                }
                
                if (match && match.raw) {
                    stop.nameEn = match.raw.P_NAME_EN || match.raw.NAME_EN || '';
                    stop.namePt = match.raw.P_NAME_POR || match.raw.NAME_POR || '';
                }
            });
        }

        this.isLoaded = true;
      } catch (error) {
        console.error('RouteFinder: Failed to load data', error);
        throw error;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Check if data is loaded
   */
  get loaded(): boolean {
    return this.isLoaded;
  }

  /**
   * Get stop info by ID
   */
  getStop(stopId: string): BusStop | undefined {
    return this.graph?.stops[stopId];
  }

  /**
   * Get route info by ID
   */
  getRoute(routeId: string): BusRoute | undefined {
    return this.graph?.routes[routeId];
  }

  // ============== Haversine Distance ==============

  /**
   * Calculate distance between two coordinates using Haversine formula
   * @returns Distance in meters
   */
  private haversineDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number
  ): number {
    const R = 6371000; // Earth's radius in meters
    const toRad = (deg: number) => deg * (Math.PI / 180);

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Find the nearest stop to given coordinates
   */
  findNearestStop(lat: number, lng: number): string | null {
    if (!this.graph) {
      console.warn('RouteFinder: Graph not loaded');
      return null;
    }

    let nearestStopId: string | null = null;
    let minDistance = Infinity;

    for (const [stopId, stop] of Object.entries(this.graph.stops)) {
      if (stop.lat === undefined || stop.lng === undefined) continue;

      const distance = this.haversineDistance(lat, lng, stop.lat, stop.lng);

      if (distance < minDistance) {
        minDistance = distance;
        nearestStopId = stopId;
      }
    }

    return nearestStopId;
  }

  /**
   * Find all stops within a radius (in meters)
   */
  findStopsWithinRadius(lat: number, lng: number, radiusMeters: number): string[] {
    if (!this.graph) return [];

    const results: { id: string; distance: number }[] = [];

    for (const [stopId, stop] of Object.entries(this.graph.stops)) {
      if (stop.lat === undefined || stop.lng === undefined) continue;

      const distance = this.haversineDistance(lat, lng, stop.lat, stop.lng);

      if (distance <= radiusMeters) {
        results.push({ id: stopId, distance });
      }
    }

    // Sort by distance
    results.sort((a, b) => a.distance - b.distance);
    return results.map(r => r.id);
  }

  // ============== Pathfinding (BFS) ==============

  /**
   * Find route from start to end stop
   * Optimized for fewest transfers
   * Returns an array of possible routes (e.g. multiple direct bus lines)
   */
  findRoute(startStopId: string, endStopId: string): RouteResult[] {
    if (!this.graph) {
      console.warn('RouteFinder: Graph not loaded');
      return [];
    }

    const startStop = this.graph.stops[startStopId];
    const endStop = this.graph.stops[endStopId];

    if (!startStop || !endStop) {
      console.warn('RouteFinder: Invalid stop IDs');
      return [];
    }

    // Same stop
    if (startStopId === endStopId) {
      return [];
    }
    
    // Use set to deduplicate by total duration and stops
    const allResults: RouteResult[] = [];

    // ===== Step 1: Check for Direct Routes =====
    const directRoutes = this.findDirectRoutes(startStopId, endStopId);
    allResults.push(...directRoutes);

    // ===== Step 2: BFS for 1-Transfer Routes =====
    // Only search if we don't have too many direct routes, or if user wants options
    const oneTransferRoutes = this.findOneTransferRoutes(startStopId, endStopId);
    allResults.push(...oneTransferRoutes);

    // ===== Step 3: Multi-Transfer (only if few results) =====
    if (allResults.length < 3) {
        const multi = this.findMultiTransferRoute(startStopId, endStopId);
        if (multi) allResults.push(multi);
    }
    
    // Sort by Total Duration first, then transfers
    return allResults.sort((a, b) => {
        // Prefer significantly faster routes
        const diff = a.totalDuration - b.totalDuration;
        if (Math.abs(diff) > 5) return diff; // If difference > 5 mins, sort by time
        
        // Otherwise prefer fewer transfers
        if (a.transferCount !== b.transferCount) return a.transferCount - b.transferCount;
        
        return diff;
    });
  }

  /**
   * Find all direct routes (no transfers)
   */
  private findDirectRoutes(startStopId: string, endStopId: string): RouteResult[] {
    const startStop = this.graph!.stops[startStopId];
    const endStop = this.graph!.stops[endStopId];
    const results: RouteResult[] = [];

    // Find common routes
    const commonRoutes = startStop.routes.filter(r => endStop.routes.includes(r));

    for (const routeId of commonRoutes) {
      const route = this.graph!.routes[routeId];
      if (!route) continue;

      const startIdx = route.stops.indexOf(startStopId);
      const endIdx = route.stops.indexOf(endStopId);

      // Must go forward
      if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
        const legStops = route.stops.slice(startIdx, endIdx + 1);
        const leg = this.createLeg(routeId, legStops);

        // Calculate total duration: Leg time + Initial Wait (5m)
        const totalDuration = Math.ceil(leg.duration + 5);

        results.push({
          legs: [leg],
          totalStops: legStops.length,
          transferCount: 0,
          totalDuration
        });
      }
    }

    // Sort by number of stops (ascending)
    return results.sort((a, b) => a.totalStops - b.totalStops);
  }

  /**
   * Find routes with exactly 1 transfer (Top 5)
   */
  private findOneTransferRoutes(startStopId: string, endStopId: string): RouteResult[] {
    const startStop = this.graph!.stops[startStopId];
    const results: RouteResult[] = [];
    const MAX_RESULTS = 5;

    // For each route from start stop
    for (const startRouteId of startStop.routes) {
      const startRoute = this.graph!.routes[startRouteId];
      if (!startRoute) continue;

      const startIdx = startRoute.stops.indexOf(startStopId);
      if (startIdx === -1) continue;

      // Check each subsequent stop on this route as a potential transfer point
      for (let i = startIdx + 1; i < startRoute.stops.length; i++) {
        const transferStopId = startRoute.stops[i];
        const transferStop = this.graph!.stops[transferStopId];
        if (!transferStop) continue;

        // Check if any route from transfer stop reaches the end
        for (const endRouteId of transferStop.routes) {
          if (endRouteId === startRouteId) continue; // Skip same route

          const endRoute = this.graph!.routes[endRouteId];
          if (!endRoute) continue;

          const transferIdx = endRoute.stops.indexOf(transferStopId);
          const endIdx = endRoute.stops.indexOf(endStopId);

          if (transferIdx !== -1 && endIdx !== -1 && transferIdx < endIdx) {
            // Valid 1-transfer route found
            const leg1Stops = startRoute.stops.slice(startIdx, i + 1);
            const leg2Stops = endRoute.stops.slice(transferIdx, endIdx + 1);
            const totalStops = leg1Stops.length + leg2Stops.length - 1;

            const leg1 = this.createLeg(startRouteId, leg1Stops);
            const leg2 = this.createLeg(endRouteId, leg2Stops);
            
            // Duration: Leg1 + Leg2 + Initial Wait (5m) + Transfer (10m)
            const totalDuration = Math.ceil(leg1.duration + leg2.duration + 5 + 10);

            results.push({
              legs: [leg1, leg2],
              totalStops,
              transferCount: 1,
              totalDuration
            });
            
            // Optimization: If we have enough results, we could stop, 
            // but we want the BEST ones. So we collect more and sort.
            // Using a limit to prevent excessive processing
            if (results.length > 50) break;
          }
        }
        if (results.length > 50) break;
      }
    }

    // Sort by total stops and return top N
    return results
      .sort((a, b) => a.totalStops - b.totalStops)
      .slice(0, MAX_RESULTS);
  }

  /**
   * General BFS for multi-transfer routes (2+ transfers)
   */
  private findMultiTransferRoute(startStopId: string, endStopId: string): RouteResult | null {
    // BFS State: { stopId, path: [{ routeId, stops }] }
    interface BFSState {
      stopId: string;
      path: { routeId: string; stops: string[] }[];
      visitedStops: Set<string>;
    }

    const queue: BFSState[] = [];
    const globalVisited = new Set<string>();
    
    // Initialize: add all routes from start stop
    const startStop = this.graph!.stops[startStopId];
    for (const routeId of startStop.routes) {
      const route = this.graph!.routes[routeId];
      if (!route) continue;
      
      const startIdx = route.stops.indexOf(startStopId);
      if (startIdx === -1) continue;

      // Follow the route to all subsequent stops
      for (let i = startIdx + 1; i < route.stops.length; i++) {
        const currentStopId = route.stops[i];
        
        // Check if we reached the destination
        if (currentStopId === endStopId) {
          const legStops = route.stops.slice(startIdx, i + 1);
          const leg = this.createLeg(routeId, legStops);
          
          return {
            legs: [leg],
            totalStops: legStops.length,
            transferCount: 0,
            totalDuration: Math.ceil(leg.duration + 5)
          };
        }

        // Add to queue for further exploration
        if (!globalVisited.has(currentStopId)) {
          globalVisited.add(currentStopId);
          queue.push({
            stopId: currentStopId,
            path: [{ routeId, stops: route.stops.slice(startIdx, i + 1) }],
            visitedStops: new Set([startStopId, currentStopId])
          });
        }
      }
    }

    // BFS Loop
    const MAX_TRANSFERS = 3;

    while (queue.length > 0) {
      const state = queue.shift()!;
      
      if (state.path.length > MAX_TRANSFERS) continue;

      const currentStop = this.graph!.stops[state.stopId];
      if (!currentStop) continue;

      // Explore all routes from current stop
      for (const routeId of currentStop.routes) {
        // Skip if this is the same route as the last leg
        if (state.path.length > 0 && state.path[state.path.length - 1].routeId === routeId) {
          continue;
        }

        const route = this.graph!.routes[routeId];
        if (!route) continue;

        const currentIdx = route.stops.indexOf(state.stopId);
        if (currentIdx === -1) continue;

        // Follow the route forward
        for (let i = currentIdx + 1; i < route.stops.length; i++) {
          const nextStopId = route.stops[i];

          // Skip already visited stops in this path
          if (state.visitedStops.has(nextStopId)) continue;

          const legStops = route.stops.slice(currentIdx, i + 1);

          // Check if we reached the destination
          if (nextStopId === endStopId) {
            const newPath = [...state.path, { routeId, stops: legStops }];
            const legs = newPath.map(p => this.createLeg(p.routeId, p.stops));
            const totalStops = newPath.reduce((sum, p) => sum + p.stops.length, 0) - (newPath.length - 1);
            const transferCount = newPath.length - 1;

            // Duration: Sum of legs + Initial Wait (5m) + Transfers (10m each)
            const legsDuration = legs.reduce((sum, leg) => sum + leg.duration, 0);
            const totalDuration = Math.ceil(legsDuration + 5 + (transferCount * 10));

            return {
              legs,
              totalStops,
              transferCount,
              totalDuration
            };
          }

          // Add to queue
          if (!globalVisited.has(nextStopId)) {
            globalVisited.add(nextStopId);
            const newVisited = new Set(state.visitedStops);
            newVisited.add(nextStopId);

            queue.push({
              stopId: nextStopId,
              path: [...state.path, { routeId, stops: legStops }],
              visitedStops: newVisited
            });
          }
        }
      }
    }

    return null; // No route found
  }

  /**
   * Create a RouteLeg object from route ID and stop list
   */
  private createLeg(routeId: string, stops: string[]): RouteLeg {
    const route = this.graph!.routes[routeId];
    const [routeName, direction] = routeId.split('_');

    const fromStop = this.graph!.stops[stops[0]];
    const toStop = this.graph!.stops[stops[stops.length - 1]];

    // Calculate details
    const distanceMeters = this.calculateRouteDistance(stops);
    const distanceKm = distanceMeters / 1000;
    const stopCount = stops.length;
    
    // Match etaCalculator.ts parameters:
    // BASE_MIN_PER_KM = 1.5 (~40 km/h)
    // DWELL_TIME_PER_STOP = 0.5 min
    const BASE_MIN_PER_KM = 1.5;
    const DWELL_TIME_PER_STOP = 0.5;
    
    const travelTimeMinutes = (distanceKm * BASE_MIN_PER_KM) + (stopCount * DWELL_TIME_PER_STOP);

    return {
      routeId,
      routeName: route?.baseRoute || routeName,
      direction: direction || '0',
      fromStop: stops[0],
      toStop: stops[stops.length - 1],
      fromStopName: fromStop?.name || stops[0],
      toStopName: toStop?.name || stops[stops.length - 1],
      stopCount,
      stops,
      duration: travelTimeMinutes
    };
  }

  /**
   * Enrich route results with real-time traffic data
   */
  async enrichWithTraffic(results: RouteResult[]): Promise<RouteResult[]> {
    if (results.length === 0) return [];
    
    // 1. Identify unique routes/directions to fetch
    const routeKeys = new Set<string>();
    results.forEach(res => {
      res.legs.forEach(leg => {
        // key: "routeId:direction" (simplification, depends on ID format)
        // routeId is like "26A_0" or "25_1"
        routeKeys.add(leg.routeId);
      });
    });

    const trafficMap = new Map<string, TrafficSegment[]>();
    
    // 2. Fetch traffic for all needed routes in parallel
    const fetches = Array.from(routeKeys).map(async (key) => {
        const [rName, dir] = key.split('_');
        if (!rName || !dir) return;
        
        // rName might be "H2", "26A"
        // dir is "0" or "1"
        const traffic = await fetchTrafficApi(rName, dir);
        trafficMap.set(key, traffic || []);
    });

    await Promise.all(fetches);

    // 3. Recalculate duration for each leg
    const enrichedResults = results.map(result => {
        const enrichedLegs = result.legs.map(leg => {
           const trafficData = trafficMap.get(leg.routeId);
           if (!trafficData || trafficData.length === 0) return leg; // No change if no data
           
           // Convert leg stops to format expected by etaCalculator
           // We need the full route stops to use indices, or we can just pass the segment
           // calcTravelTime expects list of all stops and indices.
           
           const route = this.graph?.routes[leg.routeId];
           if (!route) return leg;
           
           const allRouteStops = route.stops;
           const startIdx = allRouteStops.indexOf(leg.fromStop);
           const endIdx = allRouteStops.indexOf(leg.toStop);
           
           if (startIdx === -1 || endIdx === -1) return leg;
           
           // Map stops to EtaStop format { staCode: string }
           const etaStops: EtaStop[] = allRouteStops.map(s => ({ staCode: s }));
           
           // Calculate traffic time
           const rideTime = calcTravelTime(etaStops, startIdx, endIdx, trafficData);
           
           // Add dwell time (0.5m per stop)
           const dwellTime = (endIdx - startIdx) * 0.5;
           
           const newDuration = rideTime + dwellTime;
           
           return {
               ...leg,
               duration: newDuration
           };
        });
        
        // Recalculate total duration
        // Sum of legs + 5m initial + 10m * transfers
        const legsDuration = enrichedLegs.reduce((sum, leg) => sum + leg.duration, 0);
        const totalDuration = Math.ceil(legsDuration + 5 + (enrichedLegs.length - 1) * 10);
        
        return {
            ...result,
            legs: enrichedLegs,
            totalDuration
        };
    });

    // 4. Re-sort by fresh total duration
    return enrichedResults.sort((a, b) => {
        const diff = a.totalDuration - b.totalDuration;
        if (Math.abs(diff) > 2) return diff; 
        return a.transferCount - b.transferCount;
    });
  }
  
  /**
   * Calculate total distance for a sequence of stops
   */
  private calculateRouteDistance(stops: string[]): number {
      if (!this.graph || stops.length < 2) return 0;
      
      let totalDist = 0;
      for (let i = 0; i < stops.length - 1; i++) {
          const s1 = this.graph.stops[stops[i]];
          const s2 = this.graph.stops[stops[i+1]];
          
          if (s1?.lat && s1?.lng && s2?.lat && s2?.lng) {
              totalDist += this.haversineDistance(s1.lat, s1.lng, s2.lat, s2.lng);
          } else {
              // Fallback if missing coords: assume 400m per stop
              totalDist += 400;
          }
      }
      return totalDist;
  }

  // ============== Utility Methods ==============

  /**
   * Get all routes serving a stop
   */
  getRoutesForStop(stopId: string): string[] {
    const stop = this.graph?.stops[stopId];
    return stop?.routes || [];
  }

  /**
   * Get all stops on a route
   */
  getStopsForRoute(routeId: string): string[] {
    const route = this.graph?.routes[routeId];
    return route?.stops || [];
  }

  /**
   * Check if two stops share a direct route
   */
  hasDirectRoute(stopA: string, stopB: string): boolean {
    const stopAData = this.graph?.stops[stopA];
    const stopBData = this.graph?.stops[stopB];
    
    if (!stopAData || !stopBData) return false;

    return stopAData.routes.some(r => stopBData.routes.includes(r));
  }

  /**
   * Search stops by ID or Name (partial match)
   */
  searchStops(query: string): BusStop[] {
    if (!this.graph || !query) return [];
    
    const lowerQuery = query.toLowerCase();
    const results: BusStop[] = [];
    
    for (const stop of Object.values(this.graph.stops)) {
      if (
        stop.id.toLowerCase().includes(lowerQuery) || 
        stop.name.toLowerCase().includes(lowerQuery) ||
        (stop.nameEn && stop.nameEn.toLowerCase().includes(lowerQuery)) ||
        (stop.namePt && stop.namePt.toLowerCase().includes(lowerQuery))
      ) {
        results.push(stop);
        if (results.length >= 10) break;
      }
    }
    
    return results;
  }
}

// ============== Singleton Instance ==============

let routeFinderInstance: RouteFinder | null = null;

export function getRouteFinder(): RouteFinder {
  if (!routeFinderInstance) {
    routeFinderInstance = new RouteFinder();
  }
  return routeFinderInstance;
}

export default RouteFinder;
