import govData from '@/data/gov_data.json';

export interface StopInfo {
  name: string;
  lat: number;
  lon: number;
  [key: string]: any;
}

// Helper to get stop info with strict priority
export const getStopInfo = (stopId: string): StopInfo | undefined => {
  const normalizedId = stopId.replace('/', '_');
  const baseId = stopId.split('/')[0].split('_')[0];
  
  // 1. Try strict match first
  let match = govData.stops.find((s: any) => 
    s.raw?.P_ALIAS === stopId || 
    s.raw?.P_ALIAS === normalizedId
  );
  
  // 2. Try Alias match (specific pole alias might match ALIAS?)
  if (!match) {
     match = govData.stops.find((s: any) => 
       s.raw?.ALIAS === stopId || 
       s.raw?.ALIAS === normalizedId
     );
  }
  
  // 3. Fallback to base ID (fuzzy)
  if (!match) {
     match = govData.stops.find((s: any) => 
       s.raw?.ALIAS === baseId || 
       s.raw?.P_ALIAS?.startsWith(baseId + '_')
     );
  }
  
  return match;
};
