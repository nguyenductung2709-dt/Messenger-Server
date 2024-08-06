/* eslint-disable no-undef */
const supertest = require("supertest");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");
const {
  User,
  Session,
  Friend,
  Conversation,
  Participant,
  Message,
} = require("../models/index");
const app = require("../app");

const api = supertest(app);
const s3 = require("../utils/s3user");

const bucketName = process.env.BUCKET_NAME;
const { connectToDatabase } = require("../utils/db");
const {
  createFirstUser,
  createSecondUser,
  createThirdUser,
  login,
  loginSecond,
} = require("./testhelper");

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
const deleteImageTest2 = async (message) => {
  let deleteParams = {};
  if (message.imageUrl) {
    deleteParams = {
      Bucket: bucketName,
      Key: message.imageUrl,
    };
  }

  if (message.fileUrl) {
    deleteParams = {
      Bucket: bucketName,
      Key: message.fileUrl,
    };
  }
  const deleteCommand = new DeleteObjectCommand(deleteParams);
  await s3.send(deleteCommand);
};

describe("Testing POST and GET requests", () => {
  test("a message with image is sent properly", async () => {
    const imagePath = path.resolve(__dirname, "../assets/messi.webp");
    await createFirstUser();
    await createSecondUser();
    await createThirdUser();
    await login();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const userAnother = await User.findOne({
      where: { gmail: "messi@gmail.com" },
    });
    const userMore = await User.findOne({
      where: { gmail: "neymar@gmail.com" },
    });
    const session = await Session.findOne({ where: { userId: user.id } });
    await api
      .post("/api/conversations")
      .set("Authorization", `bearer ${session.token}`)
      .field("title", "xoaixinh")
      .field("participants", [userAnother.id, userMore.id])
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
    expect(message.imageUrl).toBeDefined();

    deleteImageTest2(message);
  });

  test("a message with file is sent properly", async () => {
    const filePath = path.resolve(__dirname, "../assets/test.txt");
    await createFirstUser();
    await createSecondUser();
    await createThirdUser();
    await login();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const userAnother = await User.findOne({
      where: { gmail: "messi@gmail.com" },
    });
    const userMore = await User.findOne({
      where: { gmail: "neymar@gmail.com" },
    });
    const session = await Session.findOne({ where: { userId: user.id } });
    await api
      .post("/api/conversations")
      .set("Authorization", `bearer ${session.token}`)
      .field("title", "xoaixinh")
      .field("participants", [userAnother.id, userMore.id])
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
    expect(message.fileUrl).toBeDefined();

    deleteImageTest2(message);
  });

  test("unauthorized user cannot send a message", async () => {
    const filePath = path.resolve(__dirname, "../assets/test.txt");
    await createFirstUser();
    await createSecondUser();
    await createThirdUser();
    await login();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const userAnother = await User.findOne({
      where: { gmail: "messi@gmail.com" },
    });
    const userMore = await User.findOne({
      where: { gmail: "neymar@gmail.com" },
    });
    const session = await Session.findOne({ where: { userId: user.id } });
    await api
      .post("/api/conversations")
      .set("Authorization", `bearer ${session.token}`)
      .field("title", "xoaixinh")
      .field("participants", [userAnother.id, userMore.id])
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
      .expect(401);
  });
});

describe("Testing PUT request", () => {
  test("user can fix his/her message", async () => {
    const imagePath = path.resolve(__dirname, "../assets/ronaldo.webp");
    await createFirstUser();
    await createSecondUser();
    await createThirdUser();
    await login();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const userAnother = await User.findOne({
      where: { gmail: "messi@gmail.com" },
    });
    const userMore = await User.findOne({
      where: { gmail: "neymar@gmail.com" },
    });
    const session = await Session.findOne({ where: { userId: user.id } });
    await api
      .post("/api/conversations")
      .set("Authorization", `bearer ${session.token}`)
      .field("title", "xoaixinh")
      .field("participants", [userAnother.id, userMore.id])
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

    deleteImageTest2(message);
  });

  test("user cannot fix message of other user", async () => {
    const imagePath = path.resolve(__dirname, "../assets/ronaldo.webp");
    await createFirstUser();
    await createSecondUser();
    await createThirdUser();
    await login();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const userAnother = await User.findOne({
      where: { gmail: "messi@gmail.com" },
    });
    const userMore = await User.findOne({
      where: { gmail: "neymar@gmail.com" },
    });
    const session = await Session.findOne({ where: { userId: user.id } });
    await api
      .post("/api/conversations")
      .set("Authorization", `bearer ${session.token}`)
      .field("title", "xoaixinh")
      .field("participants", [userAnother.id, userMore.id])
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

    await loginSecond();
    const sessionAnother = await Session.findOne({
      where: { userId: userAnother.id },
    });

    await api
      .put(`/api/messages/${message.id}`)
      .set("Authorization", `bearer ${sessionAnother.token}`)
      .field("message", "Messi is better")
      .expect(401);

    deleteImageTest2(message);
  });
});

describe("Testing DELETE request", () => {
  test("user can delete his/her messages", async () => {
    const imagePath = path.resolve(__dirname, "../assets/ronaldo.webp");
    await createFirstUser();
    await createSecondUser();
    await createThirdUser();
    await login();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const userAnother = await User.findOne({
      where: { gmail: "messi@gmail.com" },
    });
    const userMore = await User.findOne({
      where: { gmail: "neymar@gmail.com" },
    });
    const session = await Session.findOne({ where: { userId: user.id } });
    await api
      .post("/api/conversations")
      .set("Authorization", `bearer ${session.token}`)
      .field("title", "xoaixinh")
      .field("participants", [userAnother.id, userMore.id])
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
    deleteImageTest2(message);
  });

  test("user cannot delete message of other user", async () => {
    const imagePath = path.resolve(__dirname, "../assets/ronaldo.webp");
    await createFirstUser();
    await createSecondUser();
    await createThirdUser();
    await login();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const userAnother = await User.findOne({
      where: { gmail: "messi@gmail.com" },
    });
    const userMore = await User.findOne({
      where: { gmail: "neymar@gmail.com" },
    });
    const session = await Session.findOne({ where: { userId: user.id } });
    await api
      .post("/api/conversations")
      .set("Authorization", `bearer ${session.token}`)
      .field("title", "xoaixinh")
      .field("participants", [userAnother.id, userMore.id])
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

    await loginSecond();
    const sessionAnother = await Session.findOne({
      where: { userId: userAnother.id },
    });

    await api
      .delete(`/api/messages/${message.id}`)
      .set("Authorization", `bearer ${sessionAnother.token}`)
      .expect(401);

    const messages = await Message.findAll({});
    expect(messages).toHaveLength(1);

    deleteImageTest2(message);
  });
});
