export type Book = {
    id: string;
    title: string;
    author: string;
    chapters: Chapter[];
};

export type Chapter = {
    id: string;
    title: string;
    content: string;
};

export type AIRequest = {
    prompt: string;
    context: string;
};

export type AIResponse = {
    suggestions: string[];
    feedback: string;
};

export type Story = {
    title: string;
    chapters: Chapter[];
};