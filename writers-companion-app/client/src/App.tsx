import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StoryProvider } from './hooks/useStoryContext';
import { GlobalStyle } from './styles/global';
import Dashboard from './pages/Dashboard';
import BookWorkspace from './pages/BookWorkspace';
import Editor from './components/Editor';
import Chatbox from './components/Chatbox';
import StoryPanel from './components/StoryPanel';

const App: React.FC = () => {
  return (
    <React.StrictMode>
      <GlobalStyle />
      <StoryProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/books/:id" element={<BookWorkspace />} />
            <Route
              path="/editor"
              element={
                <div>
                  <h1>Writer&apos;s Companion</h1>
                  <StoryPanel />
                  <Editor />
                  <Chatbox />
                </div>
              }
            />
          </Routes>
        </BrowserRouter>
      </StoryProvider>
    </React.StrictMode>
  );
};

export default App;