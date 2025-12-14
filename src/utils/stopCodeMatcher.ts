/**
 * Stop code matching utilities
 * Handles normalization between API codes (e.g., "M11-1") and local data (e.g., "M11_1")
 */

import govData from '../data/gov_data.json';

const stopsData = govData.stops;

interface StopData {
  name: string;
  lat: number;
  lon: number;
  raw?: {
    P_ALIAS?: string;
    ALIAS?: string;
  };
}

/**
 * Normalize a stop code to a consistent format (using / as separator, uppercase)
 */
export const normalizeStopCode = (code: string): string => {
  return (code || '').replace(/[-_]/g, '/').toUpperCase();
};

/**
 * Get the base code (e.g., "T309" from "T309/2")
 */
export const getBaseCode = (code: string): string => {
  return normalizeStopCode(code).split('/')[0];
};

/**
 * Find coordinates for a stop by its staCode
 */
export const getStopCoords = (staCode: string): { lat: number; lon: number } | null => {
  const code = normalizeStopCode(staCode);
  const base = getBaseCode(staCode);

  const match = stopsData.find((local: StopData) => {
    const pAlias = normalizeStopCode(local.raw?.P_ALIAS || '');
    const alias = (local.raw?.ALIAS || '').toUpperCase();

    if (pAlias === code) return true;
    if (alias === code) return true;
    if (alias === base) return true;
    if (pAlias.split('/')[0] === base) return true;

    return false;
  });

  return match ? { lat: match.lat, lon: match.lon } : null;
};

/**
 * Find stop name by staCode
 */
export const getStopName = (staCode: string): string => {
  const code = normalizeStopCode(staCode);
  const base = getBaseCode(staCode);

  const match = stopsData.find((local: StopData) => {
    const pAlias = normalizeStopCode(local.raw?.P_ALIAS || '');
    const alias = (local.raw?.ALIAS || '').toUpperCase();

    if (pAlias === code) return true;
    if (alias === code) return true;
    if (alias === base) return true;
    if (pAlias.split('/')[0] === base) return true;

    return false;
  });

  return match ? match.name : staCode;
};
