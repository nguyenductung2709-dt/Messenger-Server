const { Model, DataTypes } = require("sequelize");

const { sequelize } = require("../utils/db");

class User extends Model {}
User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    gmail: {
      type: DataTypes.TEXT,
      unique: true,
      allowNull: false,
      validate: {
        isEmail: {
          msg: "Username must be a valid email address",
        },
      },
    },
    passwordHash: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    firstName: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    middleName: {
      type: DataTypes.TEXT,
    },
    dateOfBirth: {
      type: DataTypes.DATE,
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
    avatarName: {
      type: DataTypes.TEXT,
      // allowNull: false,
    },
    disabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
  },
  {
    sequelize,
    underscored: true,
    modelName: "user",
  },
);

module.exports = User;
