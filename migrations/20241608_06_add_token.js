const { DataTypes } = require("sequelize");

module.exports = {
  up: async ({ context: queryInterface }) => {
    await queryInterface.createTable("tokens", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            },
        user_id: {
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
    });
  },
  down: async ({ context: queryInterface }) => {
    await queryInterface.dropTable("tokens");
  },
};
