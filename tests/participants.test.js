const { User, Session, Friend, Conversation, Participant } = require('../models/index');
const supertest = require('supertest');
const app = require('../app')
const api = supertest(app);
const path = require('path');
const s3 = require('../utils/s3user');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const bucketName = process.env.BUCKET_NAME

beforeEach(async () => {
    try {
        await Session.destroy({ where: {} });
        await Friend.destroy({ where: {} });
        await Participant.destroy({ where: {} });
        await Conversation.destroy({ where: {} });
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

describe("Testing POST and GET request", () => {
    test("addition of a new participant and get participant correctly", async() => {
        await createUser();
        await createAnotherUser();
        await login();
        const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        const userAnother = await User.findOne({ where: { gmail: "messi@gmail.com" } });
        const session = await Session.findOne({ where: { userId: user.id }});        
        await api
                .post('/api/conversations')
                .set('Authorization', `bearer ${session.token}`)
                .field('creatorId', user.id)
                .expect(201)
                .expect('Content-Type', /application\/json/);

        const conversation = await Conversation.findOne({ where: { creatorId: user.id } });

        await api
                .post('/api/participants')
                .set('Authorization', `bearer ${session.token}`)
                .send({ conversationId: conversation.id, userId: userAnother.id })
                .expect(201)
                .expect('Content-Type', /application\/json/);

        const participants = await api
                                    .get('/api/participants')
                                    .expect(200)
                                    .expect('Content-Type', /application\/json/);
        expect(participants.body).toHaveLength(2);
        deleteImageTest(user)
        deleteImageTest(userAnother)
    })  
})

describe("Testing PUT request", () => {
    test ("making another user to admin", async() => {
        await createUser();
        await createAnotherUser();
        await login();
        const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        const userAnother = await User.findOne({ where: { gmail: "messi@gmail.com" } });
        const session = await Session.findOne({ where: { userId: user.id }});        
        await api
                .post('/api/conversations')
                .set('Authorization', `bearer ${session.token}`)
                .field('creatorId', user.id)
                .expect(201)
                .expect('Content-Type', /application\/json/);

        const conversation = await Conversation.findOne({ where: { creatorId: user.id } });

        await api
                .post('/api/participants')
                .set('Authorization', `bearer ${session.token}`)
                .send({ conversationId: conversation.id, userId: userAnother.id })
                .expect(201)
                .expect('Content-Type', /application\/json/);
        
        const participant = await Participant.findOne({ where: { conversationId: conversation.id, userId: userAnother.id } });
        await api
                .put(`/api/participants/${participant.id}`)
                .set('Authorization', `bearer ${session.token}`)
                .expect(201)
                .expect('Content-Type', /application\/json/);

        const newParticipant = await Participant.findOne({ where: { conversationId: conversation.id, userId: userAnother.id } });
        expect(newParticipant.isAdmin).toEqual(true);
        deleteImageTest(user)
        deleteImageTest(userAnother)
    })

    test('unauthorized user cannot make admin', async() => {
        await createUser();
        await createAnotherUser();
        await login();
        const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        const userAnother = await User.findOne({ where: { gmail: "messi@gmail.com" } });
        const session = await Session.findOne({ where: { userId: user.id }});        
        await api
                .post('/api/conversations')
                .set('Authorization', `bearer ${session.token}`)
                .field('creatorId', user.id)
                .expect(201)
                .expect('Content-Type', /application\/json/);

        const conversation = await Conversation.findOne({ where: { creatorId: user.id } });

        await api
                .post('/api/participants')
                .set('Authorization', `bearer ${session.token}`)
                .send({ conversationId: conversation.id, userId: userAnother.id })
                .expect(201)
                .expect('Content-Type', /application\/json/);
        
        const participant = await Participant.findOne({ where: { conversationId: conversation.id, userId: userAnother.id } });
        await loginAnother();
        const sessionAnother = await Session.findOne({ where: { userId: userAnother.id } });

        await api
                .put(`/api/participants/${participant.id}`)
                .set('Authorization', `bearer ${sessionAnother.token}`)
                .expect(404)

        deleteImageTest(user)
        deleteImageTest(userAnother)
    })
})

describe("Testing DELETE request", () => {
    test ("deleting an user from a conversation", async() => {
        await createUser();
        await createAnotherUser();
        await login();
        const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        const userAnother = await User.findOne({ where: { gmail: "messi@gmail.com" } });
        const session = await Session.findOne({ where: { userId: user.id }});        
        await api
                .post('/api/conversations')
                .set('Authorization', `bearer ${session.token}`)
                .field('creatorId', user.id)
                .expect(201)
                .expect('Content-Type', /application\/json/);

        const conversation = await Conversation.findOne({ where: { creatorId: user.id } });

        await api
                .post('/api/participants')
                .set('Authorization', `bearer ${session.token}`)
                .send({ conversationId: conversation.id, userId: userAnother.id })
                .expect(201)
                .expect('Content-Type', /application\/json/);
        
        const participant = await Participant.findOne({ where: { conversationId: conversation.id, userId: userAnother.id } });
        await api
                .delete(`/api/participants/${participant.id}`)
                .set('Authorization', `bearer ${session.token}`)
                .expect(204)

        const participants = await Participant.findAll({})
        expect(participants).toHaveLength(1);

        deleteImageTest(user)
        deleteImageTest(userAnother)
    })

    test('unauthorized user cannot delete an user from a conversation', async() => {
        await createUser();
        await createAnotherUser();
        await login();
        const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        const userAnother = await User.findOne({ where: { gmail: "messi@gmail.com" } });
        const session = await Session.findOne({ where: { userId: user.id }});        
        await api
                .post('/api/conversations')
                .set('Authorization', `bearer ${session.token}`)
                .field('creatorId', user.id)
                .expect(201)
                .expect('Content-Type', /application\/json/);

        const conversation = await Conversation.findOne({ where: { creatorId: user.id } });

        await api
                .post('/api/participants')
                .set('Authorization', `bearer ${session.token}`)
                .send({ conversationId: conversation.id, userId: userAnother.id })
                .expect(201)
                .expect('Content-Type', /application\/json/);
        
        const participant = await Participant.findOne({ where: { conversationId: conversation.id, userId: userAnother.id } });
        await loginAnother();
        const sessionAnother = await Session.findOne({ where: { userId: userAnother.id } });

        await api
                .delete(`/api/participants/${participant.id}`)
                .set('Authorization', `bearer ${sessionAnother.token}`)
                .expect(404)

        deleteImageTest(user)
        deleteImageTest(userAnother)
    })
})