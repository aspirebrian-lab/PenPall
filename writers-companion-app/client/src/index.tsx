import React from 'react';
import ReactDOM from 'react-dom/client';
import HomePage from './pages';
import { StoryProvider } from './hooks/useStoryContext';
import { GlobalStyle } from './styles/global';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <GlobalStyle />
    <StoryProvider>
      <HomePage />
    </StoryProvider>
  </React.StrictMode>
);