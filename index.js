require("./app");
const { server } = require("./socket/socket");
const { PORT } = require("./utils/config");
const { connectToDatabase } = require("./utils/db");

const start = async () => {
  await connectToDatabase();
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start();
