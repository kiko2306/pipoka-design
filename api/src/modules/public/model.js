class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function asyncHandler(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function object(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new HttpError(400, 'A JSON object is required.');
  }
  return value;
}

function string(value, field, minimum, maximum, optional = false) {
  if ((value === undefined || value === null || value === '') && optional) {
    return undefined;
  }
  if (typeof value !== 'string' || value.trim().length < minimum || value.trim().length > maximum) {
    throw new HttpError(400, `${field} must contain between ${minimum} and ${maximum} characters.`);
  }
  return value.trim();
}

function email(value) {
  const normalized = string(value, 'Email', 3, 255).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new HttpError(400, 'Email must be valid.');
  }
  return normalized;
}

function boolean(value, field, optional = true) {
  if (value === undefined && optional) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw new HttpError(400, `${field} must be a boolean.`);
  }
  return value;
}

function uuid(value, field) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, `${field} must be a UUID.`);
  }
  return value;
}

module.exports = { HttpError, asyncHandler, object, string, email, boolean, uuid };
