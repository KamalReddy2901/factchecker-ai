import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toPng } from 'html-to-image';
import type { FactCheckResult, FactCheckStatus, SelectionRect } from '../../utils/types';

interface Props {
  status: FactCheckStatus;
  result?: FactCheckResult;
  error?: string;
  position?: SelectionRect;
  onDismiss: () => void;
}

const WIDGET_WIDTH = 360;
const WIDGET_MAX_HEIGHT = 520;

const STATUS_LABELS: Record<string, string> = {
  reading: 'Reading content…',
  searching: 'Searching sources…',
  analyzing: 'Analyzing evidence…',
};

const VERDICT_CONFIG = {
  TRUE: {
    label: 'True',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.12)',
    border: 'rgba(52,211,153,0.25)',
    glow: 'glow-true',
    icon: '✓',
  },
  FALSE: {
    label: 'False',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.12)',
    border: 'rgba(248,113,113,0.25)',
    glow: 'glow-false',
    icon: '✗',
  },
  MISLEADING: {
    label: 'Misleading',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.12)',
    border: 'rgba(251,191,36,0.25)',
    glow: 'glow-misleading',
    icon: '⚠',
  },
  UNVERIFIABLE: {
    label: 'Unverifiable',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.1)',
    border: 'rgba(148,163,184,0.2)',
    glow: 'glow-unverifiable',
    icon: '?',
  },
};

function computePosition(
  pos: SelectionRect | undefined
): { top?: number; bottom?: number; left: number; maxHeight: number } {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const margin = 12;

  if (!pos) {
    // No position info — center horizontally near top
    return {
      top: Math.min(80, vh - WIDGET_MAX_HEIGHT - margin),
      left: Math.max(margin, (vw - WIDGET_WIDTH) / 2),
      maxHeight: WIDGET_MAX_HEIGHT,
    };
  }

  // ── Vertical: prefer below the selection ──
  const spaceBelow = vh - (pos.y + pos.height);
  const spaceAbove = pos.y;
  let top: number | undefined;
  let bottom: number | undefined;
  let maxHeight = WIDGET_MAX_HEIGHT;

  if (spaceBelow >= WIDGET_MAX_HEIGHT + margin || spaceBelow >= spaceAbove) {
    // Place below
    top = pos.y + pos.height + margin;
    maxHeight = Math.min(WIDGET_MAX_HEIGHT, vh - top - margin);
  } else {
    // Place above — widget bottom aligns to selection top
    bottom = vh - pos.y + margin;
    maxHeight = Math.min(WIDGET_MAX_HEIGHT, vh - bottom - margin);
  }

  maxHeight = Math.max(maxHeight, 250);

  // ── Horizontal: align to selection left, clamp to viewport ──
  let left = pos.x;
  if (left + WIDGET_WIDTH > vw - margin) {
    left = vw - WIDGET_WIDTH - margin;
  }
  left = Math.max(margin, left);

  return { top, bottom, left, maxHeight };
}

