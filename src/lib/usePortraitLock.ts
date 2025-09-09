import { useEffect, useMemo, useState } from 'react';

function isCoarsePointer(): boolean {
  try {
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

function isSmallViewport(): boolean {
  try {
    return window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
  } catch {
    return (window.innerWidth || 0) <= 900;
  }
}

function isLandscape(): boolean {
  try {
    if (window.matchMedia) return window.matchMedia('(orientation: landscape)').matches;
  } catch {}
  return (window.innerWidth || 0) > (window.innerHeight || 0);
}

export function usePortraitLock() {
  const [lockSupported, setLockSupported] = useState<boolean>(() => typeof (window as any)?.screen?.orientation?.lock === 'function');
  const [blocked, setBlocked] = useState<boolean>(false);

  const mobileLike = useMemo(() => isCoarsePointer() || isSmallViewport(), []);

  useEffect(() => {
    async function tryLock() {
      if (!mobileLike) return;
      const api = (window as any)?.screen?.orientation;
      if (!api || typeof api.lock !== 'function') {
        setLockSupported(false);
        return;
      }
      try {
        await api.lock('portrait');
        setLockSupported(true);
      } catch {
        // Denied or unsupported (common on iOS Safari)
        setLockSupported(false);
      }
    }

    tryLock();

    const update = () => {
      if (!mobileLike) { setBlocked(false); return; }
      const inLandscape = isLandscape();
      // If we couldn't lock and device is landscape, block
      setBlocked(inLandscape && !lockSupported);
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
      try { (window as any)?.screen?.orientation?.unlock?.(); } catch {}
    };
  }, [mobileLike]);

  return { orientationBlocked: blocked };
}

export default usePortraitLock;
