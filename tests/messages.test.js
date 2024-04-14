const {
  User,
  Session,
  Friend,
  Conversation,
  Participant,
  Message,
} = require("../models/index");
const supertest = require("supertest");
const app = require("../app");
const api = supertest(app);
const path = require("path");
const s3 = require("../utils/s3user");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const bucketName = process.env.BUCKET_NAME;
const { connectToDatabase } = require("../utils/db");

beforeEach(async () => {
  try {
    await connectToDatabase();
    await Message.destroy({ where: {} });
    await Session.destroy({ where: {} });
    await Friend.destroy({ where: {} });
    await Participant.destroy({ where: {} });
    await Conversation.destroy({ where: {} });
    await User.destroy({ where: {} });
  } catch (error) {
    console.error("Error deleting users:", error);
  }
});

const createUser = async () => {
  const imagePath = path.resolve(__dirname, "../assets/ronaldo.webp");

  await api
    .post("/api/users")
    .field("gmail", "ronaldo@gmail.com")
    .field("password", "ronaldosiu")
    .field("firstName", "Ronaldo")
    .field("lastName", "Aveiro")
    .field("middleName", "Cristiano")
    .attach("avatarImage", imagePath)
    .expect(201)
    .expect("Content-Type", /application\/json/);
};

const createAnotherUser = async () => {
  const imagePath = path.resolve(__dirname, "../assets/messi.webp");

  await api
    .post("/api/users")
    .field("gmail", "messi@gmail.com")
    .field("password", "messidibovuotrau")
    .field("firstName", "Messi")
    .field("lastName", "Lionel")
    .field("middleName", "Goat")
    .attach("avatarImage", imagePath)
    .expect(201)
    .expect("Content-Type", /application\/json/);
};

const login = async () => {
  const accountDetails = {
    gmail: "ronaldo@gmail.com",
    password: "ronaldosiu",
  };
  await api
    .post("/api/auth/login")
    .send(accountDetails)
    .expect(200)
    .expect("Content-Type", /application\/json/);
};

const loginAnother = async () => {
  const accountDetails = {
    gmail: "messi@gmail.com",
    password: "messidibovuotrau",
  };
  await api
    .post("/api/auth/login")
    .send(accountDetails)
    .expect(200)
    .expect("Content-Type", /application\/json/);
};

const deleteImageTest = async (user) => {
  const deleteParams = {
    Bucket: bucketName,
    Key: user.avatarName,
  };
  const deleteCommand = new DeleteObjectCommand(deleteParams);
  await s3.send(deleteCommand);
};

const deleteImageTest2 = async (message) => {
  let deleteParams = {};
  if (message.imageName) {
    deleteParams = {
      Bucket: bucketName,
      Key: message.imageName,
    };
  }

  if (message.fileName) {
    deleteParams = {
      Bucket: bucketName,
      Key: message.fileName,
    };
  }
  const deleteCommand = new DeleteObjectCommand(deleteParams);
  await s3.send(deleteCommand);
};

describe("Testing POST and GET requests", () => {
  test("a message with image is sent properly and get properly", async () => {
    const imagePath = path.resolve(__dirname, "../assets/ronaldo.webp");
    await createUser();
    await login();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const session = await Session.findOne({ where: { userId: user.id } });
    await api
      .post("/api/conversations")
      .set("Authorization", `bearer ${session.token}`)
      .field("creatorId", user.id)
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const conversation = await Conversation.findOne({
      where: { creatorId: user.id },
    });
    await api
      .post("/api/messages")
      .set("Authorization", `bearer ${session.token}`)
      .field("conversationId", conversation.id)
      .field("senderId", user.id)
      .field("message", "Siuuuu")
      .attach("messageImage", imagePath)
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const message = await Message.findOne({
      where: { conversationId: conversation.id, senderId: user.id },
    });
    expect(message.imageName).toBeDefined();

    const messages = await api
      .get("/api/messages")
      .expect(200)
      .expect("Content-Type", /application\/json/);

    expect(messages.body).toHaveLength(1);

    deleteImageTest(user);
    deleteImageTest2(message);
  });

  test("a message with file is sent properly", async () => {
    const filePath = path.resolve(__dirname, "../assets/test.txt");
    await createUser();
    await login();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const session = await Session.findOne({ where: { userId: user.id } });
    await api
      .post("/api/conversations")
      .set("Authorization", `bearer ${session.token}`)
      .field("creatorId", user.id)
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const conversation = await Conversation.findOne({
      where: { creatorId: user.id },
    });
    await api
      .post("/api/messages")
      .set("Authorization", `bearer ${session.token}`)
      .field("conversationId", conversation.id)
      .field("senderId", user.id)
      .field("message", "Siuuuu")
      .attach("messageImage", filePath)
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const message = await Message.findOne({
      where: { conversationId: conversation.id, senderId: user.id },
    });
    expect(message.fileName).toBeDefined();

    deleteImageTest(user);
    deleteImageTest2(message);
  });

  test("unauthorized user cannot send a message", async () => {
    const filePath = path.resolve(__dirname, "../assets/test.txt");
    await createUser();
    await login();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const session = await Session.findOne({ where: { userId: user.id } });
    await api
      .post("/api/conversations")
      .set("Authorization", `bearer ${session.token}`)
      .field("creatorId", user.id)
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const conversation = await Conversation.findOne({
      where: { creatorId: user.id },
    });
    await api
      .post("/api/messages")
      .field("conversationId", conversation.id)
      .field("senderId", user.id)
      .field("message", "Siuuuu")
      .attach("messageImage", filePath)
      .expect(500);

    deleteImageTest(user);
  });
});

