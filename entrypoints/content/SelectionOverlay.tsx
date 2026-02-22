import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SelectionRect } from '../../utils/types';

interface Props {
  onCapture: (rect: SelectionRect) => void;
  onCancel: () => void;
}

interface DragState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  isDragging: boolean;
}

function normalizeRect(drag: DragState): SelectionRect {
  return {
    x: Math.min(drag.startX, drag.endX),
    y: Math.min(drag.startY, drag.endY),
    width: Math.abs(drag.endX - drag.startX),
    height: Math.abs(drag.endY - drag.startY),
  };
}

export default function SelectionOverlay({ onCapture, onCancel }: Props) {
  const [drag, setDrag] = useState<DragState>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    isDragging: false,
  });
  const [hasDragged, setHasDragged] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Disable iframes from eating mouse events during drag
  const disableIframes = useCallback(() => {
    document.querySelectorAll('iframe').forEach((f) => {
      f.dataset.prevPointerEvents = f.style.pointerEvents;
      f.style.pointerEvents = 'none';
    });
  }, []);

  const restoreIframes = useCallback(() => {
    document.querySelectorAll('iframe').forEach((f) => {
      f.style.pointerEvents = f.dataset.prevPointerEvents ?? '';
      delete f.dataset.prevPointerEvents;
    });
  }, []);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      disableIframes();
      // Disable text selection on the whole page
      document.documentElement.style.userSelect = 'none';

      setDrag({
        startX: e.clientX,
        startY: e.clientY,
        endX: e.clientX,
        endY: e.clientY,
        isDragging: true,
      });
      setHasDragged(false);
    },
    [disableIframes]
  );

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setDrag((prev) => {
      if (!prev.isDragging) return prev;
      return { ...prev, endX: e.clientX, endY: e.clientY };
    });
    setHasDragged(true);
  }, []);

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      restoreIframes();
      document.documentElement.style.userSelect = '';

      setDrag((prev) => {
        if (!prev.isDragging) return prev;
        const updated = { ...prev, endX: e.clientX, endY: e.clientY, isDragging: false };
        const rect = normalizeRect(updated);
        // Only capture if selection is large enough
        if (rect.width > 10 && rect.height > 10) {
          setTimeout(() => onCapture(rect), 50);
        } else {
          onCancel();
        }
        return updated;
      });
    },
    [onCapture, onCancel, restoreIframes]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        restoreIframes();
        document.documentElement.style.userSelect = '';
        onCancel();
      }
    },
    [onCancel, restoreIframes]
  );

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    overlay.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      overlay.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      restoreIframes();
      document.documentElement.style.userSelect = '';
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleKeyDown, restoreIframes]);

  const selRect = normalizeRect(drag);
  const showRect = hasDragged && drag.isDragging;

  return (
    <motion.div
      ref={overlayRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        cursor: 'crosshair',
        background: 'rgba(0, 0, 0, 0.35)',
        pointerEvents: 'auto',
      }}
    >
      {/* Hint text */}
      <AnimatePresence>
        {!hasDragged && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            style={{
              position: 'absolute',
              top: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(10,10,20,0.85)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 12,
              padding: '10px 20px',
              color: 'rgba(255,255,255,0.9)',
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}
          >
            Drag to select the area you want to fact-check &nbsp;·&nbsp;{' '}
            <span style={{ opacity: 0.55 }}>Esc to cancel</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selection rectangle */}
      {showRect && (
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          {/* Bright cutout border */}
          <rect
            x={selRect.x}
            y={selRect.y}
            width={selRect.width}
            height={selRect.height}
            fill="none"
            stroke="white"
            strokeWidth={1.5}
            strokeDasharray="8 4"
            className="marching-ants"
          />
          {/* Corner handles */}
          {[
            [selRect.x, selRect.y],
            [selRect.x + selRect.width, selRect.y],
            [selRect.x, selRect.y + selRect.height],
            [selRect.x + selRect.width, selRect.y + selRect.height],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={4} fill="white" opacity={0.9} />
          ))}
          {/* Dimension label */}
          {selRect.width > 60 && selRect.height > 30 && (
            <text
              x={selRect.x + selRect.width / 2}
              y={selRect.y + selRect.height / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(255,255,255,0.45)"
              fontSize={12}
              fontFamily="-apple-system, sans-serif"
            >
              {Math.round(selRect.width)} × {Math.round(selRect.height)}
            </text>
          )}
        </svg>
      )}
    </motion.div>
  );
}
