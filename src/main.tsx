import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-500.css';
import '@fontsource/figtree/latin-600.css';
import '@fontsource/figtree/latin-700.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/source-sans-3/latin-700.css';
import '@fontsource/fraunces/latin-500.css';
import '@fontsource/fraunces/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './styles.css';
import './pwa';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
