import React from 'react';
import ReactDOM from 'react-dom';
import HomePage from './pages';
import { StoryProvider } from './hooks/useStoryContext';
import { GlobalStyle } from './styles/global';

ReactDOM.render(
  <React.StrictMode>
    <GlobalStyle />
    <StoryProvider>
      <HomePage />
    </StoryProvider>
  </React.StrictMode>,
  document.getElementById('root')
);