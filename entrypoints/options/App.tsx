import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiKeys, setApiKeys, getDailyUsage } from '../../utils/storage';

type TestState = 'idle' | 'testing' | 'valid' | 'invalid';

async function testGeminiKey(key: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
      }
    );
    return res.status !== 400 && res.status !== 403;
  } catch {
    return false;
  }
}

export default function OptionsApp() {
  const [geminiKey, setGeminiKey] = useState('');
  const [testState, setTestState] = useState<TestState>('idle');
  const [saved, setSaved] = useState(false);
  const [dailyUsage, setDailyUsage] = useState(0);
  const [hasExistingKey, setHasExistingKey] = useState(false);

  useEffect(() => {
    getApiKeys().then((keys) => {
      if (keys?.gemini) {
        setGeminiKey(keys.gemini);
        setHasExistingKey(true);
      }
    });
    getDailyUsage().then(setDailyUsage);
  }, []);

  const handleTest = useCallback(async () => {
    if (!geminiKey.trim()) return;
    setTestState('testing');
    const ok = await testGeminiKey(geminiKey.trim());
    setTestState(ok ? 'valid' : 'invalid');
  }, [geminiKey]);

  const handleSave = useCallback(async () => {
    if (!geminiKey.trim()) return;
    await setApiKeys({ gemini: geminiKey.trim() });
    setSaved(true);
    setHasExistingKey(true);
    setTimeout(() => setSaved(false), 2500);
  }, [geminiKey]);

  return (
    <div style={{ minHeight: '100vh', background: '#070711', overflow: 'hidden', position: 'relative' }}>
      {/* Background glow orbs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: -200, left: -200, width: 600, height: 600, background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', top: -100, right: -200, width: 500, height: 500, background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)', borderRadius: '50%' }} />
      </div>

      <div style={{ maxWidth: 620, margin: '0 auto', padding: '60px 24px', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 48, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 24px rgba(124,58,237,0.4)' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="11" r="9" stroke="white" strokeWidth="1.8" />
                <path d="M8 11l2.5 2.5L15 8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
              <span className="animated-gradient">FactChecker AI</span>
            </h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, margin: 0 }}>
            Real-time AI fact-checking — powered entirely by one free API key.
          </p>
        </motion.div>

        {/* How it works */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card" style={{ padding: '24px', marginBottom: 24 }}>
          <h3 style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>How it works</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[
              { icon: '📸', title: 'Screenshot or highlight', desc: 'Click the icon, drag over any content — or highlight text and right-click.' },
              { icon: '🔍', title: 'AI reads & searches', desc: 'Gemini reads the claim, then uses built-in Google Search to find evidence and Reddit discussions.' },
              { icon: '✓', title: 'Instant verdict', desc: 'TRUE / FALSE / MISLEADING / UNVERIFIABLE with cited sources in ~3 seconds.' },
            ].map((item) => (
              <div key={item.title} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{item.icon}</div>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>{item.title}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Free tier info banner */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 14, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🎉</span>
          <div>
            <p style={{ color: '#34d399', fontSize: 13, fontWeight: 600, margin: '0 0 3px' }}>100% free — no credit card, ever</p>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: 0, lineHeight: 1.55 }}>
              Uses a single Google Gemini API key (free tier: 1,500 requests/day). Web search is powered by Gemini's <strong style={{ color: 'rgba(255,255,255,0.65)' }}>built-in Google Search</strong> — no separate search API needed.
            </p>
          </div>
        </motion.div>

        {/* Gemini API key card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="glass-card" style={{ padding: '28px', marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4285f4' }} />
                <h3 style={{ color: 'white', fontSize: 16, fontWeight: 600, margin: 0 }}>Google Gemini API Key</h3>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>
                Free tier · 1,500 requests/day · No credit card
              </p>
            </div>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="link" style={{ marginTop: 2, whiteSpace: 'nowrap' }}>
              Get free key →
            </a>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
            <input
              type="password"
              className="input-field"
              placeholder="AIzaSy..."
              value={geminiKey}
              onChange={(e) => { setGeminiKey(e.target.value); setTestState('idle'); }}
              onKeyDown={(e) => e.key === 'Enter' && handleTest()}
            />
            <button className="btn-test" onClick={handleTest} disabled={!geminiKey.trim() || testState === 'testing'}>
              {testState === 'testing' ? (
                <svg className="spin" width="13" height="13" viewBox="0 0 13 13">
                  <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20" strokeDashoffset="7" fill="none" />
                </svg>
              ) : 'Test'}
            </button>
            <AnimatePresence>
              {testState === 'valid' && (
                <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} style={{ color: '#34d399', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>✓ Valid</motion.span>
              )}
              {testState === 'invalid' && (
                <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} style={{ color: '#f87171', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>✗ Invalid</motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Step-by-step instructions */}
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px' }}>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>How to get your key</p>
            {[
              'Go to aistudio.google.com/app/apikey (link above)',
              'Sign in with any Google account',
              'Click "Create API key" → Copy it',
              'Paste it here and click Test',
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i < 3 ? 6 : 0 }}>
                <span style={{ color: 'rgba(139,92,246,0.8)', fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}.</span>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: 0, lineHeight: 1.5 }}>{step}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Save + usage */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
            {hasExistingKey && (
              <>Today: <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{dailyUsage}</span> checks</>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <AnimatePresence>
              {saved && (
                <motion.span initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} style={{ color: '#34d399', fontSize: 14, fontWeight: 600 }}>
                  ✓ Key saved
                </motion.span>
              )}
            </AnimatePresence>
            <button className="btn-primary" onClick={handleSave} disabled={!geminiKey.trim()}>
              Save key
            </button>
          </div>
        </motion.div>

        {/* Privacy note */}
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, textAlign: 'center', marginTop: 40, lineHeight: 1.6 }}>
          🔒 Your API key is stored locally on your device using Chrome's secure storage. It is sent only to Google's Gemini API directly from your browser.
        </motion.p>
      </div>
    </div>
  );
}

