export interface BusStop {
  staCode: string;
  staName: string;
  latitude: number;
  longitude: number;
  buses: any[];
  trafficLevel?: number;
  [key: string]: any; // Allow other props from API
}

export interface MapBus {
  busPlate: string;
  latitude: number;
  longitude: number;
  status?: string;
  speed?: string | number;
  route?: string;
  dir?: string;
  staCode?: string; // For fallback location based on stop
}

export interface TrafficSegment {
  traffic: number;
  path: number[][];
}

export interface RouteData {
  stops: BusStop[];
  buses: any[];
  raw: any;
  direction: string;
  firstBusTime?: string;
  lastBusTime?: string;
}
