const { Model, DataTypes } = require("sequelize");

const { sequelize } = require("../utils/database/db");

class User extends Model {}
User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.TEXT,
      unique: true,
    },
    gmail: {
      type: DataTypes.TEXT,
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
    resetPasswordToken: {
      type: DataTypes.TEXT,
      defaultValue: null
    },
    tokenExpiry: {
      type: DataTypes.DATE,
      defaultValue: null
    },
  },
  {
    sequelize,
    underscored: true,
    modelName: "user",
  },
);

module.exports = User;
