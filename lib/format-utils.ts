/**
 * Compacts large numbers into 'k' notation (e.g., 1200 -> 1.2k, 10000 -> 10k).
 */
export function formatCompactNumber(num: number): string {
  if (num < 1000) {
    return num.toString();
  }
  
  const k = num / 1000;
  
  if (k >= 10) {
    // For 10k+, avoid decimals unless it's like 10.5k
    const formatted = k.toFixed(1).replace(/\.0$/, '');
    return `${formatted}k`;
  }
  
  // For 1k-9.9k, use one decimal place if needed
  return `${k.toFixed(1).replace(/\.0$/, '')}k`;
}
