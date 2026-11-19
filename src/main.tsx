import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/instrument-sans/index.css';
import '@fontsource-variable/martian-mono/wdth.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PageFx } from './components/PageFx/PageFx';
import { createLogger } from './lib/logger';
import { Root } from './Root';
import { SmoothScroll } from './lib/smoothScroll';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <SmoothScroll>
      <Root />
      <PageFx />
    </SmoothScroll>
  </StrictMode>,
);
createLogger('app').info('mounted');
// Tells the inline failsafe in index.html that the app booted, so reveals may stay hidden-until-played.
(window as Window & { __appReady?: boolean }).__appReady = true;
