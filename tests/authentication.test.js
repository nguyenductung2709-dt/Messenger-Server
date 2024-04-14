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

const deleteImageTest = async (user) => {
  const deleteParams = {
    Bucket: bucketName,
    Key: user.avatarName,
  };
  const deleteCommand = new DeleteObjectCommand(deleteParams);
  await s3.send(deleteCommand);
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
    deleteImageTest(user);
  });
});
