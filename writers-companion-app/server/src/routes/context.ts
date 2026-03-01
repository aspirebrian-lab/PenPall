import { Router } from 'express';
import { getStoryContext, updateStoryContext } from '../services/storyContextService';

const router = Router();

// Route to get the current story context
router.get('/context', async (req, res) => {
    try {
        const context = await getStoryContext();
        res.json(context);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving story context', error });
    }
});

// Route to update the story context
router.post('/context', async (req, res) => {
    try {
        const updatedContext = await updateStoryContext(req.body);
        res.json(updatedContext);
    } catch (error) {
        res.status(500).json({ message: 'Error updating story context', error });
    }
});

export default router;