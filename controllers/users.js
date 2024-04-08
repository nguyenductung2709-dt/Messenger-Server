const router = require('express').Router();
const multer = require('multer'); // library to handle uploading files
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const crypto = require('crypto'); // used to generate random string
const bcrypt = require('bcrypt'); // used to encrypt passwords
const { User, Conversation } = require('../models/index');

//AWS S3 SDK library to upload and get images from AWS S3
const s3 = require('../utils/s3user');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl }  = require('@aws-sdk/s3-request-presigner');

const bucketName = process.env.BUCKET_NAME
const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

router.get('/', async(req, res) => {
    try {
        const users = await User.findAll({
            attributes: { exclude: ['passwordHash'] },
            include: {
                model: Conversation,
                    as: 'conversation',
                    through: {
                        as: 'conversation',
                    }
            }
        });    
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
            include: {
                model: Conversation,
                    as: 'conversation',
                    through: {
                        as: 'conversation',
                    }
            }        
        });
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
        const params = {
            Bucket: bucketName,
            Key: imageName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
        }

        const command = new PutObjectCommand(params)
        await s3.send(command)

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(req.body.password, saltRounds)

        const user = await User.create({
            gmail: req.body.gmail,
            firstName: req.body.firstName,
            passwordHash: passwordHash,
            lastName: req.body.lastName,
            middleName: req.body.middleName,
            avatarName: imageName,
        })
        res.json(user);
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.put('/:id', upload.single('avatarImage'), async(req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findByPk(userId)
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
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
            const imageName = randomImageName();

            const deleteParams = {
                Bucket: bucketName,
                Key: user.avatarName,
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

