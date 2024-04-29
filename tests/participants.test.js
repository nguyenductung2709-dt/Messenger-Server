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

const createFirstUser = async () => {
  await api
    .post("/api/users")
    .field("gmail", "ronaldo@gmail.com")
    .field("password", "ronaldosiu")
    .field("firstName", "Ronaldo")
    .field("lastName", "Aveiro")
    .field("middleName", "Cristiano")
    .expect(201)
    .expect("Content-Type", /application\/json/);
};

const createSecondUser = async () => {
  await api
    .post("/api/users")
    .field("gmail", "messi@gmail.com")
    .field("password", "messidibovuotrau")
    .field("firstName", "Messi")
    .field("lastName", "Lionel")
    .field("middleName", "Goat")
    .expect(201)
    .expect("Content-Type", /application\/json/);
};

const createThirdUser = async () => {
  await api
    .post("/api/users")
    .field("gmail", "neymar@gmail.com")
    .field("password", "neymar")
    .field("firstName", "Neymar")
    .field("lastName", "Dos Santos")
    .field("middleName", "Junior")
    .expect(201)
    .expect("Content-Type", /application\/json/);
};

const createFourthUser = async () => {
  await api
    .post("/api/users")
    .field("gmail", "benzema@gmail.com")
    .field("password", "benzema")
    .field("firstName", "Benzema")
    .field("lastName", "Dos Santos")
    .field("middleName", "Junior")
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
    gmail: "benzema@gmail.com",
    password: "benzema",
  };
  await api
    .post("/api/auth/login")
    .send(accountDetails)
    .expect(200)
    .expect("Content-Type", /application\/json/);
};

describe("Testing POST and GET request", () => {
  test("addition of a new participant and get participant correctly", async () => {
    await createFirstUser();
    await createSecondUser();
    await createThirdUser();
    await createFourthUser();
    await login();
    const firstUser = await User.findOne({
      where: { gmail: "ronaldo@gmail.com" },
    });
    const secondUser = await User.findOne({
      where: { gmail: "messi@gmail.com" },
    });
    const thirdUser = await User.findOne({
      where: { gmail: "neymar@gmail.com" },
    });
    const fourthUser = await User.findOne({
      where: { gmail: "benzema@gmail.com" },
    });
    const session = await Session.findOne({ where: { userId: firstUser.id } });
    await api
      .post("/api/conversations")
      .set("Authorization", `bearer ${session.token}`)
      .field("title", "xoaixinh")
      .field("participants", [secondUser.id, thirdUser.id])
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const conversation = await Conversation.findOne({
      where: { creatorId: firstUser.id },
    });

    await api
      .post("/api/participants")
      .set("Authorization", `bearer ${session.token}`)
      .send({ conversationId: conversation.id, gmail: fourthUser.gmail })
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const participants = await api
      .get("/api/participants")
      .expect(200)
      .expect("Content-Type", /application\/json/);

    expect(participants.body).toHaveLength(4);
  });
});

describe("Testing PUT request", () => {
  test("making another user to admin", async () => {
    await createFirstUser();
    await createSecondUser();
    await createThirdUser();
    await createFourthUser();
    await login();
    const firstUser = await User.findOne({
      where: { gmail: "ronaldo@gmail.com" },
    });
    const secondUser = await User.findOne({
      where: { gmail: "messi@gmail.com" },
    });
    const thirdUser = await User.findOne({
      where: { gmail: "neymar@gmail.com" },
    });
    const fourthUser = await User.findOne({
      where: { gmail: "benzema@gmail.com" },
    });
    const session = await Session.findOne({ where: { userId: firstUser.id } });
    await api
      .post("/api/conversations")
      .set("Authorization", `bearer ${session.token}`)
      .field("title", "xoaixinh")
      .field("participants", [secondUser.id, thirdUser.id])
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const conversation = await Conversation.findOne({
      where: { creatorId: firstUser.id },
    });

    await api
      .post("/api/participants")
      .set("Authorization", `bearer ${session.token}`)
      .send({ conversationId: conversation.id, gmail: fourthUser.gmail })
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const participant = await Participant.findOne({
      where: { conversationId: conversation.id, userId: fourthUser.id },
    });

    await api
      .put(`/api/participants/${participant.id}`)
      .set("Authorization", `bearer ${session.token}`)
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const newParticipant = await Participant.findOne({
      where: { conversationId: conversation.id, userId: fourthUser.id },
    });
    expect(newParticipant.isAdmin).toEqual(true);
  });

  test("unauthorized user cannot make admin", async () => {
    await createFirstUser();
    await createSecondUser();
    await createThirdUser();
    await createFourthUser();
    await login();
    const firstUser = await User.findOne({
      where: { gmail: "ronaldo@gmail.com" },
    });
    const secondUser = await User.findOne({
      where: { gmail: "messi@gmail.com" },
    });
    const thirdUser = await User.findOne({
      where: { gmail: "neymar@gmail.com" },
    });
    const fourthUser = await User.findOne({
      where: { gmail: "benzema@gmail.com" },
    });
    const session = await Session.findOne({ where: { userId: firstUser.id } });
    await api
      .post("/api/conversations")
      .set("Authorization", `bearer ${session.token}`)
      .field("title", "xoaixinh")
      .field("participants", [secondUser.id, thirdUser.id])
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const conversation = await Conversation.findOne({
      where: { creatorId: firstUser.id },
    });

    await api
      .post("/api/participants")
      .set("Authorization", `bearer ${session.token}`)
      .send({ conversationId: conversation.id, gmail: fourthUser.gmail })
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const participant = await Participant.findOne({
      where: { conversationId: conversation.id, userId: fourthUser.id },
    });

    await loginAnother();

    const sessionAnother = await Session.findOne({
      where: { userId: fourthUser.id },
    });

    await api
      .put(`/api/participants/${participant.id}`)
      .set("Authorization", `bearer ${sessionAnother.token}`)
      .expect(404);
  });
});

