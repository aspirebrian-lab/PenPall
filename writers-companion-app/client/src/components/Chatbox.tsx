import React, { useState } from 'react';
import { getAISuggestions } from '../services/api';
import { useStoryContext } from '../hooks/useStoryContext';

const Chatbox: React.FC = () => {
    const [input, setInput] = useState('');
    const [responses, setResponses] = useState<string[]>([]);
    const { story } = useStoryContext();

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInput(event.target.value);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!input.trim()) return;

        const userRequest = /edit|rewrite|improve/i.test(input)
            ? `Please edit this passage and return only the revised version:\n\n${story}`
            : input;

        try {
            const data = await getAISuggestions(userRequest, story);

            const aiText =
                data.suggestion ??
                (data.suggestions && data.suggestions.length > 0
                    ? data.suggestions.join('\n')
                    : data.feedback ?? 'No suggestion returned.');

            setResponses((prev) => [...prev, `You: ${input}`, `AI:\n${aiText}`]);
            setInput('');
        } catch (_error) {
            setResponses((prev) => [...prev, `You: ${input}`, 'AI: Request failed.']);
        }
    };

    return (
        <div className="chatbox">
            <div className="chatbox-responses">
                {responses.map((response, index) => (
                    <div key={index}>{response}</div>
                ))}
            </div>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Ask for editing suggestions..."
                />
                <button type="submit">Send</button>
            </form>
        </div>
    );
};

export default Chatbox;