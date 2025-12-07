import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const rootElement = document.getElementById('root');

// Routes that are pre-rendered by react-snap
// IMPORTANT: Keep this in sync with reactSnap.include in package.json
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

// Check if current path is a pre-rendered route
const isPreRenderedRoute = () => {
  const path = window.location.pathname;
  return PRE_RENDERED_ROUTES.includes(path);
};

// Use hydrateRoot ONLY if:
// 1. The page has pre-rendered content (hasChildNodes)
// 2. AND the current route is actually a pre-rendered route
// This prevents hydration mismatches when visiting non-pre-rendered routes
// (e.g., /dashboard) that still receive pre-rendered HTML from the server
const shouldHydrate = rootElement.hasChildNodes() && isPreRenderedRoute();

if (shouldHydrate) {
  ReactDOM.hydrateRoot(
    rootElement,
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  // For non-pre-rendered routes, clear any stale pre-rendered content
  // and use createRoot for fresh client-side rendering
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

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
