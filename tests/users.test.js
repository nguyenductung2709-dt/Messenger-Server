const { User, Session, Friend, Conversation } = require('../models/index');
const supertest = require('supertest');
const app = require('../app')
const api = supertest(app);
const path = require('path');
const s3 = require('../utils/s3user');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const bucketName = process.env.BUCKET_NAME


beforeEach(async () => {
    try {
        await Conversation.destroy({ where: {} });
        await Friend.destroy({ where: {} });
        await Session.destroy({ where: {} });
        await User.destroy({ where: {} });
    } catch (error) {
        console.error('Error deleting users:', error);
    }
});


const createUser = async () => {
    const imagePath = path.resolve(__dirname, '../assets/ronaldo.webp'); 

    await api
        .post('/api/users')
        .field("gmail", "ronaldo@gmail.com")
        .field("password", "ronaldosiu")
        .field("firstName", "Ronaldo")
        .field("lastName", "Aveiro")
        .field("middleName", "Cristiano")
        .attach("avatarImage", imagePath) 
        .expect(201)
        .expect('Content-Type', /application\/json/);
};

const createAnotherUser = async () => {
    const imagePath = path.resolve(__dirname, '../assets/messi.webp'); 

    await api
        .post('/api/users')
        .field("gmail", "messi@gmail.com")
        .field("password", "messidibovuotrau")
        .field("firstName", "Messi")
        .field("lastName", "Lionel")
        .field("middleName", "Goat")
        .attach("avatarImage", imagePath) 
        .expect(201)
        .expect('Content-Type', /application\/json/);
}

const login = async() => {
    const accountDetails = {
        gmail: "ronaldo@gmail.com",
        password: "ronaldosiu"
    }
    await api
        .post('/api/auth/login')
        .send(accountDetails)
        .expect(200)
        .expect('Content-Type', /application\/json/);
}

const loginAnother = async() => {
    const accountDetails = {
        gmail: "messi@gmail.com",
        password: "messidibovuotrau"
    }
    await api
        .post('/api/auth/login')
        .send(accountDetails)
        .expect(200)
        .expect('Content-Type', /application\/json/);
}

const deleteImageTest = async(user) => {
    const deleteParams = {
        Bucket: bucketName,
        Key: user.avatarName,
    }
    const deleteCommand = new DeleteObjectCommand(deleteParams)
    await s3.send(deleteCommand)
}

describe('Addition of a new user, get a user', () => {
    test('addition of a new user', async () => {
        await createUser();
        const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        const users = await User.findAll({});
        expect(users).toHaveLength(1);
    
        const names = users.map(user => user.firstName);
        expect(names).toContain('Ronaldo');
        deleteImageTest(user);
    });

    test('users are get correctly', async() => {
        await createUser();    
        const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        const users = await api
                        .get('/api/users')
                        .expect(200)
                        .expect('Content-Type', /application\/json/)

        const names = users.body.map(user => user.firstName);
        expect(names).toContain('Ronaldo');
        deleteImageTest(user);
    })
})

describe('Viewing a specific user', () => {
    test('succeeds with a valid id', async () => {
        await createUser();
        const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        const id = user.id;

        const resultUser = await api
            .get(`/api/users/${id}`)
            .expect(200)
            .expect('Content-Type', /application\/json/);

        expect(resultUser.body.id).toEqual(user.id);
        expect(resultUser.body.gmail).toEqual(user.gmail);
        expect(resultUser.body.firstName).toEqual(user.firstName);
        expect(resultUser.body.lastName).toEqual(user.lastName);    
        deleteImageTest(user);
    });

    test('fails with status code 404 if user does not exist', async() => {
        await createUser();
        const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        const validNonexistingId = 1000000000;
        await api
            .get(`/api/users/${validNonexistingId}`)
            .expect(404);
        deleteImageTest(user);
    });
});

describe('Changing information of user', () => {
    test('changing text information from user', async() => {
        await createUser();
        await login();
        const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        const session = await Session.findOne({ where: { userId: user.id }});
        await api
            .put(`/api/users/${user.id}`)
            .set('Authorization', `bearer ${session.token}`)
            .field("firstName", "Messi")
            .field("lastName", "Lionel")
            .expect(201)
            .expect('Content-Type', /application\/json/);

        const newUser = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        expect(newUser.firstName).toEqual("Messi");
        expect(newUser.lastName).toEqual("Lionel");
        deleteImageTest(newUser);
    })

    test('changing avatar image from user', async() => {
        const newImagePath = path.resolve(__dirname, '../assets/messi.webp'); 
        await createUser();
        await login();
        const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        const session = await Session.findOne({ where: { userId: user.id }});
        await api
            .put(`/api/users/${user.id}`)
            .set('Authorization', `bearer ${session.token}`)
            .attach("avatarImage", newImagePath) 
            .expect(201)
            .expect('Content-Type', /application\/json/);
        
        const newUser = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        expect(newUser.avatarName).not.toBe(user.avatarName);
        deleteImageTest(newUser);
        })

    test ('changing information of user without authentication receive a 500 error', async() => {
        await createUser();
        const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        await api
        .put(`/api/users/${user.id}`)
        .field("firstName", "Messi")
        .field("lastName", "Lionel")
        .expect(500)
        deleteImageTest(user);
    })

    test ('users cannot change information of each other', async() => {
        await createUser();
        await createAnotherUser();
        await loginAnother();
        const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        const userAnother = await User.findOne({ where: { gmail: "messi@gmail.com" } });
        const sessionAnother = await Session.findOne({ where: { userId: userAnother.id }});    
        await api
            .put(`/api/users/${user.id}`)
            .set('Authorization', `bearer ${sessionAnother.token}`)
            .field("firstName", "Messi")
            .field("lastName", "Lionel")
            .expect(404)
            .expect('Content-Type', /application\/json/);
        deleteImageTest(user);
        deleteImageTest(userAnother);
    })
})



