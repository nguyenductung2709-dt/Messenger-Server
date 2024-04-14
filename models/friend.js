const { Model, DataTypes } = require("sequelize");
const { sequelize } = require("../utils/db");

class Friend extends Model {}
Friend.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      references: { model: "users", key: "id" },
    },
    friendId: {
      type: DataTypes.INTEGER,
      references: { model: "users", key: "id" },
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
    modelName: "friend",
  },
);

module.exports = Friend;
