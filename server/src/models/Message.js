const { DataTypes } = require('sequelize');
const sequelize = require('./index');
const User = require('./User');

const Message = sequelize.define('Message', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  content: { type: DataTypes.TEXT, allowNull: false },
  type: { type: DataTypes.STRING, defaultValue: 'text' }, // text, image
  edited: { type: DataTypes.BOOLEAN, defaultValue: false },
  messageStatus: { type: DataTypes.ENUM('sent', 'delivered', 'read'), defaultValue: 'sent' },
  replyToId: { type: DataTypes.INTEGER, allowNull: true },
});

Message.belongsTo(User, { as: 'sender', foreignKey: 'senderId' });
Message.belongsTo(User, { as: 'receiver', foreignKey: 'receiverId' });
Message.belongsTo(Message, { as: 'replyTo', foreignKey: 'replyToId' });

module.exports = Message;