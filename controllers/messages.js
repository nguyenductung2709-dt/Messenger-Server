const router = require('express').Router();
const multer = require('multer'); // library to handle uploading files
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const crypto = require('crypto'); // used to generate random string
const { Message, Conversation, User } = require('../models/index');

const s3 = require('../utils/s3user');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl }  = require('@aws-sdk/s3-request-presigner');

const bucketName = process.env.BUCKET_NAME

const generateRandomName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

router.get('/', async (req, res) => {
    try {
        const messages = await Message.findAll({
            include: [
                { 
                    model: Conversation,
                    attributes: {
                        exclude: ['createdAt', 'updatedAt'],
                    },
                },
                { 
                    model: User,
                    attributes: {
                        exclude: ['passwordHash', 'createdAt', 'updatedAt'],
                    },
                }
            ]
        });
        for (const message of messages) {
            let getObjectParams = {}
            if (message.imageName) {
                getObjectParams = {
                    Bucket: bucketName,
                    Key: message.imageName,
                }
                const command = new GetObjectCommand(getObjectParams);
                const url = await getSignedUrl(s3, command, {expiresIn: 3600});
                message.imageName = url;
            }
            else {
                getObjectParams = {
                    Bucket: bucketName,
                    Key: message.fileName,
            }
                const command = new GetObjectCommand(getObjectParams);
                const url = await getSignedUrl(s3, command, {expiresIn: 3600});
                message.fileName = url;
            }
        }
        res.json(messages);
    } catch (err) {
        console.error('Error retrieving messages:', err);
        res.status(500).json({ error: 'Failed to retrieve messages' });
    }
});

router.get('/:id', async(req,res) => {
    try {
        const message = await Message.findByPk(req.params.id, {
            include: [
                { 
                    model: Conversation,
                    attributes: {
                        exclude: ['createdAt', 'updatedAt'],
                    },
                },
                { 
                    model: User,
                    attributes: {
                        exclude: ['passwordHash', 'createdAt', 'updatedAt'],
                    },
                }
            ]
        });

        let getObjectParams = {}

        if (message.imageName) {
            getObjectParams = {
                Bucket: bucketName,
                Key: message.imageName,
            }
            const command = new GetObjectCommand(getObjectParams);
            const url = await getSignedUrl(s3, command, {expiresIn: 3600});
            message.imageName = url;
        }

        else {
            getObjectParams = {
                Bucket: bucketName,
                Key: message.fileName,
            }
            const command = new GetObjectCommand(getObjectParams);
            const url = await getSignedUrl(s3, command, {expiresIn: 3600});
            message.fileName = url;
        }
        
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }
        res.json(message);
    }
    catch (err) {
        console.error('Error retrieving message', err);
        res.status(500).json({ error: 'Failed to retrieve message' });
    }
})

router.post('/', upload.single('messageImage'), async(req, res) => {
    try {
        const originalName = req.file.originalname;
        const randomName = generateRandomName();
        const params = {
            Bucket: bucketName,
            Key: randomName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
        };
        const command = new PutObjectCommand(params);
        await s3.send(command);

        let messageData = {
            ...req.body,
        };

        const imageExtensionsRegex = /\.(jpg|jpeg|png|HEIC)$/i;
        if (imageExtensionsRegex.test(originalName)) {
            messageData.imageName = randomName;
        } else {
            messageData.fileName = randomName;
        }

        const message = await Message.create(messageData);
        res.json(message);

        console.log(req.file.originalname);
    } catch (err) {
        console.error('Error creating message:', err);
        res.status(500).json({ error: 'Failed to create message' });    }
});

router.put('/:id', upload.single('messageImage'), async(req, res) => {
    try {
        const message = await Message.findByPk(req.params.id);

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        const updatedFields = {};

        if (req.body.message) {
            updatedFields.message = req.body.message;
        }
        if (req.file) {
            const originalName = req.file.originalname;
            const randomName = generateRandomName();
            const params = {
                Bucket: bucketName,
                Key: randomName,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
            };
            const command = new PutObjectCommand(params);
            await s3.send(command);

            const imageExtensionsRegex = /\.(jpg|jpeg|png|HEIC)$/i;
            if (imageExtensionsRegex.test(originalName)) {
                updatedFields.imageName = randomName;
            } else {
                updatedFields.fileName = randomName;
            }
        }

        await message.update(updatedFields)
        res.json(message);
    } catch (err) {
        console.error('Error updating message:', err);
        res.status(500).json({ error: 'Failed to update message' });    
    }
})

router.delete('/:id', async(req, res) => {
    try {
        const message = await Message.findByPk(req.params.id);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }
        await message.destroy();
    } catch (err) {
        console.error('Error updating message:', err);
        res.status(500).json({ error: 'Failed to update message' });    
    }
})

module.exports = router;