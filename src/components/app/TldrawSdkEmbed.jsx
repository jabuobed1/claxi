import { useEffect, useMemo, useState } from 'react';
import { debugError, debugLog } from '../../utils/devLogger';

const TLDRAW_ESM_URL = 'https://esm.sh/@tldraw/tldraw@2.3.0?bundle';
const TLDRAW_CSS_URL = 'https://esm.sh/@tldraw/tldraw@2.3.0/tldraw.css';

function ensureStylesheet() {
  const existing = document.querySelector(`link[data-tldraw-css="${TLDRAW_CSS_URL}"]`);
  if (existing) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = TLDRAW_CSS_URL;
  link.setAttribute('data-tldraw-css', TLDRAW_CSS_URL);
  document.head.appendChild(link);
}

export default function TldrawSdkEmbed({ roomId, licenseKey }) {
  const [TldrawComponent, setTldrawComponent] = useState(null);
  const [loadError, setLoadError] = useState('');

  const persistenceKey = useMemo(() => `claxi-${roomId || 'session-board'}`, [roomId]);

  useEffect(() => {
    let canceled = false;

    async function loadSdk() {
      try {
        setLoadError('');
        debugLog('tldraw', 'Loading tldraw SDK runtime module.');
        ensureStylesheet();
        const module = await import(/* @vite-ignore */ TLDRAW_ESM_URL);
        if (canceled) return;
        const sdkComponent = module?.Tldraw || module?.default?.Tldraw || null;
        if (!sdkComponent) {
          debugError('tldraw', 'SDK module missing Tldraw export.');
          setLoadError('Tldraw SDK loaded but component export was not found.');
          return;
        }
        debugLog('tldraw', 'tldraw SDK loaded successfully.');
        setTldrawComponent(() => sdkComponent);
      } catch (error) {
        if (canceled) return;
        debugError('tldraw', 'Failed to load tldraw SDK.', { message: error?.message });
        setLoadError(error?.message || 'Unable to load tldraw SDK.');
      }
    }

    loadSdk();

    return () => {
      canceled = true;
    };
  }, []);

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-rose-600">
        {loadError}
      </div>
    );
  }

  if (!TldrawComponent) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-zinc-500">
        Loading collaborative whiteboard SDK...
      </div>
    );
  }

  return <TldrawComponent persistenceKey={persistenceKey} licenseKey={licenseKey || undefined} />;
}
