import ReactDOM from 'react-dom/client';
import App from './App';
import './content.css';

export default defineContentScript({
  matches: ['<all_urls>'],

  main() {
    // Create an isolated root container
    const root = document.createElement('div');
    root.id = 'factchecker-root';
    // Prevent the page's CSS from bleeding in
    root.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647;pointer-events:none;';
    document.documentElement.appendChild(root);

    ReactDOM.createRoot(root).render(<App />);
  },
});
