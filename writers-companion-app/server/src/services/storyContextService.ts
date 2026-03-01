import { Story } from '../types';

let storyContext: Story | null = null;

export const saveStoryContext = (story: Story): Story => {
    storyContext = story;
    return storyContext;
};

export const getStoryContext = (): Story | null => {
    return storyContext;
};

export const clearStoryContext = (): void => {
    storyContext = null;
};

export const updateStoryContext = (patch: Partial<Story>): Story => {
    const current: Story = storyContext ?? { title: '', chapters: [] };
    const merged: Story = {
        ...current,
        ...patch,
        chapters: patch.chapters ?? current.chapters,
    };
    storyContext = merged;
    return merged;
};