export default function FloatingWidget({ status, result, error, position, onDismiss }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied'>('idle');
  const pos = computePosition(position);

  // Click outside to dismiss
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    // Delay to avoid immediately dismissing on the mouseup that triggered it
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 300);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onDismiss]);

  const handleCopy = useCallback(async () => {
    if (!cardRef.current || copyState !== 'idle') return;
    setCopyState('copying');
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: 'rgb(10, 10, 20)',
        // Skip cross-origin images (favicons) which cause html-to-image to fail
        filter: (node: HTMLElement) => {
          if (node instanceof HTMLImageElement) {
            try {
              const src = node.src || '';
              if (src && !src.startsWith('data:') && new URL(src).origin !== location.origin) {
                return false;
              }
            } catch {
              return false;
            }
          }
          return true;
        },
      });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (err) {
      console.error('[FactChecker] Copy as image failed:', err);
      // Fallback: try copying the text summary instead
      if (result?.summary) {
        try {
          await navigator.clipboard.writeText(
            `${result.verdict} (${result.confidence}%): ${result.summary}`
          );
          setCopyState('copied');
          setTimeout(() => setCopyState('idle'), 2000);
          return;
        } catch { /* ignore */ }
      }
      setCopyState('idle');
    }
  }, [copyState, result]);

  const cfg = result ? VERDICT_CONFIG[result.verdict] : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 6 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      style={{
        position: 'fixed',
        zIndex: 2147483646,
        width: WIDGET_WIDTH,
        top: pos.top,
        bottom: pos.bottom,
        left: pos.left,
        pointerEvents: 'auto',
      }}
    >
      <div
        ref={cardRef}
        className={`glass ${cfg ? cfg.glow : ''}`}
        style={{
          borderRadius: 18,
          overflow: 'auto',
          maxHeight: pos.maxHeight,
          padding: '16px 18px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="8" stroke="rgba(139,92,246,0.9)" strokeWidth="1.5" />
              <path d="M6 9l2 2 4-4" stroke="rgba(139,92,246,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              FactChecker AI
            </span>
          </div>
          <button
            onClick={onDismiss}
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              width: 26,
              height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.5)',
              fontSize: 14,
              lineHeight: 1,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)')}
          >
            ×
          </button>
        </div>

        {/* Loading skeleton */}
        <AnimatePresence mode="wait">
          {status !== 'done' && status !== 'error' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              {/* Status text */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  className="pulse-dot"
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: 'rgba(139,92,246,0.85)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
                  {STATUS_LABELS[status] ?? 'Starting…'}
                </span>
              </div>

              {/* Skeleton bars */}
              {[100, 85, 65].map((w, i) => (
                <div
                  key={i}
                  className="shimmer"
                  style={{
                    height: i === 0 ? 28 : 14,
                    width: `${w}%`,
                    borderRadius: 8,
                  }}
                />
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                {[40, 35, 28].map((w, i) => (
                  <div
                    key={i}
                    className="shimmer"
                    style={{ height: 28, width: `${w}%`, borderRadius: 20 }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Error state */}
          {status === 'error' && error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                background: 'rgba(248,113,113,0.1)',
                border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: 12,
                padding: '12px 14px',
              }}
            >
              <p style={{ color: '#f87171', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                {error === 'API_KEYS_MISSING' ? (
                  <>
                    ⚙️ API keys not set.{' '}
                    <button
                      onClick={() => chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' })}
                      style={{ background: 'none', border: 'none', color: '#f87171', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: 13 }}
                    >
                      Open options
                    </button>{' '}
                    to configure.
                  </>
                ) : error === 'NO_CLAIM' ? (
                  '🔍 No verifiable claim found. Try selecting text containing a specific factual statement.'
                ) : (
                  `Error: ${error}`
                )}
              </p>
            </motion.div>
          )}

          {/* Result state */}
          {status === 'done' && result && cfg && (
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 13 }}
            >
              {/* Verdict badge */}
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 28, delay: 0.05 }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                  borderRadius: 24,
                  padding: '6px 14px 6px 10px',
                  alignSelf: 'flex-start',
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: cfg.bg,
                    border: `1.5px solid ${cfg.color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: cfg.color,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {cfg.icon}
                </span>
                <span style={{ color: cfg.color, fontWeight: 700, fontSize: 15, letterSpacing: '0.01em' }}>
                  {cfg.label}
                </span>
              </motion.div>

              {/* Confidence bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Confidence
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 600 }}>
                    {result.confidence}%
                  </span>
                </div>
                <div
                  style={{
                    height: 4,
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${result.confidence}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
                    style={{
                      height: '100%',
                      background: cfg.color,
                      borderRadius: 4,
                      opacity: 0.85,
                    }}
                  />
                </div>
              </div>

              {/* Summary */}
              <p
                style={{
                  color: 'rgba(255,255,255,0.82)',
                  fontSize: 13.5,
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                {result.summary}
              </p>

              {/* Sources */}
              {result.sources.length > 0 && (
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
                    Sources
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {result.sources.map((s, i) => (
                      <motion.a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.06 }}
                        className="glass-light"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '4px 10px',
                          borderRadius: 20,
                          textDecoration: 'none',
                          fontSize: 12,
                          color: 'rgba(255,255,255,0.7)',
                          transition: 'all 0.15s',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.color = 'white';
                          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.14)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)';
                          (e.currentTarget as HTMLElement).style.background = '';
                        }}
                      >
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=16`}
                          width={12}
                          height={12}
                          alt=""
                          style={{ borderRadius: 2 }}
                          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
                        />
                        {s.type === 'reddit' ? (
                          <span style={{ color: '#ff6314', fontSize: 11 }}>r/</span>
                        ) : null}
                        {s.domain}
                      </motion.a>
                    ))}
                  </div>
                </div>
              )}

              {/* Copy as image button */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                onClick={handleCopy}
                disabled={copyState === 'copying'}
                style={{
                  marginTop: 2,
                  background:
                    copyState === 'copied'
                      ? 'rgba(52,211,153,0.15)'
                      : 'rgba(255,255,255,0.07)',
                  border: `1px solid ${copyState === 'copied' ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 10,
                  padding: '8px 14px',
                  color:
                    copyState === 'copied'
                      ? '#34d399'
                      : 'rgba(255,255,255,0.6)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: copyState === 'copying' ? 'wait' : 'pointer',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  transition: 'all 0.2s',
                }}
              >
                {copyState === 'copying' ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" style={{ animation: 'spin 0.8s linear infinite' }}>
                      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="22" strokeDashoffset="8" fill="none" />
                    </svg>
                    Generating image…
                  </>
                ) : copyState === 'copied' ? (
                  <>✓ Copied to clipboard!</>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="3" y="1" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                      <rect x="1" y="3" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="rgba(10,10,20,0.8)" />
                    </svg>
                    Copy result as image
                  </>
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
