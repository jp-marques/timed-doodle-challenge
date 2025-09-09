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

      // Target pixel size at current DPR
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const rawW = Math.round(width * dpr);
      const rawH = Math.round(height * dpr);
      // Cap backing size to keep fills fast
      const MAX_PIXEL_W = 1800;
      const scale = rawW > MAX_PIXEL_W ? MAX_PIXEL_W / rawW : 1;
      const nextW = Math.round(rawW * scale);
      const nextH = Math.round(rawH * scale);

      // If nothing changes in bitmap size, just ensure CSS size is correct
      if (canvas.width === nextW && canvas.height === nextH) {
        canvas.style.width = '100%';
        canvas.style.height = `${height}px`;
        return;
      }

      // Preserve existing bitmap before resizing (resizing clears the canvas)
      let backup: HTMLCanvasElement | null = null;
      if (canvas.width > 0 && canvas.height > 0) {
        backup = document.createElement('canvas');
        backup.width = canvas.width;
        backup.height = canvas.height;
        const bctx = backup.getContext('2d');
        if (bctx) {
          bctx.imageSmoothingEnabled = true;
          try { (bctx as any).imageSmoothingQuality = 'high'; } catch {}
          bctx.drawImage(canvas, 0, 0);
        }
      }

      // Apply CSS size and pixel size
      canvas.style.width = '100%';
      canvas.style.height = `${height}px`;
      canvas.width = nextW;
      canvas.height = nextH;

      // Restore previous content scaled to new size
      if (backup) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Prefer smoothing when scaling previous content to avoid pixelation
          ctx.imageSmoothingEnabled = true;
          try { (ctx as any).imageSmoothingQuality = 'high'; } catch {}
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(backup, 0, 0, backup.width, backup.height, 0, 0, canvas.width, canvas.height);
        }
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [canvasRef]);
}



