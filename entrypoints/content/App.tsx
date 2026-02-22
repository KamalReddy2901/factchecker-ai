import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import SelectionOverlay from './SelectionOverlay';
import FloatingWidget from './FloatingWidget';
import type { ContentMessage, FactCheckResult, FactCheckStatus, SelectionRect } from '../../utils/types';

type AppState =
  | { mode: 'idle' }
  | { mode: 'overlay' }
  | { mode: 'loading'; status: FactCheckStatus; position?: SelectionRect }
  | { mode: 'result'; result: FactCheckResult; position?: SelectionRect }
  | { mode: 'error'; message: string; position?: SelectionRect };

export default function App() {
  const [state, setState] = useState<AppState>({ mode: 'idle' });

  const dismiss = useCallback(() => setState({ mode: 'idle' }), []);

  const handleCapture = useCallback((rect: SelectionRect) => {
    setState({ mode: 'loading', status: 'reading', position: rect });

    // Delay capture slightly so the overlay fully unmounts and isn't
    // captured in the screenshot (AnimatePresence exit takes ~150ms)
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: 'CAPTURE_REQUEST',
        selectionRect: rect,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: document.documentElement.clientHeight,
        pageUrl: location.href,
        pageTitle: document.title,
      });
    }, 250);
  }, []);

  // Grab the position of the current text selection so the widget
  // appears next to it instead of at a default corner position.
  const getSelectionPosition = useCallback((): SelectionRect | undefined => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return undefined;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return undefined;
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }, []);

  const handleTextCheck = useCallback((text: string) => {
    const pos = getSelectionPosition();
    setState({ mode: 'loading', status: 'reading', position: pos });
    chrome.runtime.sendMessage({
      type: 'CHECK_TEXT_REQUEST',
      text,
      pageUrl: location.href,
      pageTitle: document.title,
    });
  }, [getSelectionPosition]);

  useEffect(() => {
    const listener = (message: ContentMessage) => {
      switch (message.type) {
        case 'TRIGGER_OVERLAY':
          setState({ mode: 'overlay' });
          break;

        case 'TRIGGER_TEXT_CHECK':
          if ('text' in message && message.text) {
            handleTextCheck(message.text);
          }
          break;

        case 'STATUS_UPDATE':
          setState((prev) =>
            prev.mode === 'loading'
              ? { ...prev, status: message.status as FactCheckStatus }
              : prev
          );
          break;

        case 'RESULT':
          setState({ mode: 'result', result: message.result, position: message.position });
          break;

        case 'TEXT_RESULT':
          setState((prev) => ({
            mode: 'result',
            result: message.result,
            position: 'position' in prev ? (prev as any).position : undefined,
          }));
          break;

        case 'ERROR':
          setState((prev) => ({
            mode: 'error',
            message: message.message,
            position: 'position' in prev ? (prev as any).position : undefined,
          }));
          break;
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [handleTextCheck]);

  return (
    <AnimatePresence>
      {state.mode === 'overlay' && (
        <SelectionOverlay
          key="overlay"
          onCapture={handleCapture}
          onCancel={dismiss}
        />
      )}

      {(state.mode === 'loading' || state.mode === 'result' || state.mode === 'error') && (
        <FloatingWidget
          key="widget"
          status={
            state.mode === 'loading'
              ? state.status
              : state.mode === 'result'
              ? 'done'
              : 'error'
          }
          result={state.mode === 'result' ? state.result : undefined}
          error={state.mode === 'error' ? state.message : undefined}
          position={
            (state.mode === 'loading' || state.mode === 'result' || state.mode === 'error')
              ? state.position
              : undefined
          }
          onDismiss={dismiss}
        />
      )}
    </AnimatePresence>
  );
}
