const mongoose = require('mongoose');
const {userSchema} = require('./Schemas');

require('../database/connection');

const User = mongoose.model('User', userSchema);

module.exports = {
    User
}