import React from 'react';
import { useStoryContext } from '../hooks/useStoryContext';
import styled from 'styled-components';

const StoryPanelContainer = styled.div`
  .story-panel {
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }
`;

const StoryPanel: React.FC = () => {
    const { story } = useStoryContext();

    return (
        <StoryPanelContainer>
            <div className="story-panel">
                <h2>Story Context</h2>
                <p>{story || 'No story context yet.'}</p>
                {/* Later: Display tags here */}
            </div>
        </StoryPanelContainer>
    );
};

export default StoryPanel;