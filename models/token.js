const { Model, DataTypes } = require("sequelize");
const { sequelize } = require("../utils/db");

class Token extends Model {}

Token.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        onUpdate: "cascade",
        onDelete: "cascade",
        references: { model: "users", key: "id" }
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    underscored: true,
    timestamps: true,
    modelName: "session",
  },
);

module.exports = Token;
