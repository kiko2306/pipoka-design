const jwt = require('jsonwebtoken');
const { HttpError } = require('../public/model');

function requireAdmin(request, _response, next) {
  const token = request.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return next(new HttpError(401, 'Administrator authentication is required.'));
  }
  try {
    const payload = jwt.verify(token, requiredSecret());
    if (payload.role !== 'admin') {
      throw new Error('Not an administrator.');
    }
    request.admin = payload;
    return next();
  } catch {
    return next(new HttpError(401, 'Your administrator session is invalid.'));
  }
}

function requiredSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required.');
  }
  return process.env.JWT_SECRET;
}

module.exports = { requireAdmin, requiredSecret };
