/* eslint-disable no-undef */
const supertest = require("supertest");
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

describe("Addition of a new conversation, correctly get a conversation", () => {
  test("adding a new conversation", async () => {
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

    const conversation = await Conversation.findAll({});
    expect(conversation).toHaveLength(1);
  });

  test("unauthorized cannot create conversation", async () => {
    await api.post("/api/conversations").field("title", "xoaixinh").expect(401);
  });

  test("conversation is get correctly", async () => {
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

    const conversations = await api
      .get("/api/conversations")
      .expect(200)
      .expect("Content-Type", /application\/json/);
    expect(conversations.body).toHaveLength(1);
  });
});

describe("Viewing a specific conversation", () => {
  test("A specific conversation is get correctly", async () => {
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
    const conversationFound = await api
      .get(`/api/conversations/${conversation.id}`)
      .expect(200)
      .expect("Content-Type", /application\/json/);
    expect(conversationFound.body.id).toEqual(conversation.id);
  });

  test("fails with status code 404 if conversation does not exist", async () => {
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

    const validNonexistingId = 1000000;
    await api.get(`/api/conversations/${validNonexistingId}`).expect(404);
  });
});

describe("Changing information about a conversation", () => {
  test("user in a conversation can change information", async () => {
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
      .put(`/api/conversations/${conversation.id}`)
      .set("Authorization", `bearer ${session.token}`)
      .field("title", "TungDz")
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const newConversation = await Conversation.findOne({
      where: { creatorId: user.id },
    });
    expect(newConversation.title).toEqual("TungDz");
  });

  test("user not in conversation cannot change information of the conversation", async () => {
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

    await loginSecond();

    const sessionAnother = await Session.findOne({
      where: { userId: userAnother.id },
    });

    await api
      .put(`/api/conversations/${conversation.id}`)
      .set("Authorization", `bearer ${sessionAnother.token}`)
      .field("title", "TungDz")
      .expect(401);
  });

  test("fails with status code 404 if the conversation does not exist", async () => {
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

    const validNonexistingId = 100000;

    await api
      .put(`/api/conversations/${validNonexistingId}`)
      .set("Authorization", `bearer ${session.token}`)
      .field("title", "TungDz")
      .expect(404);
  });
});

describe("Admin can delete a conversation", () => {
  test("delete a conversation", async () => {
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
      .delete(`/api/conversations/${conversation.id}`)
      .set("Authorization", `bearer ${session.token}`)
      .expect(204);

    const conversations = await Conversation.findAll({});
    expect(conversations).toHaveLength(0);
  });

  test("fails with status code 404 if the conversation does not exist", async () => {
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

    const validNonexistingId = 100000;

    await api
      .delete(`/api/conversations/${validNonexistingId}`)
      .set("Authorization", `bearer ${session.token}`)
      .field("title", "TungDz")
      .expect(404);
  });

  test("non-admin user cannot delete a conversation", async () => {
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
    await loginSecond();
    const sessionAnother = await Session.findOne({
      where: { userId: userAnother.id },
    });
    await Participant.create({
      conversationId: conversation.id,
      userId: userAnother.id,
    });

    await api
      .delete(`/api/conversations/${conversation.id}`)
      .set("Authorization", `bearer ${sessionAnother.token}`)
      .expect(401);

    const conversations = await Conversation.findAll({});
    expect(conversations).toHaveLength(1);
  });
});
