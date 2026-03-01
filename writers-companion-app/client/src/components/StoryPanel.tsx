import React from 'react';
import { useStoryContext } from '../hooks/useStoryContext';

const StoryPanel: React.FC = () => {
    const { story } = useStoryContext();

    return (
        <div className="story-panel">
            <h2>Story Context</h2>
            <p>{story || 'No story context yet.'}</p>
        </div>
    );
};

export default StoryPanel;