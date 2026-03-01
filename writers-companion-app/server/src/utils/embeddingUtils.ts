const embeddingStore = new Map<string, number[]>();

const toEmbedding = (text: string): number[] => {
    return Array.from(text).slice(0, 256).map((char) => char.charCodeAt(0) / 255);
};

export const createEmbedding = async (text: string): Promise<number[]> => {
    const embedding = toEmbedding(text);
    const id = `emb:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    embeddingStore.set(id, embedding);
    return embedding;
};

export const getEmbedding = async (textId: string): Promise<number[] | null> => {
    return embeddingStore.get(textId) ?? null;
};