describe("Testing PUT request", () => {
  test("user can fix his/her message", async () => {
    const imagePath = path.resolve(__dirname, "../assets/ronaldo.webp");
    await createUser();
    await login();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const session = await Session.findOne({ where: { userId: user.id } });
    await api
      .post("/api/conversations")
      .set("Authorization", `bearer ${session.token}`)
      .field("creatorId", user.id)
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const conversation = await Conversation.findOne({
      where: { creatorId: user.id },
    });
    await api
      .post("/api/messages")
      .set("Authorization", `bearer ${session.token}`)
      .field("conversationId", conversation.id)
      .field("senderId", user.id)
      .field("message", "Siuuuu")
      .attach("messageImage", imagePath)
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const message = await Message.findOne({
      where: { conversationId: conversation.id, senderId: user.id },
    });
    await api
      .put(`/api/messages/${message.id}`)
      .set("Authorization", `bearer ${session.token}`)
      .field("message", "Messi is better")
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const newMessage = await Message.findOne({
      where: { conversationId: conversation.id, senderId: user.id },
    });
    expect(newMessage.message).toEqual("Messi is better");

    deleteImageTest(user);
    deleteImageTest2(message);
  });

  test("user cannot fix message of other user", async () => {
    const imagePath = path.resolve(__dirname, "../assets/ronaldo.webp");
    await createUser();
    await createAnotherUser();
    await login();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const session = await Session.findOne({ where: { userId: user.id } });
    await api
      .post("/api/conversations")
      .set("Authorization", `bearer ${session.token}`)
      .field("creatorId", user.id)
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const conversation = await Conversation.findOne({
      where: { creatorId: user.id },
    });
    await api
      .post("/api/messages")
      .set("Authorization", `bearer ${session.token}`)
      .field("conversationId", conversation.id)
      .field("senderId", user.id)
      .field("message", "Siuuuu")
      .attach("messageImage", imagePath)
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const message = await Message.findOne({
      where: { conversationId: conversation.id, senderId: user.id },
    });

    await loginAnother();
    const userAnother = await User.findOne({
      where: { gmail: "messi@gmail.com" },
    });
    const sessionAnother = await Session.findOne({
      where: { userId: userAnother.id },
    });

    await api
      .put(`/api/messages/${message.id}`)
      .set("Authorization", `bearer ${sessionAnother.token}`)
      .field("message", "Messi is better")
      .expect(404);
    deleteImageTest(user);
    deleteImageTest(userAnother);
    deleteImageTest2(message);
  });
});

describe("Testing DELETE request", () => {
  test("user can delete his/her messages", async () => {
    const imagePath = path.resolve(__dirname, "../assets/ronaldo.webp");
    await createUser();
    await login();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const session = await Session.findOne({ where: { userId: user.id } });
    await api
      .post("/api/conversations")
      .set("Authorization", `bearer ${session.token}`)
      .field("creatorId", user.id)
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const conversation = await Conversation.findOne({
      where: { creatorId: user.id },
    });
    await api
      .post("/api/messages")
      .set("Authorization", `bearer ${session.token}`)
      .field("conversationId", conversation.id)
      .field("senderId", user.id)
      .field("message", "Siuuuu")
      .attach("messageImage", imagePath)
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const message = await Message.findOne({
      where: { conversationId: conversation.id, senderId: user.id },
    });

    await api
      .delete(`/api/messages/${message.id}`)
      .set("Authorization", `bearer ${session.token}`)
      .expect(204);

    const messages = await Message.findAll({});
    expect(messages).toHaveLength(0);
    deleteImageTest(user);
    deleteImageTest2(message);
  });

  test("user cannot delete message of other user", async () => {
    const imagePath = path.resolve(__dirname, "../assets/ronaldo.webp");
    await createUser();
    await createAnotherUser();
    await login();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const session = await Session.findOne({ where: { userId: user.id } });
    await api
      .post("/api/conversations")
      .set("Authorization", `bearer ${session.token}`)
      .field("creatorId", user.id)
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const conversation = await Conversation.findOne({
      where: { creatorId: user.id },
    });
    await api
      .post("/api/messages")
      .set("Authorization", `bearer ${session.token}`)
      .field("conversationId", conversation.id)
      .field("senderId", user.id)
      .field("message", "Siuuuu")
      .attach("messageImage", imagePath)
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const message = await Message.findOne({
      where: { conversationId: conversation.id, senderId: user.id },
    });

    await loginAnother();
    const userAnother = await User.findOne({
      where: { gmail: "messi@gmail.com" },
    });
    const sessionAnother = await Session.findOne({
      where: { userId: userAnother.id },
    });

    await api
      .delete(`/api/messages/${message.id}`)
      .set("Authorization", `bearer ${sessionAnother.token}`)
      .expect(404);

    const messages = await Message.findAll({});
    expect(messages).toHaveLength(1);

    deleteImageTest(user);
    deleteImageTest(userAnother);
    deleteImageTest2(message);
  });
});
