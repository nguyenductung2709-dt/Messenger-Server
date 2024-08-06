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

describe("Adding a new relationship, get a relationship", () => {
  test("adding a relationship", async () => {
    await createFirstUser();
    await createSecondUser();
    await login();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const session = await Session.findOne({ where: { userId: user.id } });
    await api
      .post("/api/friends")
      .set("Authorization", `bearer ${session.token}`)
      .send({
        gmail: "messi@gmail.com",
        userId: user.id,
      })
      .expect(201)
      .expect("Content-Type", /application\/json/);
  });
});

describe("Viewing a specific relationship", () => {
  test("succeeds with a valid id", async () => {
    await createFirstUser();
    await createSecondUser();
    await login();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const session = await Session.findOne({ where: { userId: user.id } });
    await api
      .post("/api/friends")
      .set("Authorization", `bearer ${session.token}`)
      .send({
        gmail: "messi@gmail.com",
        userId: user.id,
      })
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const friendFound = await api
      .get(`/api/friends/${user.id}`)
      .expect(200)
      .expect("Content-Type", /application\/json/);
    const userIds = friendFound.body.map((friend) => friend.userId);
    expect(userIds).toContain(user.id);
  });
});

describe("Deleting a relationship", () => {
  test("Authorized user can delete his/her friend", async () => {
    await createFirstUser();
    await createSecondUser();
    await login();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const session = await Session.findOne({ where: { userId: user.id } });
    await api
      .post("/api/friends")
      .set("Authorization", `bearer ${session.token}`)
      .send({
        gmail: "messi@gmail.com",
        userId: user.id,
      })
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const friend = await Friend.findOne({ where: { userId: user.id } });

    await api
      .delete(`/api/friends/${friend.id}`)
      .set("Authorization", `bearer ${session.token}`)
      .expect(204);

    const friendsFound = await Friend.findAll({});
    expect(friendsFound).not.toContain(friend);
  });

  test("Unauthorized user cannot delete friend return status 401", async () => {
    await createFirstUser();
    await createSecondUser();
    await login();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const session = await Session.findOne({ where: { userId: user.id } });
    await api
      .post("/api/friends")
      .set("Authorization", `bearer ${session.token}`)
      .send({
        gmail: "messi@gmail.com",
        userId: user.id,
      })
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const friend = await Friend.findOne({ where: { userId: user.id } });

    await api.delete(`/api/friends/${friend.id}`).expect(401);
  });

  test("Authorized user cannot delete friend of other user", async () => {
    await createFirstUser();
    await createSecondUser();
    await login();
    await loginSecond();
    const user = await User.findOne({ where: { gmail: "ronaldo@gmail.com" } });
    const userAnother = await User.findOne({
      where: { gmail: "messi@gmail.com" },
    });
    const session = await Session.findOne({ where: { userId: user.id } });
    const sessionAnother = await Session.findOne({
      where: { userId: userAnother.id },
    });

    await api
      .post("/api/friends")
      .set("Authorization", `bearer ${session.token}`)
      .send({
        gmail: "messi@gmail.com",
        userId: user.id,
      })
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const friend = await Friend.findOne({ where: { userId: user.id } });

    await api
      .delete(`/api/friends/${friend.id}`)
      .set("Authorization", `bearer ${sessionAnother.token}`)
      .expect(401);
  });
});
