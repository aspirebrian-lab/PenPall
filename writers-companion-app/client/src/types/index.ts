export type Story = {
    title: string;
    chapters: Chapter[];
};

export type Chapter = {
    title: string;
    content: string;
    order: number;
};

export type AIResponse = {
    suggestions: string[];
    feedback: string;
};