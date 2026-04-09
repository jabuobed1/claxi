import { useCallback, useMemo } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { debugError } from '../../utils/devLogger';

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

export default function ExcalidrawEmbed({ roomId }) {
  const persistenceKey = useMemo(
    () => `claxi-${roomId || 'session-board'}`,
    [roomId]
  );

  const initialData = useMemo(
    () => readInitialScene(persistenceKey),
    [persistenceKey]
  );

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

  return (
    <div className="h-full w-full">
      <Excalidraw
        initialData={initialData || undefined}
        onChange={handleSceneChange}
      />
    </div>
  );
}