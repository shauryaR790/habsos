import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
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
import './styles.css';
import './pos.css';
import './pwa';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