describe("Testing DELETE request", () => {
  test("deleting an user from a conversation", async () => {
    await createFirstUser();
    await createSecondUser();
    await createThirdUser();
    await createFourthUser();
    await login();
    const firstUser = await User.findOne({
      where: { gmail: "ronaldo@gmail.com" },
    });
    const secondUser = await User.findOne({
      where: { gmail: "messi@gmail.com" },
    });
    const thirdUser = await User.findOne({
      where: { gmail: "neymar@gmail.com" },
    });
    const fourthUser = await User.findOne({
      where: { gmail: "benzema@gmail.com" },
    });
    const session = await Session.findOne({ where: { userId: firstUser.id } });
    await api
      .post("/api/conversations")
      .set("Authorization", `bearer ${session.token}`)
      .field("title", "xoaixinh")
      .field("participants", [secondUser.id, thirdUser.id])
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const conversation = await Conversation.findOne({
      where: { creatorId: firstUser.id },
    });

    await api
      .post("/api/participants")
      .set("Authorization", `bearer ${session.token}`)
      .send({ conversationId: conversation.id, gmail: fourthUser.gmail })
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const participant = await Participant.findOne({
      where: { conversationId: conversation.id, userId: fourthUser.id },
    });

    await api
      .delete(`/api/participants/${participant.id}`)
      .set("Authorization", `bearer ${session.token}`)
      .expect(204);

    const participants = await Participant.findAll({});
    expect(participants).toHaveLength(3);
  });

  test("unauthorized user cannot delete an user from a conversation", async () => {
    await createFirstUser();
    await createSecondUser();
    await createThirdUser();
    await createFourthUser();
    await login();
    const firstUser = await User.findOne({
      where: { gmail: "ronaldo@gmail.com" },
    });
    const secondUser = await User.findOne({
      where: { gmail: "messi@gmail.com" },
    });
    const thirdUser = await User.findOne({
      where: { gmail: "neymar@gmail.com" },
    });
    const fourthUser = await User.findOne({
      where: { gmail: "benzema@gmail.com" },
    });
    const session = await Session.findOne({ where: { userId: firstUser.id } });
    await api
      .post("/api/conversations")
      .set("Authorization", `bearer ${session.token}`)
      .field("title", "xoaixinh")
      .field("participants", [secondUser.id, thirdUser.id])
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const conversation = await Conversation.findOne({
      where: { creatorId: firstUser.id },
    });

    await api
      .post("/api/participants")
      .set("Authorization", `bearer ${session.token}`)
      .send({ conversationId: conversation.id, gmail: fourthUser.gmail })
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const participant = await Participant.findOne({
      where: { conversationId: conversation.id, userId: fourthUser.id },
    });

    await loginAnother();

    const sessionAnother = await Session.findOne({
      where: { userId: fourthUser.id },
    });

    await api
      .delete(`/api/participants/${participant.id}`)
      .set("Authorization", `bearer ${sessionAnother.token}`)
      .expect(404);
  });
});
