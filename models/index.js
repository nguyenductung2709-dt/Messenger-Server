const User = require("./user");
const Session = require("./session");
const Conversation = require("./conversation");
const Message = require("./message");
const Participant = require("./participant");
const Friend = require("./friend");

User.hasMany(Message, { foreignKey: "senderId" });
Message.belongsTo(User, { foreignKey: "senderId" });

User.hasMany(Friend, { foreignKey: "userId" });
Friend.belongsTo(User, { foreignKey: "userId" });

Conversation.hasMany(Message, { foreignKey: "conversationId" });
Message.belongsTo(Conversation, { foreignKey: "conversationId" });

User.belongsToMany(Conversation, { through: Participant, as: "conversation" });
Conversation.belongsToMany(User, {
  through: Participant,
  as: "participant_list",
});

module.exports = {
  User,
  Session,
  Conversation,
  Message,
  Participant,
  Friend,
};
