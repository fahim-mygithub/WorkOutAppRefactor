import React from 'react';
import { createRoot } from 'react-dom/client';
import Phase0Showcase from './Phase0Showcase';

const container = document.getElementById('showcase-root');
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <Phase0Showcase />
    </React.StrictMode>,
  );
}
