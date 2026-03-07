import axios from 'axios';
import { vi } from 'vitest';
import { getAISuggestions } from './api';

vi.mock('axios');
const mockedAxios = axios as unknown as { post: ReturnType<typeof vi.fn> };

describe('api.getAISuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts expected payload and returns response data', async () => {
    (mockedAxios.post as any) = vi.fn().mockResolvedValue({
      data: { suggestions: ['Suggestion A'], feedback: 'ok' },
    });

    const result = await getAISuggestions('Improve this line', { title: 'Book 1' });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:5001/api/chat/suggestions',
      {
        userInput: 'Improve this line',
        storyContext: { title: 'Book 1' },
      }
    );

    expect(result).toEqual({ suggestions: ['Suggestion A'], feedback: 'ok' });
  });
});