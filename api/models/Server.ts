import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../lib/db';
import User from './User';

class Server extends Model {}

Server.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  host: {
    type: DataTypes.STRING,
    allowNull: false
  },
  port: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  auth_method: {
    type: DataTypes.STRING,
    allowNull: false
  },
  encrypted_credentials: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'Server'
});

User.hasMany(Server, { foreignKey: 'userId' });
Server.belongsTo(User, { foreignKey: 'userId' });

export default Server;
