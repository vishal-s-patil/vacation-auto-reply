const { Schema } = require('mongoose');

const userSchema = new Schema({
    email: String,
    is_on_vacation : {
        type: String,
        default: 'false'
    },
    vacation_start : {
        type: String,
        default: null 
    },
    vacation_end : {
        type: String,
        default: null
    }
});

module.exports = {
    userSchema,
}