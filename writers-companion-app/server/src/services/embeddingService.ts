import { createEmbedding, getEmbedding } from '../utils/embeddingUtils';

const getErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : 'Unknown error';

export const generateTextEmbedding = async (text: string) => {
    try {
        const embedding = await createEmbedding(text);
        return embedding;
    } catch (error: unknown) {
        throw new Error('Error generating text embedding: ' + getErrorMessage(error));
    }
};

export const retrieveTextEmbedding = async (textId: string) => {
    try {
        const embedding = await getEmbedding(textId);
        return embedding;
    } catch (error: unknown) {
        throw new Error('Error retrieving text embedding: ' + getErrorMessage(error));
    }
};