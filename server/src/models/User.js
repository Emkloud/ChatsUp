const { DataTypes } = require('sequelize');
const sequelize = require('./index');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  avatar: { type: DataTypes.STRING, defaultValue: 'default-avatar.png' },
  online: { type: DataTypes.BOOLEAN, defaultValue: false },
  lastSeen: { type: DataTypes.DATE },
});

User.beforeCreate(async (user) => {
  user.password = await bcrypt.hash(user.password, 12);
});

User.prototype.validPassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

module.exports = User;