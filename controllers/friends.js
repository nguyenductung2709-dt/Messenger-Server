const { Friend, Conversation, Participant } = require('../models/index');
const router = require('express').Router();
const middleware = require('../utils/middleware');

router.get('/', async(req, res) => {
    try {
        const friends = await Friend.findAll({});
        res.status(200).json(friends)
    } catch (err) {
        console.error('Error retrieving friends:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.get('/:id', async(req, res) => {
    try {
        const friend = await Friend.findByPk(req.params.id);
        if (!friend) {
            return res.status(404).json({ error: 'Friend not found' });
        }
        res.status(200).json(friend)
    } catch (err) {
        console.error('Error retrieving friend:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.post('/', middleware.findUserSession, async(req, res) => {
    try {
        const user = req.user;
        if (!user || !(req.body.userId === user.id)) {
            return res.status(404).json({ error: 'Unauthorized' });
        }

        // check if the relationship already exists
        const existingFriendship = await Friend.findOne({
            where: {
                userId: req.body.userId,
                friendId: req.body.friendId
            }
        });

        if (existingFriendship) {
            return res.status(400).json({ error: 'Friendship already exists' });
        }

        // when adding a friend, person B will become friend of person A, person A will also become friend of person B
        const firstFriend = await Friend.create(req.body);

        const anotherDetails = {
            userId: req.body.friendId,
            friendId: req.body.userId,
        }

        const secondFriend = await Friend.create(anotherDetails);

        // After adding a friend, a conversation between them will be formed
        const conversation = await Conversation.create({
            creatorId: firstFriend.id,
        })

        await Participant.create({
            conversationId: conversation.id,
            userId: firstFriend.id,
        })

        await Participant.create({
            conversationId: conversation.id,
            userId: secondFriend.id,
        })

        const returnedDetails = {
            firstFriend,
            secondFriend,
        }

        res.status(201).json(returnedDetails);
    } catch (err) {
        console.error('Error creating friend:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.delete('/:id', middleware.findUserSession, async(req, res) => {
    try {
        const firstFriend = await Friend.findByPk(req.params.id);
        if (!firstFriend) {
            return res.status(404).json({ error: 'Friend not found' });
        }
        const user = req.user;
        if (!user || !(firstFriend.userId === user.id)) {
            return res.status(404).json({ error: 'Unauthorized' });
        }
        await firstFriend.destroy();

        // when deleting a friend, person B will not be friend of A, and A will also not be friend of B anymore.
        const secondFriend = await Friend.findOne({
            where: {
                userId: firstFriend.friendId,
                friendId: firstFriend.userId,
            }
        })

        await secondFriend.destroy();

        const returnedDetails = {
            firstFriend,
            secondFriend,
        }

        res.status(204).json(returnedDetails)
    } catch (err) {
        console.error('Error deleting friend:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;