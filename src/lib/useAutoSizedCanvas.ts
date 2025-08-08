import { useLayoutEffect } from 'react';

export function useAutoSizedCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement>
): void {
  useLayoutEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Preserve current bitmap before resizing, since changing width/height clears the canvas
      const previousWidth = canvas.width;
      const previousHeight = canvas.height;
      let backupCanvas: HTMLCanvasElement | null = null;
      if (previousWidth > 0 && previousHeight > 0) {
        backupCanvas = document.createElement('canvas');
        backupCanvas.width = previousWidth;
        backupCanvas.height = previousHeight;
        const backupCtx = backupCanvas.getContext('2d');
        const currentCtx = canvas.getContext('2d');
        if (backupCtx && currentCtx) {
          backupCtx.drawImage(canvas, 0, 0);
        }
      }

      const MAX_W = 1350;
      const parent = canvas.parentElement;
      const available = parent ? parent.clientWidth : window.innerWidth;
      const width = Math.min(available, MAX_W);
      const height = Math.round((width * 9) / 16);

      // Account for device pixel ratio so drawings remain crisp on zoom/retina
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const targetWidth = Math.round(width * dpr);
      const targetHeight = Math.round(height * dpr);

      // Set CSS size (layout) in CSS pixels
      canvas.style.width = '100%';
      canvas.style.height = `${height}px`;
      // Set backing store size in device pixels
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // Restore previous bitmap scaled to the new size
      if (backupCanvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(
            backupCanvas,
            0,
            0,
            backupCanvas.width,
            backupCanvas.height,
            0,
            0,
            canvas.width,
            canvas.height
          );
        }
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [canvasRef]);
}




