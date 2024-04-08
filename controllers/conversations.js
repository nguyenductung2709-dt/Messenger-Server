const router = require('express').Router();
const { Conversation, Message, User } = require('../models/index');
const multer = require('multer'); // library to handle uploading files
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const crypto = require('crypto'); // used to generate random string
const bcrypt = require('bcrypt'); // used to encrypt passwords

//AWS S3 SDK library to upload and get images from AWS S3
const s3 = require('../utils/s3user');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl }  = require('@aws-sdk/s3-request-presigner');

const bucketName = process.env.BUCKET_NAME
const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

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
        for (const conversation of conversations) {
            const getObjectParams = {
                Bucket: bucketName,
                Key: conversation.imageName,
            }
            const command = new GetObjectCommand(getObjectParams);
            const url = await getSignedUrl(s3, command, {expiresIn: 3600});
            conversation.imageName = url;
        }    
        res.json(conversations)
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
        res.json(conversation);
    }
    catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/', upload.single('groupImage'), async(req, res) => {
    try {
        const imageName = randomImageName();
        const params = {
            Bucket: bucketName,
            Key: imageName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
        }
        const command = new PutObjectCommand(params)
        await s3.send(command)

        const conversation = await Conversation.create({
            ...req.body,
            imageName: imageName,
        });
        res.json(conversation);
    }
    catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/:id', upload.single('groupImage'), async(req, res) => {
    try {
        const conversationId = req.params.id;
        const conversation = await Conversation.findByPk(conversationId);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
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
        res.json(conversation);
    } catch(err) {
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.delete('/:id',  async(req, res) => {
    try {
        const conversation = await Conversation.findByPk(req.params.id);
        await conversation.destroy();
        res.json(conversation);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
})

module.exports = router