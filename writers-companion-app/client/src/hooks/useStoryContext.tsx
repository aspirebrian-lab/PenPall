import React, { createContext, useContext, useState } from 'react';

type StoryContextValue = {
  story: string;
  setStory: React.Dispatch<React.SetStateAction<string>>;
};

const StoryContext = createContext<StoryContextValue | undefined>(undefined);

export const StoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [story, setStory] = useState('');

  return (
    <StoryContext.Provider value={{ story, setStory }}>
      {children}
    </StoryContext.Provider>
  );
};

export const useStoryContext = (): StoryContextValue => {
  const context = useContext(StoryContext);
  if (!context) {
    throw new Error('useStoryContext must be used within a StoryProvider');
  }
  return context;
};