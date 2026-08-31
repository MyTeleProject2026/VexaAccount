// backend/src/utils/helpers.js
const crypto = require('crypto');
module.exports = { randomToken: (bytes = 32) => crypto.randomBytes(bytes).toString('base64url') };
