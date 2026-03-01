import React from 'react';
import ReactDOM from 'react-dom';
import HomePage from './pages';
import { StoryProvider } from './hooks/useStoryContext';

ReactDOM.render(
  <React.StrictMode>
    <StoryProvider>
      <HomePage />
    </StoryProvider>
  </React.StrictMode>,
  document.getElementById('root')
);