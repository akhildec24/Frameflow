import { useEffect, useState } from 'react';
import { acquireAssetUrl, releaseAssetUrl } from '../../storage/assetRepository';

interface UrlState {
  key: string | undefined;
  url: string | null;
}

/** Recreates (and reference-counts) a blob: URL for a stored media asset. */
export function useAssetUrl(storageKey: string | undefined): string | null {
  const [state, setState] = useState<UrlState>({ key: undefined, url: null });

  useEffect(() => {
    if (!storageKey) return undefined;
    let cancelled = false;
    let acquiredKey: string | null = null;

    acquireAssetUrl(storageKey)
      .then((resolved) => {
        if (cancelled) {
          releaseAssetUrl(storageKey);
          return;
        }
        acquiredKey = storageKey;
        setState({ key: storageKey, url: resolved });
      })
      .catch(() => {
        if (!cancelled) setState({ key: storageKey, url: null });
      });

    return () => {
      cancelled = true;
      if (acquiredKey) releaseAssetUrl(acquiredKey);
    };
  }, [storageKey]);

  return state.key === storageKey ? state.url : null;
}
