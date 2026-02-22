export type Verdict = 'TRUE' | 'FALSE' | 'MISLEADING' | 'UNVERIFIABLE';
export type FactCheckStatus =
  | 'idle'
  | 'reading'
  | 'searching'
  | 'analyzing'
  | 'done'
  | 'error';

export interface Source {
  title: string;
  url: string;
  domain: string;
  type: 'news' | 'reddit';
}

export interface FactCheckResult {
  verdict: Verdict;
  confidence: number;
  summary: string;
  sources: Source[];
  claim: string;
  timestamp: number;
  pageUrl: string;
  pageTitle: string;
}

export interface HistoryItem extends FactCheckResult {
  id: string;
}

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ApiKeys {
  gemini: string;
}

// Messages from content script → background
export type BgMessage =
  | {
      type: 'CAPTURE_REQUEST';
      selectionRect: SelectionRect;
      windowWidth: number;
      windowHeight: number;
      pageUrl: string;
      pageTitle: string;
    }
  | {
      type: 'CHECK_TEXT_REQUEST';
      text: string;
      pageUrl: string;
      pageTitle: string;
    }
  | {
      type: 'OPEN_OPTIONS';
    };

// Messages from background → content script (via sendMessage or port)
export type ContentMessage =
  | { type: 'TRIGGER_OVERLAY' }
  | { type: 'TRIGGER_TEXT_CHECK'; text: string }
  | { type: 'STATUS_UPDATE'; status: FactCheckStatus }
  | { type: 'RESULT'; result: FactCheckResult; position: SelectionRect }
  | { type: 'ERROR'; message: string }
  | { type: 'TEXT_RESULT'; result: FactCheckResult };
