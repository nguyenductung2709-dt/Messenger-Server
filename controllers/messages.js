const router = require('express').Router();
const middleware = require('../utils/middleware');

// library to handle uploading files
const multer = require('multer'); 
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const crypto = require('crypto'); // used to generate random string
const { Message, Conversation, User } = require('../models/index');

//AWS S3 SDK library to upload and get images from AWS S3
const s3 = require('../utils/s3user');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl }  = require('@aws-sdk/s3-request-presigner');

const bucketName = process.env.BUCKET_NAME

const generateRandomName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex'); // generate random image name to avoid conflicts

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
        // a message can contain a file or an image 
        for (const message of messages) {
            let getObjectParams = {}
            // handle making imageName into url 
            if (message.imageName) {
                getObjectParams = {
                    Bucket: bucketName,
                    Key: message.imageName,
                }
                const command = new GetObjectCommand(getObjectParams);
                const url = await getSignedUrl(s3, command, {expiresIn: 3600});
                message.imageName = url;
            }
            // handle making fileName into url 
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

        // handle making imageName into url 
        if (message.imageName) {
            getObjectParams = {
                Bucket: bucketName,
                Key: message.imageName,
            }
            const command = new GetObjectCommand(getObjectParams);
            const url = await getSignedUrl(s3, command, {expiresIn: 3600});
            message.imageName = url;
        }

        // handle making fileName into url
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

router.post('/', upload.single('messageImage'), middleware.findUserSession, async(req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(404).json({ error: 'Unauthorized' });
        }
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

        // test if the file sent is image or file (attachments)
        const imageExtensionsRegex = /\.(jpg|jpeg|png|HEIC)$/i;
        if (imageExtensionsRegex.test(originalName)) {
            messageData.imageName = randomName; // if has tail as above, it will be stored in imageName
        } else {
            messageData.fileName = randomName;  // else, it will be stored in fileName
        }

        const message = await Message.create(messageData);
        res.json(message);

        console.log(req.file.originalname);
    } catch (err) {
        console.error('Error creating message:', err);
        res.status(500).json({ error: 'Failed to create message' });    }
});

router.put('/:id', upload.single('messageImage'), middleware.findUserSession, async(req, res) => {
    try {
        const message = await Message.findByPk(req.params.id);
        const user = req.user;
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // handle if current user has the same id with owner of the message
        if (!user || user.id != message.user.id) {
            return res.status(404).json({ error: 'Unauthorized' });
        } 

        // handle updating of each element
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

router.delete('/:id', middleware.findUserSession, async(req, res) => {
    try {
        const message = await Message.findByPk(req.params.id);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // handle if the current user is the same as the owner of this message
        const user = req.user;
        if (!user || user.id != message.user.id) {
            return res.status(404).json({ error: 'Unauthorized' });
        }
        await message.destroy();
    } catch (err) {
        console.error('Error updating message:', err);
        res.status(500).json({ error: 'Failed to update message' });    
    }
})

module.exports = router;