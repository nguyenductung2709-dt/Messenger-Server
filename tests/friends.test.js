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

describe("Adding a new relationship, get a relationship", () => {
    test("adding a relationship", async() => {
        await createUser();
        await createAnotherUser();
        await login();
        const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        const userAnother = await User.findOne({ where: { gmail: "messi@gmail.com" } });
        const session = await Session.findOne({ where: { userId: user.id }});    
        const newFriend = {
            userId: user.id,
            friendId: userAnother.id,
        }
        await api
                .post('/api/friends')
                .set('Authorization', `bearer ${session.token}`)
                .send(newFriend)
                .expect(201)
                .expect('Content-Type', /application\/json/);
        deleteImageTest(user);
        deleteImageTest(userAnother);
    })

    test("friends are get correctly", async() => {
        await createUser();
        await createAnotherUser();
        await login();
        const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        const userAnother = await User.findOne({ where: { gmail: "messi@gmail.com" } });
        const session = await Session.findOne({ where: { userId: user.id }});    
        const newFriend = {
            userId: user.id,
            friendId: userAnother.id,
        }
        await api
                .post('/api/friends')
                .set('Authorization', `bearer ${session.token}`)
                .send(newFriend)
                .expect(201)
                .expect('Content-Type', /application\/json/);
        
        const friends = await api 
                .get('/api/friends')
                .expect(200)
                .expect('Content-Type', /application\/json/);
        const userIds = friends.body.map(user => user.userId);
        expect(userIds).toContain(user.id);
        deleteImageTest(user);
        deleteImageTest(userAnother);
    })
})

describe('Viewing a specific relationship', () => {
    test('succeeds with a valid id' , async() => {
        await createUser();
        await createAnotherUser();
        await login();
        const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        const userAnother = await User.findOne({ where: { gmail: "messi@gmail.com" } });
        const session = await Session.findOne({ where: { userId: user.id }});    
        const newFriend = {
            userId: user.id,
            friendId: userAnother.id,
        }
        await api
                .post('/api/friends')
                .set('Authorization', `bearer ${session.token}`)
                .send(newFriend)
                .expect(201)
                .expect('Content-Type', /application\/json/);
        
        const friend = await Friend.findOne({ where: { userId: user.id } })
        const friendFound = await api
                                    .get(`/api/friends/${friend.id}`)
                                    .expect(200)
                                    .expect('Content-Type', /application\/json/);
        expect(friendFound.body.id).toEqual(friend.id)
        deleteImageTest(user);
        deleteImageTest(userAnother);
    })

    test('fails with status code 404 if friend does not exist', async() => {
        await createUser();
        await createAnotherUser();
        await login();
        const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        const userAnother = await User.findOne({ where: { gmail: "messi@gmail.com" } });
        const session = await Session.findOne({ where: { userId: user.id }});    
        const newFriend = {
            userId: user.id,
            friendId: userAnother.id,
        }
        const validNonexistingId = 1000000;
        await api
                .post('/api/friends')
                .set('Authorization', `bearer ${session.token}`)
                .send(newFriend)
                .expect(201)
                .expect('Content-Type', /application\/json/);

        await api 
                .get(`/api/friends/${validNonexistingId}`)
                .expect(404)
        deleteImageTest(user);
        deleteImageTest(userAnother);
    })
})

describe('Deleting a relationship', () => {
    test('Authorized user can delete his/her friend', async() => {
        await createUser();
        await createAnotherUser();
        await login();
        const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        const userAnother = await User.findOne({ where: { gmail: "messi@gmail.com" } });
        const session = await Session.findOne({ where: { userId: user.id }});    
        const newFriend = {
            userId: user.id,
            friendId: userAnother.id,
        }
        await api
                .post('/api/friends')
                .set('Authorization', `bearer ${session.token}`)
                .send(newFriend)
                .expect(201)
                .expect('Content-Type', /application\/json/);
        
        const friend = await Friend.findOne({ where: { userId: user.id } })

        await api
                .delete(`/api/friends/${friend.id}`)
                .set('Authorization', `bearer ${session.token}`)
                .expect(204)
        
        const friendsFound = await Friend.findAll({})
        expect(friendsFound).not.toContain(friend)

        deleteImageTest(user);
        deleteImageTest(userAnother);
    }) 

    test('Unauthorized user cannot delete friend return status 500', async () => {
        await createUser();
        await createAnotherUser();
        await login();
        const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        const userAnother = await User.findOne({ where: { gmail: "messi@gmail.com" } });
        const session = await Session.findOne({ where: { userId: user.id }});    
        const newFriend = {
            userId: user.id,
            friendId: userAnother.id,
        }
        await api
                .post('/api/friends')
                .set('Authorization', `bearer ${session.token}`)
                .send(newFriend)
                .expect(201)
                .expect('Content-Type', /application\/json/);
        
        const friend = await Friend.findOne({ where: { userId: user.id } })

        await api
            .delete(`/api/friends/${friend.id}`)
            .expect(500)

        deleteImageTest(user);
        deleteImageTest(userAnother);
    })

    test('Authorized user cannot delete friend of other user', async() => {
        await createUser();
        await createAnotherUser();
        await login();
        await loginAnother();
        const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
        const userAnother = await User.findOne({ where: { gmail: "messi@gmail.com" } });
        const session = await Session.findOne({ where: { userId: user.id }});    
        const sessionAnother = await Session.findOne({ where: { userId: userAnother.id }});    
        const newFriend = {
            userId: user.id,
            friendId: userAnother.id,
        }
        await api
                .post('/api/friends')
                .set('Authorization', `bearer ${session.token}`)
                .send(newFriend)
                .expect(201)
                .expect('Content-Type', /application\/json/);

        const friend = await Friend.findOne({ where: { userId: user.id } })

        await api
                .delete(`/api/friends/${friend.id}`)
                .set('Authorization', `bearer ${sessionAnother.token}`)
                .expect(404)
        deleteImageTest(user);
        deleteImageTest(userAnother);
    })
})