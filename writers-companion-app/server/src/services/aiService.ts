import axios from 'axios';
import { AIResponse } from '../types';

const getOpenAIKey = (): string => process.env.OPENAI_API_KEY || '';
const getModel = (): string => process.env.AI_MODEL || 'gpt-4.1-mini';

const fallback = (text: string, context?: string): AIResponse => ({
  suggestions: [
    `Tighten phrasing: "${text}"`,
    'Clarify imagery and reduce stacked metaphors.',
    'Use active verbs and concrete nouns.',
  ],
  feedback: context
    ? 'Used provided story context. Suggestion generated in local fallback mode.'
    : 'No external AI configured. Suggestion generated in local fallback mode.',
});

const parseOutputText = (data: any): string => {
  if (data?.output_text) return data.output_text;
  const parts =
    data?.output?.flatMap((o: any) =>
      (o?.content || [])
        .filter((c: any) => c?.type === 'output_text' && c?.text)
        .map((c: any) => c.text)
    ) || [];
  return parts.join('\n').trim();
};

const callModel = async (instruction: string): Promise<string> => {
  const apiKey = getOpenAIKey();
  const model = getModel();

  const response = await axios.post(
    'https://api.openai.com/v1/responses',
    { model, input: instruction },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const text = parseOutputText(response.data);
  if (!text) throw new Error('Model returned empty output');
  return text;
};

const errMsg = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;
    return `OpenAI error ${status ?? ''}: ${JSON.stringify(data)}`;
  }
  return error instanceof Error ? error.message : 'Unknown error';
};

export const getEditingSuggestions = async (text: string): Promise<AIResponse> => {
  if (!getOpenAIKey()) return fallback(text);

  try {
    const instruction = [
      'You are a fiction line editor.',
      'Rewrite the passage for clarity, flow, and voice consistency.',
      'Preserve meaning and POV.',
      'Return only the revised passage.',
      '',
      text,
    ].join('\n');
    const editedText = await callModel(instruction);
    return { suggestions: [editedText], feedback: 'AI-generated edit.' };
  } catch (error: unknown) {
    const errorMessage = errMsg(error);
    console.error(errorMessage);
    return fallback(text);
  }
};

export const analyzeStoryContext = async (userMessage: string, story: string): Promise<AIResponse> => {
  if (!getOpenAIKey()) return fallback(userMessage, story);

  try {
    const instruction = `Story context:\n${story}\n\nUser request:\n${userMessage}`;
    const result = await callModel(instruction);
    return { suggestions: [result], feedback: 'AI-generated response using story context.' };
  } catch (error: unknown) {
    const errorMessage = errMsg(error);
    console.error(errorMessage);
    return fallback(userMessage, story);
  }
};

export async function getAIResponse(message: string, storyContext?: unknown): Promise<AIResponse> {
  const contextText =
    typeof storyContext === 'string'
      ? storyContext
      : storyContext
      ? JSON.stringify(storyContext)
      : '';

  const isEditIntent = /edit|rewrite|improve|polish|fix/i.test(message);

  if (isEditIntent && contextText.trim()) {
    return getEditingSuggestions(contextText);
  }

  if (contextText) return analyzeStoryContext(message, contextText);
  return getEditingSuggestions(message);
}