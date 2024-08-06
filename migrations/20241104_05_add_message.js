const { DataTypes } = require("sequelize");

module.exports = {
  up: async ({ context: queryInterface }) => {
    await queryInterface.createTable("messages", {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      conversation_id: {
        type: DataTypes.INTEGER,
        references: { model: "conversations", key: "id" },
      },
      sender_id: {
        type: DataTypes.INTEGER,
        references: { model: "users", key: "id" },
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      file_name: {
        type: DataTypes.TEXT,
      },
      file_url: {
        type: DataTypes.TEXT,
      },
      image_url: {
        type: DataTypes.TEXT,
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
    });
  },
  down: async ({ context: queryInterface }) => {
    await queryInterface.dropTable("messages");
  },
};
