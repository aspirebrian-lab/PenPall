import axios from 'axios';
import { getAISuggestions } from './api';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('api.getAISuggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('posts expected payload and returns response data', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { suggestions: ['Suggestion A'], feedback: 'ok' },
    } as any);

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