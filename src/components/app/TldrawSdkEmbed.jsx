import { useCallback, useEffect, useMemo, useState } from 'react';
import '@excalidraw/excalidraw/index.css';
import { debugError, debugLog } from '../../utils/devLogger';

export default function TldrawSdkEmbed({ roomId }) {
  const [ExcalidrawComponent, setExcalidrawComponent] = useState(null);
  const [loadError, setLoadError] = useState('');

  const persistenceKey = useMemo(
    () => `claxi-${roomId || 'session-board'}`,
    [roomId]
  );

  const initialData = useMemo(() => {
    try {
      const persisted = localStorage.getItem(persistenceKey);
      if (!persisted) return undefined;
      return JSON.parse(persisted);
    } catch {
      return undefined;
    }
  }, [persistenceKey]);

  const handleChange = useCallback((elements, appState, files) => {
    try {
      localStorage.setItem(
        persistenceKey,
        JSON.stringify({
          elements,
          appState,
          files,
        })
      );
    } catch {
      // Ignore persistence failures (e.g. storage quota).
    }
  }, [persistenceKey]);

  useEffect(() => {
    let canceled = false;

    async function loadSdk() {
      try {
        setLoadError('');
        debugLog('whiteboard', 'Loading Excalidraw runtime module.');

        const module = await import('@excalidraw/excalidraw');

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
    <div className="h-full w-full">
      <ExcalidrawComponent initialData={initialData} onChange={handleChange} />
    </div>
  );
}
