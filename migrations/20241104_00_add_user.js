const { DataTypes } = require("sequelize");

module.exports = {
  up: async ({ context: queryInterface }) => {
    await queryInterface.createTable("users", {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
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
      username: {
        type: DataTypes.TEXT,
        unique: true,
      },
      password_hash: {
        type: DataTypes.TEXT,
      },
      first_name: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      last_name: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      middle_name: {
        type: DataTypes.TEXT,
      },
      date_of_birth: {
        type: DataTypes.DATE,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: new Date(),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: new Date(),
      },
      avatar_name: {
        type: DataTypes.TEXT,
        // allowNull: false,
      },
      disabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
    });
  },

  down: async ({ context: queryInterface }) => {
    await queryInterface.dropTable("users");
  },
};
