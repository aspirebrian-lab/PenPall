import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './Dashboard';
import Editor from '../components/Editor';
import Chatbox from '../components/Chatbox';
import StoryPanel from '../components/StoryPanel';
import { StoryProvider } from '../hooks/useStoryContext';
import { GlobalStyle } from '../styles/global';
import BookWorkspace from './BookWorkspace';

const HomePage: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/books/:id" element={<BookWorkspace />} />
        <Route
          path="/editor"
          element={
            <div>
              <h1>Writer's Companion</h1>
              <StoryPanel />
              <Editor />
              <Chatbox />
            </div>
          }
        />
      </Routes>
    </Router>
  );
};

ReactDOM.render(
  <React.StrictMode>
    <GlobalStyle />
    <StoryProvider>
      <HomePage />
    </StoryProvider>
  </React.StrictMode>,
  document.getElementById('root')
);

export default HomePage;