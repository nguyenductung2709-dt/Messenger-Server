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
const { createFirstUser, login } = require("./testhelper");

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

describe("Test logout functionality", () => {
  test("login and logout functionality", async () => {
    await createFirstUser();
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
