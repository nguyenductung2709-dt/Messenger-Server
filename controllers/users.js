const router = require('express').Router();
const middleware = require('../utils/middleware');

// library to handle uploading files
const multer = require('multer'); 
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const crypto = require('crypto'); // used to generate random string
const bcrypt = require('bcrypt'); // used to encrypt passwords
const { User, Conversation, Friend } = require('../models/index');

//AWS S3 SDK library to upload and get images from AWS S3
const s3 = require('../utils/s3user');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl }  = require('@aws-sdk/s3-request-presigner');

const bucketName = process.env.BUCKET_NAME
const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex'); // generate random image name to avoid conflicts

router.get('/', async(req, res) => {
    try {
        const users = await User.findAll({
            attributes: { exclude: ['passwordHash'] },
            include: [
                {
                    model: Conversation,
                    as: 'conversation',
                    through: {
                        as: 'conversation',
                    }
                }, 
                {
                    model: Friend,
                }
            ]
        });    
        // make avatarName into url for better use in frontend
        for (const user of users) {
            const getObjectParams = {
                Bucket: bucketName,
                Key: user.avatarName,
            }
            const command = new GetObjectCommand(getObjectParams);
            const url = await getSignedUrl(s3, command, {expiresIn: 3600});
            user.avatarName = url;
            delete user.passwordHash;
        }
        res.json(users);
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.get('/:id', async(req, res) => {
    try {
        const user = await User.findByPk(req.params.id, {
            attributes: { exclude: ['passwordHash'] },
            include: [
                {
                    model: Conversation,
                    as: 'conversation',
                    through: {
                        as: 'conversation',
                    }
                },
                {
                    model: Friend,
                }
            ]        
        });
        // make avatarName into url for better use in frontend
        const getObjectParams = {
            Bucket: bucketName,
            Key: user.avatarName,
        }
        const command = new GetObjectCommand(getObjectParams);
        const url = await getSignedUrl(s3, command, {expiresIn: 3600});
        user.avatarName = url;        
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch(err) {
        console.error('Error updating user:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.post('/', upload.single('avatarImage'), async(req, res) => {
    try {
        const imageName = randomImageName();

        // handle uploading images to AWS S3
        const params = {
            Bucket: bucketName,
            Key: imageName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
        }

        const command = new PutObjectCommand(params)
        await s3.send(command)

        // hash password with bcrypt
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(req.body.password, saltRounds)

        const user = await User.create({
            ...req.body,
            passwordHash, 
            avatarName: imageName,
        })
        res.json(user);
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.put('/:id', upload.single('avatarImage'), middleware.findUserSession, async(req, res) => {
    try {
        const userWithId = await User.findByPk(req.params.id);
        const user = req.user;
        if (!userWithId) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (!user || user.id != req.params.id) {
            return res.status(404).json({ error: 'Unauthorized' });
        }

        // handle put request with each element
        const updatedFields = {};
        if (req.body.gmail) {
            updatedFields.gmail = req.body.gmail;
        }
        if (req.body.firstName) {
            updatedFields.firstName = req.body.firstName;
        }
        if (req.body.lastName) {
            updatedFields.lastName = req.body.lastName;
        }
        if (req.body.middleName) {
            updatedFields.middleName = req.body.middleName;
        }
        if (req.file) {
            // updating image involves deleting the old image and upload a new image
            const imageName = randomImageName();

            // handle deleting the old image
            const deleteParams = {
                Bucket: bucketName,
                Key: user.avatarName,
            }
            const deleteCommand = new DeleteObjectCommand(deleteParams)
            await s3.send(deleteCommand)

            // handle uploading new image
            const updateParams = {
                Bucket: bucketName,
                Key: imageName,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
            }
            const updateCommand = new PutObjectCommand(updateParams)
            await s3.send(updateCommand)
            updatedFields.avatarName = imageName;
        }
        await user.update(updatedFields);
        res.json(user);
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

module.exports = router;

