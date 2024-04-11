const { DataTypes } = require('sequelize')
module.exports = {
  up: async ({ context: queryInterface }) => {
    await queryInterface.createTable('participants', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        conversation_id: {
            type: DataTypes.INTEGER,
            references: { model: 'conversations', key: 'id' },
        },
        user_id: {
            type: DataTypes.INTEGER,
            references: { model: 'users', key: 'id' },
        },
        is_admin: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: new Date()
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: new Date()
        },
    })
  },
  down: async ({ context: queryInterface }) => {
    await queryInterface.dropTable('participants')
  },
}