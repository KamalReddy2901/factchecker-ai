# FactChecker AI

A Chrome extension for real-time AI-powered fact-checking, built with [WXT](https://wxt.dev), React, and TypeScript. It uses the Google Gemini 2.5 Flash API to extract verifiable claims from selected text or screenshots, search for corroborating sources, and return a clear verdict.

## Features

- **Text selection check** — highlight any text on a page, right-click, and fact-check it instantly
- **Screenshot capture** — draw a region on the screen to fact-check images, headlines, or any visible content
- **Two-pass AI pipeline** — claim extraction followed by grounded web search via Gemini
- **Verdicts** — TRUE, FALSE, MISLEADING, or UNVERIFIABLE with cited sources
- **Floating widget** — non-intrusive result overlay anchored near your selection
- **History panel** — popup tracks every fact-check with daily and total counts
- **Animated UI** — smooth transitions using Framer Motion

## Tech Stack

| Layer | Library / Tool |
|---|---|
| Extension framework | [WXT](https://wxt.dev) |
| UI | React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion |
| AI model | Google Gemini 2.5 Flash |
| Build | Vite (via WXT) |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com/app/apikey) API key (free tier available)

### Installation

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev
```

Then open `chrome://extensions`, enable **Developer mode**, and click **Load unpacked** — select the `.output/chrome-mv3` folder.

### Build for production

```bash
npm run build        # Chrome
npm run build:firefox  # Firefox

npm run zip          # Packaged Chrome zip
npm run zip:firefox  # Packaged Firefox zip
```

## Setup

1. Click the extension icon and go to **Settings**
2. Paste your Gemini API key and click **Test** to validate it
3. Save — you're ready to start fact-checking

## Usage

| Action | How |
|---|---|
| Fact-check selected text | Select text → right-click → *Fact Check Selection* |
| Fact-check a region | Click extension icon → *Capture* → draw a box |
| View history | Click extension icon → *History* tab |
| Dismiss result | Click anywhere outside the widget or press Escape |

## Project Structure

```
entrypoints/
  background.ts          # Service worker — orchestrates API calls & messaging
  content/               # Content script — overlay, widget, and app state
  popup/                 # Popup — history and settings shortcut
  options/               # Options page — API key management
utils/
  api.ts                 # Gemini API calls (claim extraction + grounded search)
  storage.ts             # Chrome storage helpers
  types.ts               # Shared TypeScript types
```

## Privacy

No data is sent to any server other than the Google Gemini API using your own API key. See [privacy policy](website/privacy.html) for details.

## License

MIT
