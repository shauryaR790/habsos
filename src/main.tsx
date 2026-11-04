import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-700.css';
import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-500.css';
import '@fontsource/outfit/latin-600.css';
import '@fontsource/outfit/latin-700.css';
import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-500.css';
import '@fontsource/figtree/latin-600.css';
import '@fontsource/figtree/latin-700.css';
import '@fontsource/figtree/latin-800.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/source-sans-3/latin-700.css';
import '@fontsource/fraunces/latin-500.css';
import '@fontsource/fraunces/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-700.css';
import '@fontsource/bodoni-moda/latin-400-italic.css';
import '@fontsource/bodoni-moda/latin-500-italic.css';
import '@fontsource/bodoni-moda/latin-600-italic.css';
import '@fontsource/roboto-condensed/latin-300.css';
import '@fontsource/roboto-condensed/latin-400.css';
import '@fontsource/roboto-condensed/latin-500.css';
import '@fontsource/roboto-condensed/latin-600.css';
import '@fontsource/roboto-condensed/latin-700.css';
import '@fontsource/roboto-condensed/latin-800.css';
import '@fontsource/roboto-condensed/latin-900.css';
import '@fontsource/anton/latin-400.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-700.css';
import './styles.css';
import './guest-app.css';
import './pos.css';
import './odoo-pos.css';
import './pwa';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
