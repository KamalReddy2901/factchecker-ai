import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'FactChecker AI',
    description:
      'Real-time AI fact-checking. Screenshot any area or highlight text to instantly verify claims with cited sources.',
    version: '1.0.0',
    permissions: ['activeTab', 'storage', 'contextMenus', 'tabs'],
    action: {
      default_title: 'FactChecker AI — Click to screenshot',
    },
    options_ui: {
      page: 'options/index.html',
      open_in_tab: true,
    },
  },
});
