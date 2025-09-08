import { useLayoutEffect } from 'react';

export function useAutoSizedCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement>
): void {
  useLayoutEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const MAX_W = 1350;
      const parent = canvas.parentElement;
      const available = parent ? parent.clientWidth : window.innerWidth;
      const width = Math.min(available, MAX_W);
      const height = Math.round((width * 3) / 4);

      canvas.style.width = '100%';
      canvas.style.height = `${height}px`;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [canvasRef]);
}



