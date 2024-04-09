const router = require('express').Router();
const middleware = require('../utils/middleware');
const { Participant, Conversation } = require('../models/index');

router.get('/', async (req, res) => {
    try {
        const participants = await Participant.findAll({});
        res.json(participants);
    } catch (err) {
        console.error('Error retrieving participants:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/', middleware.findUserSession, async (req, res) => {
    try {
        const conversationId = req.body.conversationId;
        const conversation = await Conversation.findByPk(conversationId);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        const user = req.user;
        
        // take the user in the conversation with the current user's id
        const userInConversation = conversation.participant_list.find(participant => participant.id === user.id)

        // only admin can add another participant so check if the current user is admin 
        if (!user || !userInConversation || !userInConversation.participant_details.isAdmin) {
            return res.status(404).json({ error: 'Unauthorized' });
        }
        const participant = await Participant.create(req.body);
        res.json(participant);
    } catch (err) {
        console.error('Error creating participant:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/:id', middleware.findUserSession, async (req, res) => {
    try {
        const participant = await Participant.findByPk(req.params.id);
        if (!participant) {
            return res.status(404).json({ error: 'Participant not found' });
        }
        // take the conversation that participant belongs to 
        const conversation = await Conversation.findByPk(participant.conversationId);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        // check if the current user is admin of this conversation
        const user = req.user;
        const userInConversation = conversation.participant_list.find(participant => participant.id === user.id)
        if (!user || !userInConversation || !userInConversation.participant_details.isAdmin) {
            return res.status(404).json({ error: 'Unauthorized' });
        }
        participant.isAdmin = true;
        await participant.save();
        res.json(participant);
    } catch (err) {
        console.error('Error creating admin:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.delete('/:id', middleware.findUserSession, async (req, res) => {
    try {
        const participant = await Participant.findByPk(req.params.id);
        
        if (!participant) {
            return res.status(404).json({ error: 'Participant not found' });
        }

        // take the conversation that participant belongs to 
        const conversation = await Conversation.findByPk(participant.conversationId);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // check if the current user is admin of this conversation, only admin can remove user from conversation
        const user = req.user;
        const userInConversation = conversation.participant_list.find(participant => participant.id === user.id)
        if (!user || !userInConversation || !userInConversation.participant_details.isAdmin) {
            return res.status(404).json({ error: 'Unauthorized' });
        }

        await participant.destroy();
    } catch (err) {
        console.error('Error deleting participant:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

module.exports = router;
