import { useCallback, useEffect, useRef, useState } from 'react';

const sources = {
  light: '/media/flight/tower2.png',
  dark: '/media/flight/tower1.webp',
};
type Theme = keyof typeof sources;
const systemTheme = (): Theme => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
const decoded = new Map<string, Promise<void>>();
function preload(src: string) {
  if (!decoded.has(src)) {
    const image = new Image(); image.src = src;
    decoded.set(src, image.decode().catch(error => { decoded.delete(src); throw error; }));
  }
  return decoded.get(src)!;
}

/** Keep the previous decoded photograph visible until its replacement is ready. */
export function useFlightEnvironment() {
  const [environment, setEnvironment] = useState(() => ({ theme: systemTheme(), src: sources[systemTheme()] }));
  const version = useRef(0);
  // Fast Refresh may retain the previous implementation's ref value. Replace
  // it through .current; never mutate a property on that retained value.
  const invalidate = useCallback(() => {
    version.current = (typeof version.current === 'number' ? version.current : 0) + 1;
    return version.current;
  }, []);
  const prepare = useCallback(async () => {
    const token = invalidate();
    const theme = systemTheme();
    await preload(sources[theme]);
    if (token === version.current) setEnvironment({ theme, src: sources[theme] });
  }, [invalidate]);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const change = () => { void prepare().catch(() => { /* Retain the last usable image. */ }); };
    change(); query.addEventListener('change', change);
    return () => { invalidate(); query.removeEventListener('change', change); };
  }, [prepare, invalidate]);
  return { environment, prepare };
}
