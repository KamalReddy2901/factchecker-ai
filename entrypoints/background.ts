import { runFactCheck } from '../utils/api';
import { getApiKeys, addToHistory, incrementUsage } from '../utils/storage';
import type { BgMessage, ContentMessage, FactCheckResult, SelectionRect } from '../utils/types';

export default defineBackground(() => {
  // ── Context menu for text highlight (must be inside onInstalled to avoid dupes) ─
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'factcheck-selection',
      title: 'Fact-check this',
      contexts: ['selection'],
    });
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== 'factcheck-selection' || !tab?.id) return;
    const text = info.selectionText?.trim();
    if (!text) return;
    chrome.tabs.sendMessage(tab.id, {
      type: 'TRIGGER_TEXT_CHECK',
      text,
    } as ContentMessage).catch(() => {});
  });

  // NOTE: chrome.action.onClicked does NOT fire when default_popup is set.
  // The popup's "Fact Check" button triggers the overlay instead.

  // ── Main message handler ────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener(
    (message: BgMessage, sender, sendResponse) => {
      if (message.type === 'OPEN_OPTIONS') {
        chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
        return false;
      }

      if (!sender.tab?.id) return false;
      const tabId = sender.tab.id;

      if (message.type === 'CAPTURE_REQUEST') {
        handleCapture(tabId, message.selectionRect, message.windowWidth, message.windowHeight, message.pageUrl, message.pageTitle);
        sendResponse({ ok: true });
        return false;
      }

      if (message.type === 'CHECK_TEXT_REQUEST') {
        handleTextCheck(tabId, message.text, message.pageUrl, message.pageTitle);
        sendResponse({ ok: true });
        return false;
      }

      return false;
    }
  );
});

// ─── Crop a data URL to a selection rect (HiDPI / Retina-safe) ───────────────
// Uses fetch + createImageBitmap instead of Image() which is unavailable in MV3 service workers
async function cropScreenshot(
  dataUrl: string,
  rect: SelectionRect,
  windowWidth: number,
  windowHeight: number
): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);

  const scaleX = bitmap.width / windowWidth;
  const scaleY = bitmap.height / windowHeight;

  const sx = Math.round(rect.x * scaleX);
  const sy = Math.round(rect.y * scaleY);
  const sw = Math.round(rect.width * scaleX);
  const sh = Math.round(rect.height * scaleY);

  const canvas = new OffscreenCanvas(sw, sh);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  bitmap.close();

  const outBlob = await canvas.convertToBlob({ type: 'image/png' });
  const buffer = await outBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // Fast chunked btoa — avoids O(n²) string concat and call-stack overflow
  const CHUNK = 65536;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]));
  }
  return btoa(parts.join(''));
}

function send(tabId: number, msg: ContentMessage) {
  chrome.tabs.sendMessage(tabId, msg).catch(() => {});
}

async function handleCapture(
  tabId: number,
  rect: SelectionRect,
  windowWidth: number,
  windowHeight: number,
  pageUrl: string,
  pageTitle: string
) {
  try {
    const keys = await getApiKeys();
    if (!keys?.gemini) {
      send(tabId, { type: 'ERROR', message: 'API_KEYS_MISSING' });
      return;
    }

    const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
    const imageBase64 = await cropScreenshot(dataUrl, rect, windowWidth, windowHeight);

    const result = await runFactCheck(
      keys.gemini,
      { imageBase64 },
      { pageUrl, pageTitle },
      (status) => send(tabId, { type: 'STATUS_UPDATE', status: status as any })
    );

    const id = crypto.randomUUID();
    const item = { ...result, id };
    await addToHistory(item);
    await incrementUsage();
    send(tabId, { type: 'RESULT', result: item, position: rect });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    send(tabId, {
      type: 'ERROR',
      message: msg === 'NO_CLAIM' ? 'NO_CLAIM' : msg,
    });
  }
}

async function handleTextCheck(
  tabId: number,
  text: string,
  pageUrl: string,
  pageTitle: string
) {
  try {
    const keys = await getApiKeys();
    if (!keys?.gemini) {
      send(tabId, { type: 'ERROR', message: 'API_KEYS_MISSING' });
      return;
    }

    const result = await runFactCheck(
      keys.gemini,
      { text },
      { pageUrl, pageTitle },
      (status) => send(tabId, { type: 'STATUS_UPDATE', status: status as any })
    );

    const id = crypto.randomUUID();
    const item = { ...result, id };
    await addToHistory(item);
    await incrementUsage();
    send(tabId, { type: 'TEXT_RESULT', result: item });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    send(tabId, {
      type: 'ERROR',
      message: msg === 'NO_CLAIM' ? 'NO_CLAIM' : msg,
    });
  }
}
