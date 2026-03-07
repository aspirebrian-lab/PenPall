import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import Chatbox from './Chatbox';
import { getAISuggestions } from '../services/api';
import { useStoryContext } from '../hooks/useStoryContext';

vi.mock('../services/api', () => ({
  getAISuggestions: vi.fn(),
}));

vi.mock('../hooks/useStoryContext', () => ({
  useStoryContext: vi.fn(),
}));

const mockedGetAISuggestions = getAISuggestions as unknown as ReturnType<typeof vi.fn>;
const mockedUseStoryContext = useStoryContext as unknown as ReturnType<typeof vi.fn>;

describe('Chatbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockedUseStoryContext as any).mockReturnValue({
      story: 'It was a dark and stormy night.',
      setStory: vi.fn(),
    });
  });

  it('sends edit-style prompt with story context when user asks to edit', async () => {
    (mockedGetAISuggestions as any).mockResolvedValue({
      suggestions: ['Revised passage.'],
    });

    render(<Chatbox />);

    fireEvent.change(screen.getByPlaceholderText('Ask for editing suggestions...'), {
      target: { value: 'Please edit this' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(mockedGetAISuggestions).toHaveBeenCalledTimes(1));
    expect(mockedGetAISuggestions).toHaveBeenCalledWith(
      expect.stringContaining('Please edit this passage and return only the revised version:'),
      'It was a dark and stormy night.'
    );

    expect(await screen.findByText(/Revised passage\./i)).toBeInTheDocument();
  });

  it('sends raw user input for non-edit intent', async () => {
    (mockedGetAISuggestions as any).mockResolvedValue({
      feedback: 'General feedback.',
    });

    render(<Chatbox />);

    fireEvent.change(screen.getByPlaceholderText('Ask for editing suggestions...'), {
      target: { value: 'What do you think of the pacing?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(mockedGetAISuggestions).toHaveBeenCalledWith(
        'What do you think of the pacing?',
        'It was a dark and stormy night.'
      )
    );
  });

  it('shows fallback error message when API fails', async () => {
    (mockedGetAISuggestions as any).mockRejectedValue(new Error('Network failure'));

    render(<Chatbox />);

    fireEvent.change(screen.getByPlaceholderText('Ask for editing suggestions...'), {
      target: { value: 'Help me improve this line.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('AI: Request failed.')).toBeInTheDocument();
  });
});