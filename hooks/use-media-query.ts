import { useState, useEffect } from 'react';
 
/**
 * Hook para detectar media queries e responsividade
 * @param query - Media query string (ex: "(max-width: 768px)")
 * @returns boolean indicando se a media query está ativa
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
 
  useEffect(() => {
    const media = window.matchMedia(query);
    
    // Set initial value
    setMatches(media.matches);
 
    // Create event listener
    const listener = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };
 
    // Add listener
    media.addEventListener('change', listener);
 
    // Cleanup
    return () => {
      media.removeEventListener('change', listener);
    };
  }, [query]);
 
  return matches;
}