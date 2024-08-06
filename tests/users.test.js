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

describe("Addition of a new user, get a user", () => {
  test("addition of a new user", async () => {
    await createFirstUser();
    const users = await User.findAll({});
    expect(users).toHaveLength(1);
    const names = users.map((user) => user.firstName);
    expect(names).toContain("Ronaldo");
  });

  test("users are get correctly", async () => {
    await createFirstUser();
    const users = await api
      .get("/api/users")
      .expect(200)
      .expect("Content-Type", /application\/json/);

    const names = users.body.map((user) => user.firstName);
    expect(names).toContain("Ronaldo");
  });
});

describe("Viewing a specific user", () => {
  test("succeeds with a valid id", async () => {
    await createFirstUser();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const {id} = user;

    const resultUser = await api
      .get(`/api/users/${id}`)
      .expect(200)
      .expect("Content-Type", /application\/json/);

    expect(resultUser.body.id).toEqual(user.id);
    expect(resultUser.body.gmail).toEqual(user.gmail);
    expect(resultUser.body.firstName).toEqual(user.firstName);
    expect(resultUser.body.lastName).toEqual(user.lastName);
  });

  test("fails with status code 404 if user does not exist", async () => {
    await createFirstUser();
    const validNonexistingId = 1000000000;
    await api.get(`/api/users/${validNonexistingId}`).expect(404);
  });
});

describe("Changing information of user", () => {
  test("changing text information from user", async () => {
    await createFirstUser();
    await login();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const session = await Session.findOne({ where: { userId: user.id } });
    await api
      .put(`/api/users/${user.id}`)
      .set("Authorization", `bearer ${session.token}`)
      .field("firstName", "Messi")
      .field("lastName", "Lionel")
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const newUser = await User.findOne({
      where: { gmail: "ronaldo@gmail.com" },
    });

    expect(newUser.firstName).toEqual("Messi");
    expect(newUser.lastName).toEqual("Lionel");
  });

  test("changing information of user without authentication receive a 500 error", async () => {
    await createFirstUser();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    await api
      .put(`/api/users/${user.id}`)
      .field("firstName", "Messi")
      .field("lastName", "Lionel")
      .expect(401);
  });

  test("users cannot change information of each other", async () => {
    await createFirstUser();
    await createSecondUser();
    await loginSecond();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const userAnother = await User.findOne({
      where: { gmail: "messi@gmail.com" },
    });
    const sessionAnother = await Session.findOne({
      where: { userId: userAnother.id },
    });
    await api
      .put(`/api/users/${user.id}`)
      .set("Authorization", `bearer ${sessionAnother.token}`)
      .field("firstName", "Messi")
      .field("lastName", "Lionel")
      .expect(401)
      .expect("Content-Type", /application\/json/);
  });
});
