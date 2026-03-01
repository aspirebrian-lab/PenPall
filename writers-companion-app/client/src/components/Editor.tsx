import React from 'react';
import { useStoryContext } from '../hooks/useStoryContext';

const Editor: React.FC = () => {
  const { story, setStory } = useStoryContext();

  return (
    <textarea
      value={story}
      onChange={(e) => setStory(e.target.value)}
      rows={16}
      cols={90}
      placeholder="Write your passage here..."
    />
  );
};

export default Editor;