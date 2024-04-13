const router = require('express').Router();
const { Conversation, Message, User, Participant } = require('../models/index');
const middleware = require('../utils/middleware');

// library to handle uploading files
const multer = require('multer'); 
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const crypto = require('crypto'); // used to generate random string
const bcrypt = require('bcrypt'); // used to encrypt passwords

//AWS S3 SDK library to upload and get images from AWS S3
const s3 = require('../utils/s3user');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl }  = require('@aws-sdk/s3-request-presigner');

const bucketName = process.env.BUCKET_NAME
const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex'); // generate random image name to avoid conflicts

router.get('/', async(req, res) => {
    try {
        const conversations = await Conversation.findAll({
            include: [
                {
                    model: Message,
                    attributes: {
                        exclude: ['createdAt', 'updatedAt'],
                    },
                },
                {
                    model: User,
                    as: 'participant_list',
                    attributes: {
                        exclude: ['passwordHash', 'createdAt', 'updatedAt'],
                    },
                    through: {
                        attributes: {
                            exclude: ['createdAt', 'updatedAt', 'userId'],
                        },
                        as: 'participant_details'
                    }
                }
            ]
        });        
        // make imageName into url for better use in frontend
        for (const conversation of conversations) {
            if (conversation.imageName) {
                const getObjectParams = {
                    Bucket: bucketName,
                    Key: conversation.imageName,
                }
                const command = new GetObjectCommand(getObjectParams);
                const url = await getSignedUrl(s3, command, {expiresIn: 3600});
                conversation.imageName = url;
            }
        }    
        res.status(200).json(conversations)
    }
    catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.get('/:id', async (req, res) => {
    try {
        const conversation = await Conversation.findByPk(req.params.id, {
            include: 
            [
                {
                    model: Message,
                    attributes: {
                        exclude: ['createdAt', 'updatedAt'],
                    },
                },
                {
                    model: User,
                    as: 'participant_list',
                    attributes: {
                        exclude: ['passwordHash', 'createdAt', 'updatedAt'],
                    },
                    through: {
                        attributes: {
                            exclude: ['createdAt', 'updatedAt', 'userId'],
                        },
                        as: 'participant_details'
                    }
                }
            ]
            
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // make imageName into url for better use in frontend
        if (conversation.imageName) {
            const getObjectParams = {
                Bucket: bucketName,
                Key: conversation.imageName,
            }
            const command = new GetObjectCommand(getObjectParams);
            const url = await getSignedUrl(s3, command, {expiresIn: 3600});
            conversation.imageName = url;
        }

        res.status(200).json(conversation);
    }
    catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/', upload.single('groupImage'), middleware.findUserSession, async(req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(404).json({ error: 'Unauthorized' });
        }
        
        let conversation;

        if (req.file) {
        // handle uploading new groupImage
            const imageName = randomImageName();
            const params = {
                Bucket: bucketName,
                Key: imageName,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
            }
            const command = new PutObjectCommand(params)
            await s3.send(command)

            conversation = await Conversation.create({
                ...req.body,
                imageName: imageName,
            });
        }

        else {
            conversation = await Conversation.create({
                ...req.body,
            })
        }
        // after creating a conversation, the creator will become the first and admin of the conversation
        await Participant.create({
            conversationId: conversation.id,
            userId: conversation.creatorId,
            isAdmin: true
        })
        res.status(201).json(conversation);
    }
    catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/:id', upload.single('groupImage'), middleware.findUserSession, async(req, res) => {
    try {
        const conversation = await Conversation.findByPk(req.params.id, {
            include: 
            [
                {
                    model: Message,
                    attributes: {
                        exclude: ['createdAt', 'updatedAt'],
                    },
                },
                {
                    model: User,
                    as: 'participant_list',
                    attributes: {
                        exclude: ['passwordHash', 'createdAt', 'updatedAt'],
                    },
                    through: {
                        attributes: {
                            exclude: ['createdAt', 'updatedAt', 'userId'],
                        },
                        as: 'participant_details'
                    }
                }
            ]
        });        
        
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        
        // take the current user based on the token and find that user in the conversation
        const user = req.user;
        const userInConversation = conversation.participant_list.find(participant => participant.id === user.id)

        // if there is no user or the user is not in the conversation, then he/she is not authorized to change conversation
        if (!user || !userInConversation) {
            return res.status(404).json({ error: 'Unauthorized' });
        }

        const updatedFields = {};

        if (req.body.title) {
            updatedFields.title = req.body.title;
        }
        if (req.file) {
            const imageName = randomImageName();
            const deleteParams = {
                Bucket: bucketName,
                Key: conversation.imageName,
            }
            const deleteCommand = new DeleteObjectCommand(deleteParams)
            await s3.send(deleteCommand)

            const updateParams = {
                Bucket: bucketName,
                Key: imageName,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
            }
            const updateCommand = new PutObjectCommand(updateParams)
            await s3.send(updateCommand)
            updatedFields.imageName = imageName;
        }
        await conversation.update(updatedFields);
        res.status(201).json(conversation);
    } catch(err) {
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.delete('/:id', middleware.findUserSession, async(req, res) => {
    try {
        const conversation = await Conversation.findByPk(req.params.id, {
            include: 
            [
                {
                    model: Message,
                    attributes: {
                        exclude: ['createdAt', 'updatedAt'],
                    },
                },
                {
                    model: User,
                    as: 'participant_list',
                    attributes: {
                        exclude: ['passwordHash', 'createdAt', 'updatedAt'],
                    },
                    through: {
                        attributes: {
                            exclude: ['createdAt', 'updatedAt', 'userId'],
                        },
                        as: 'participant_details'
                    }
                }
            ]
            
        });        

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // take the current user based on the token and find that user in the conversation
        const user = req.user;
        const userInConversation = conversation.participant_list.find(participant => participant.id === user.id)
        
        // only admin user from a conversation is allowed to delete the conversation
        if (!user || !userInConversation || !userInConversation.participant_details.isAdmin) {
            return res.status(404).json({ error: 'Unauthorized' });
        }
        const participants = await Participant.findAll({ where: { conversationId: conversation.id} });    
        await Promise.all(participants.map(participant => participant.destroy()));
        await conversation.destroy();
        res.status(204).json(conversation);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
})

module.exports = router