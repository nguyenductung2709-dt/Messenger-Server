const supertest = require("supertest");
const app = require("../app");

const api = supertest(app);

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

const loginSecond = async () => {
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

module.exports = {
  createFirstUser,
  createSecondUser,
  createThirdUser,
  createFourthUser,
  login,
  loginAnother,
  loginSecond,
};
