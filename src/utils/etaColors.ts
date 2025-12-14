/**
 * ETA display utilities - color coding based on time
 */

/**
 * Get background color class based on ETA
 */
export const getEtaColor = (eta: number): string => {
  if (eta <= 3) return 'bg-green-500';
  if (eta <= 10) return 'bg-yellow-500';
  return 'bg-orange-500';
};

/**
 * Get text color class based on ETA
 */
export const getEtaTextColor = (eta: number): string => {
  if (eta <= 3) return 'text-green-600';
  if (eta <= 10) return 'text-yellow-600';
  return 'text-orange-600';
};
