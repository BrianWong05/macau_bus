/**
 * RouteFinder - Client-side Pathfinding for the Macau Bus Network
 * 
 * Provides pathfinding capabilities using BFS (Breadth-First Search)
 * optimized for fewest transfers rather than fewest stops.
 */

// ============== Types ==============

export interface BusStop {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  routes: string[];
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
}

export interface RouteResult {
  legs: RouteLeg[];
  totalStops: number;
  transferCount: number;
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
   */
  findRoute(startStopId: string, endStopId: string): RouteResult | null {
    if (!this.graph) {
      console.warn('RouteFinder: Graph not loaded');
      return null;
    }

    const startStop = this.graph.stops[startStopId];
    const endStop = this.graph.stops[endStopId];

    if (!startStop || !endStop) {
      console.warn('RouteFinder: Invalid stop IDs');
      return null;
    }

    // Same stop
    if (startStopId === endStopId) {
      return { legs: [], totalStops: 0, transferCount: 0 };
    }

    // ===== Step 1: Check for Direct Route =====
    const directRoute = this.findDirectRoute(startStopId, endStopId);
    if (directRoute) {
      return directRoute;
    }

    // ===== Step 2: BFS for 1-Transfer Routes =====
    const oneTransferRoute = this.findOneTransferRoute(startStopId, endStopId);
    if (oneTransferRoute) {
      return oneTransferRoute;
    }

    // ===== Step 3: General BFS (Multi-Transfer) =====
    return this.findMultiTransferRoute(startStopId, endStopId);
  }

  /**
   * Find a direct route (no transfers)
   */
  private findDirectRoute(startStopId: string, endStopId: string): RouteResult | null {
    const startStop = this.graph!.stops[startStopId];
    const endStop = this.graph!.stops[endStopId];

    // Find common routes
    const commonRoutes = startStop.routes.filter(r => endStop.routes.includes(r));

    for (const routeId of commonRoutes) {
      const route = this.graph!.routes[routeId];
      if (!route) continue;

      const startIdx = route.stops.indexOf(startStopId);
      const endIdx = route.stops.indexOf(endStopId);

      // Must go forward (start before end in the stop sequence)
      if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
        const legStops = route.stops.slice(startIdx, endIdx + 1);
        const leg = this.createLeg(routeId, legStops);

        return {
          legs: [leg],
          totalStops: legStops.length,
          transferCount: 0
        };
      }
    }

    return null;
  }

  /**
   * Find a route with exactly 1 transfer
   */
  private findOneTransferRoute(startStopId: string, endStopId: string): RouteResult | null {
    const startStop = this.graph!.stops[startStopId];
    const endStop = this.graph!.stops[endStopId];

    let bestResult: RouteResult | null = null;
    let bestStopCount = Infinity;

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
            const totalStops = leg1Stops.length + leg2Stops.length - 1; // -1 for transfer stop counted twice

            if (totalStops < bestStopCount) {
              bestStopCount = totalStops;
              bestResult = {
                legs: [
                  this.createLeg(startRouteId, leg1Stops),
                  this.createLeg(endRouteId, leg2Stops)
                ],
                totalStops,
                transferCount: 1
              };
            }
          }
        }
      }
    }

    return bestResult;
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
          return {
            legs: [this.createLeg(routeId, legStops)],
            totalStops: legStops.length,
            transferCount: 0
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

            return {
              legs,
              totalStops,
              transferCount: newPath.length - 1
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

    return {
      routeId,
      routeName: route?.baseRoute || routeName,
      direction: direction || '0',
      fromStop: stops[0],
      toStop: stops[stops.length - 1],
      fromStopName: fromStop?.name || stops[0],
      toStopName: toStop?.name || stops[stops.length - 1],
      stopCount: stops.length,
      stops
    };
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
