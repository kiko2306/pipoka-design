const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { HttpError } = require('../public/model');
const { requiredSecret } = require('./model');

class AuthService {
  constructor(database) {
    this.database = database;
  }

  async login(email, password) {
    const [users] = await this.database.query(
      'SELECT id, email, password_hash FROM users WHERE email = ? LIMIT 1',
      [email],
    );
    if (!users.length || !(await bcrypt.compare(password, users[0].password_hash))) {
      throw new HttpError(400, 'Email or password is incorrect.');
    }
    return {
      accessToken: jwt.sign({ sub: users[0].id, role: 'admin' }, requiredSecret(), { expiresIn: '8h' }),
      email: users[0].email,
    };
  }
}

module.exports = { AuthService };
