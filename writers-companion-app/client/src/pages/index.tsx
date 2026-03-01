import React from 'react';
import Editor from '../components/Editor';
import Chatbox from '../components/Chatbox';
import StoryPanel from '../components/StoryPanel';

const HomePage: React.FC = () => {
    return (
        <div>
            <h1>Writer's Companion</h1>
            <StoryPanel />
            <Editor />
            <Chatbox />
        </div>
    );
};

export default HomePage;