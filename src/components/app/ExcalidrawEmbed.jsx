import { useCallback, useEffect, useMemo, useState } from 'react';
import { debugError, debugLog } from '../../utils/devLogger';

const EXCALIDRAW_JS_URL = 'https://esm.sh/@excalidraw/excalidraw@0.18.0?bundle&external=react,react-dom';
const EXCALIDRAW_CSS_URL = 'https://esm.sh/@excalidraw/excalidraw@0.18.0/dist/excalidraw.min.css';

function readInitialScene(persistenceKey) {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(persistenceKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    return {
      elements: parsed?.elements || [],
      appState: parsed?.appState || undefined,
      files: parsed?.files || undefined,
    };
  } catch (error) {
    debugError('whiteboard', 'Failed to parse persisted Excalidraw scene.', {
      message: error?.message,
    });
    return null;
  }
}

function ensureStylesheet() {
  if (typeof document === 'undefined') return;

  const existing = document.querySelector('link[data-excalidraw-css="true"]');
  if (existing) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = EXCALIDRAW_CSS_URL;
  link.setAttribute('data-excalidraw-css', 'true');
  document.head.appendChild(link);
}

export default function ExcalidrawEmbed({ roomId }) {
  const [ExcalidrawComponent, setExcalidrawComponent] = useState(null);
  const [loadError, setLoadError] = useState('');

  const persistenceKey = useMemo(
    () => `claxi-${roomId || 'session-board'}`,
    [roomId]
  );

  const initialData = useMemo(() => readInitialScene(persistenceKey), [persistenceKey]);

  const handleSceneChange = useCallback(
    (elements, appState, files) => {
      if (typeof window === 'undefined') return;

      try {
        window.localStorage.setItem(
          persistenceKey,
          JSON.stringify({ elements, appState, files })
        );
      } catch (error) {
        debugError('whiteboard', 'Failed to persist Excalidraw scene.', {
          message: error?.message,
        });
      }
    },
    [persistenceKey]
  );

  useEffect(() => {
    let canceled = false;

    async function loadSdk() {
      try {
        setLoadError('');
        ensureStylesheet();
        debugLog('whiteboard', 'Loading Excalidraw runtime module.');

        const module = await import(/* @vite-ignore */ EXCALIDRAW_JS_URL);

        if (canceled) return;

        const sdkComponent = module?.Excalidraw || null;

        if (!sdkComponent) {
          debugError('whiteboard', 'SDK module missing Excalidraw export.');
          setLoadError('Whiteboard failed to initialize (missing Excalidraw export).');
          return;
        }

        debugLog('whiteboard', 'Excalidraw loaded successfully.');
        setExcalidrawComponent(() => sdkComponent);
      } catch (error) {
        if (canceled) return;
        debugError('whiteboard', 'Whiteboard SDK load failed.', {
          message: error?.message,
        });
        setLoadError(error?.message || 'Unable to load whiteboard SDK.');
      }
    }

    loadSdk();

    return () => {
      canceled = true;
    };
  }, []);

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="text-sm font-semibold text-rose-600">
          Whiteboard is temporarily unavailable.
        </p>
        <p className="text-xs text-zinc-500">{loadError}</p>
      </div>
    );
  }

  if (!ExcalidrawComponent) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-zinc-500">
        Loading collaborative whiteboard SDK...
      </div>
    );
  }

  return (
    <ExcalidrawComponent
      initialData={initialData || undefined}
      onChange={handleSceneChange}
    />
  );
}
