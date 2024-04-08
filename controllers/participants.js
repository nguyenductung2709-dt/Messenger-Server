const router = require('express').Router();
const { Participant } = require('../models/index');

router.get('/', async (req, res) => {
    try {
        const participants = await Participant.findAll({});
        res.json(participants);
    } catch (err) {
        console.error('Error retrieving participants:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/', async (req, res) => {
    try {
        const participant = await Participant.create(req.body);
        res.json(participant);
    } catch (err) {
        console.error('Error creating participant:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const participant = await Participant.findByPk(req.params.id);
        if (!participant) {
            return res.status(404).json({ error: 'Participant not found' });
        }
        await participant.destroy();
    } catch (err) {
        console.error('Error deleting participant:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

module.exports = router;
