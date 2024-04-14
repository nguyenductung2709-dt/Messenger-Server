const { Model, DataTypes } = require("sequelize");
const { sequelize } = require("../utils/db");

class Message extends Model {}
Message.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    conversationId: {
      type: DataTypes.INTEGER,
      references: { model: "conversations", key: "id" },
    },
    senderId: {
      type: DataTypes.INTEGER,
      references: { model: "users", key: "id" },
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    fileName: {
      type: DataTypes.TEXT,
    },
    imageName: {
      type: DataTypes.TEXT,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: new Date(),
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: new Date(),
    },
  },
  {
    sequelize,
    underscored: true,
    modelName: "message",
  },
);

module.exports = Message;
