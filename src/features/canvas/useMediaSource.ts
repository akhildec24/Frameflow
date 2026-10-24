import { useEffect, useState } from 'react';
import { useAssetUrl } from '../media/useAssetUrl';
import type { MediaAsset } from '../../lib/types';

export type MediaSource = HTMLImageElement | HTMLVideoElement;

interface SourceState {
  url: string | null;
  source: MediaSource | null;
}

/** Loads a decoded image/video element for an asset, suitable as a Konva image source. */
export function useMediaSource(asset: MediaAsset | undefined): MediaSource | null {
  const url = useAssetUrl(asset?.status === 'ready' ? asset.storageKey : undefined);
  const [state, setState] = useState<SourceState>({ url: null, source: null });

  useEffect(() => {
    if (!url || !asset) return undefined;
    let cancelled = false;

    if (asset.type === 'image') {
      const img = new window.Image();
      img.onload = () => {
        if (!cancelled) setState({ url, source: img });
      };
      img.src = url;
      return () => {
        cancelled = true;
      };
    }

    if (asset.type === 'video') {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.loop = true;
      video.preload = 'auto';
      video.onloadeddata = () => {
        if (!cancelled) {
          void video.play().catch(() => {});
          setState({ url, source: video });
        }
      };
      video.src = url;
      return () => {
        cancelled = true;
        video.src = '';
      };
    }

    return undefined;
  }, [url, asset]);

  return state.url === url ? state.source : null;
}
