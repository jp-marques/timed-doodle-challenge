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
          try { (bctx as CanvasRenderingContext2D & { imageSmoothingQuality?: string }).imageSmoothingQuality = 'high'; } catch { /* imageSmoothingQuality not supported in this browser */ }
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
          try { (ctx as CanvasRenderingContext2D & { imageSmoothingQuality?: string }).imageSmoothingQuality = 'high'; } catch { /* imageSmoothingQuality not supported in this browser */ }
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(backup, 0, 0, backup.width, backup.height, 0, 0, canvas.width, canvas.height);
        }
      }
    };

    // Initial sizing
    resize();

    // Respond to viewport changes (including DPR changes on zoom)
    window.addEventListener('resize', resize);

    // Also respond to parent/container size changes (e.g., layout toggles)
    const parent = canvasRef.current?.parentElement || undefined;
    let ro: ResizeObserver | null = null;
    if (parent && 'ResizeObserver' in window) {
      ro = new ResizeObserver(() => resize());
      try { ro.observe(parent); } catch { /* ResizeObserver.observe failed, fallback to window resize only */ }
    }

    return () => {
      window.removeEventListener('resize', resize);
      try { ro?.disconnect(); } catch { /* ResizeObserver.disconnect failed, ignore */ }
    };
  }, [canvasRef]);
}



