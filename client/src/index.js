import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const rootElement = document.getElementById('root');

// Routes pre-rendered by react-snap. Keep in sync with reactSnap.include in package.json.
const PRE_RENDERED_ROUTES = [
  '/',
  '/resources',
  '/resources/how-to-write-an-affidavit',
  '/resources/persuasive-legal-writing-guide',
  '/resources/texas-family-law-affidavits',
  '/resources/notarization-explained',
  '/resources/utah-legal-documents-guide',
  '/resources/arizona-affidavit-requirements',
  '/privacy',
  '/tos',
  '/brand'
];

const isPreRenderedRoute = () => PRE_RENDERED_ROUTES.includes(window.location.pathname);

// hydrateRoot only when the page actually has pre-rendered HTML AND we're on a
// pre-rendered route. Other routes (e.g. /dashboard) get fresh client render.
const shouldHydrate = rootElement.hasChildNodes() && isPreRenderedRoute();

if (shouldHydrate) {
  ReactDOM.hydrateRoot(
    rootElement,
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  if (rootElement.hasChildNodes()) {
    rootElement.innerHTML = '';
  }
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

reportWebVitals();
