import '@fontsource-variable/source-sans-3';
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/jetbrains-mono';
import '@xyflow/react/dist/style.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Workspace } from './Workspace';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('LibreML root element is missing.');

createRoot(root).render(
  <StrictMode>
    <Workspace />
  </StrictMode>,
);
