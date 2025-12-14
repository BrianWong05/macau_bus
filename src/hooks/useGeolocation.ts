/**
 * Custom hook for browser geolocation
 */

import { useState, useEffect } from 'react';

export interface GeolocationState {
  location: { lat: number; lon: number } | null;
  error: string;
  loading: boolean;
}

export const useGeolocation = () => {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      setLoading(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      setError('Location request timed out.');
      setLoading(false);
    }, 10000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId);
        setLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setLoading(false);
      },
      (err) => {
        clearTimeout(timeoutId);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => clearTimeout(timeoutId);
  }, []);

  return { location, error, loading };
};
