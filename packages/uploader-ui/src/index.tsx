import React from 'react';
import ReactDom from 'react-dom/client';
import './index.css';
import App from './app';

const root = ReactDom.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
