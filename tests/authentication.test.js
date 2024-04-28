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

const createUser = async () => {
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

describe("Test logout functionality", () => {
  test("login and logout functionality", async () => {
    await createUser();
    await login();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const session = await Session.findOne({ where: { userId: user.id } });
    await api
      .post("/api/auth/logout")
      .set("Authorization", `bearer ${session.token}`)
      .expect(200);
    const sessionNew = await Session.findAll({});
    expect(sessionNew).toHaveLength(0);
  });
});
