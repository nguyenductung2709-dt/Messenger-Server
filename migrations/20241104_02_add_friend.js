const { DataTypes } = require('sequelize')
module.exports = {
  up: async ({ context: queryInterface }) => {
    await queryInterface.createTable('friends', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            references: { model: 'users', key: 'id' },
        },
        friend_id: {
            type: DataTypes.INTEGER,
            references: { model: 'users', key: 'id' },
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
    await queryInterface.dropTable('friends')
  },
}