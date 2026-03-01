import { Router, Request, Response } from 'express';
import { getAIResponse } from '../services/aiService';

const router = Router();

type SuggestionsRequestBody = {
    userInput: string;
    storyContext?: unknown;
};

router.post(
    '/suggestions',
    async (req: Request<{}, {}, SuggestionsRequestBody>, res: Response) => {
        const { userInput, storyContext } = req.body;

        try {
            const aiResponse = await getAIResponse(userInput, storyContext);
            res.json(aiResponse);
        } catch (_error: unknown) {
            res.status(500).json({ error: 'An error occurred while fetching suggestions.' });
        }
    }
);

export default router;