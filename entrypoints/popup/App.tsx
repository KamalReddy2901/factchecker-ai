import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getHistory,
  deleteFromHistory,
  clearHistory,
  getDailyUsage,
} from '../../utils/storage';
import type { HistoryItem } from '../../utils/types';
import './popup.css';

const VERDICT_STYLES = {
  TRUE: { color: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.25)', icon: '✓' },
  FALSE: { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)', icon: '✗' },
  MISLEADING: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.25)', icon: '⚠' },
  UNVERIFIABLE: { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)', icon: '?' },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function HistoryTab() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dailyUsage, setDailyUsage] = useState(0);

  const load = useCallback(async () => {
    const [h, u] = await Promise.all([getHistory(), getDailyUsage()]);
    setItems(h);
    setDailyUsage(u);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      await deleteFromHistory(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (expanded === id) setExpanded(null);
    },
    [expanded]
  );

  const handleClearAll = useCallback(async () => {
    await clearHistory();
    setItems([]);
    setExpanded(null);
  }, []);

  if (items.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
        <div style={{ fontSize: 36 }}>🔍</div>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', margin: 0 }}>No fact-checks yet.</p>
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center', margin: 0 }}>Click the extension icon on any page to get started.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
          Today: <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{dailyUsage}</span>
          {' '}· Total: <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{items.length}</span>
        </span>
        <button
          onClick={handleClearAll}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: 12, cursor: 'pointer', padding: '2px 6px', borderRadius: 6, transition: 'color 0.15s' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#f87171')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.25)')}
        >
          Clear all
        </button>
      </div>
      <div className="scroll-area">
        {items.map((item) => {
          const cfg = VERDICT_STYLES[item.verdict];
          const isExpanded = expanded === item.id;
          return (
            <div key={item.id} className="history-item" onClick={() => setExpanded(isExpanded ? null : item.id)}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span className="verdict-badge" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, marginTop: 1, flexShrink: 0 }}>
                  {cfg.icon} {item.verdict}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, margin: '0 0 3px', lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap' }}>
                    {item.claim}
                  </p>
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>
                    {timeAgo(item.timestamp)}{item.pageTitle ? ` · ${item.pageTitle.slice(0, 30)}${item.pageTitle.length > 30 ? '…' : ''}` : ''}
                  </span>
                </div>
                <button className="delete-btn" onClick={(e) => handleDelete(e, item.id)}>×</button>
              </div>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                    <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Confidence</span>
                          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600 }}>{item.confidence}%</span>
                        </div>
                        <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${item.confidence}%`, background: cfg.color, borderRadius: 3, opacity: 0.8 }} />
                        </div>
                      </div>
                      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: 0, lineHeight: 1.55 }}>{item.summary}</p>
                      {item.sources.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {item.sources.map((s, i) => (
                            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, fontSize: 11, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>
                              <img src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=12`} width={10} height={10} alt="" style={{ borderRadius: 2 }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />
                              {s.domain}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HowToTab() {
  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '16px' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '0 0 12px', lineHeight: 1.55 }}>Manage your API keys and view usage stats.</p>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', borderRadius: 10, padding: '10px 20px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }}
        >
          Open Settings
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h4 style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Quick tips</h4>
        {[
          { icon: '🖱️', text: 'Click the extension icon, then drag to select any area of the page.' },
          { icon: '✂️', text: 'Highlight text, right-click, and choose "Fact-check this".' },
          { icon: '📸', text: 'Works on images, tweets, articles — anything visible on screen.' },
          { icon: '⌨️', text: 'Results appear right next to your selection in ~2–3 seconds.' },
        ].map((tip, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{tip.icon}</span>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: 0, lineHeight: 1.55 }}>{tip.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PopupApp() {
  const [tab, setTab] = useState<'history' | 'how'>('history');
  const [errorMsg, setErrorMsg] = useState('');

  const triggerOverlayOnActiveTab = useCallback(async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) return;
    if (activeTab.url && (
      activeTab.url.startsWith('chrome://') ||
      activeTab.url.startsWith('edge://') ||
      activeTab.url.startsWith('about:') ||
      activeTab.url.startsWith('chrome-extension://')
    )) {
      setErrorMsg('Cannot run on browser internal pages.');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    try {
      await chrome.tabs.sendMessage(activeTab.id, { type: 'TRIGGER_OVERLAY' });
      window.close();
    } catch {
      setErrorMsg('Refresh the page first, then try again.');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 16px 0', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 9, background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="white" strokeWidth="1.5" />
                <path d="M5 7l1.5 1.5L10 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700 }}><span className="animated-gradient">FactChecker AI</span></span>
          </div>
          {/* Primary CTA */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={triggerOverlayOnActiveTab}
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                border: 'none',
                borderRadius: 10,
                padding: '7px 14px',
                color: 'white',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 12px rgba(124,58,237,0.4)',
                letterSpacing: '0.02em',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="white" strokeWidth="1.3" strokeDasharray="3 1.5" />
                <circle cx="6" cy="6" r="1.5" fill="white" />
              </svg>
              Fact Check
            </button>
            <AnimatePresence>
              {errorMsg && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, background: '#f87171', color: 'white', fontSize: 11, padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap', zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                  {errorMsg}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div style={{ display: 'flex' }}>
          <button className={`tab-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</button>
          <button className={`tab-btn ${tab === 'how' ? 'active' : ''}`} onClick={() => setTab('how')}>How to use</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence mode="wait">
          {tab === 'history' ? (
            <motion.div key="history" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <HistoryTab />
            </motion.div>
          ) : (
            <motion.div key="how" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }} style={{ flex: 1, overflow: 'auto' }}>
              <HowToTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
