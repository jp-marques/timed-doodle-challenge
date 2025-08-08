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
      const height = Math.round((width * 9) / 16);

      canvas.style.width = '100%';
      canvas.style.height = `${height}px`;
      canvas.width = Math.round(width);
      canvas.height = height;
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [canvasRef]);
}



