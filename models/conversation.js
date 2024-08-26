const { Model, DataTypes } = require("sequelize");
const { sequelize } = require("../utils/database/db");

class Conversation extends Model {}
Conversation.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.TEXT,
    },
    creatorId: {
      type: DataTypes.INTEGER,
      references: { model: "users", key: "id" },
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
    deletedAt: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    underscored: true,
    timestamps: true,
    modelName: "conversation",
  },
);

module.exports = Conversation;
