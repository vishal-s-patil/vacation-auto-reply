// pass : 
const dotenv = require('dotenv');
dotenv.config();

var mongoose = require('mongoose');

// const pass = process.env.MONGO_PASS;

// const uri = `mongodb+srv://vspatil8123:${pass}@main.lgpyrsp.mongodb.net/gmailautoreply`
const uri = 'mongodb+srv://vspatil8123:<password>@cluster0.ncpkr4b.mongodb.net/gmailautoreply'

// mongodb+srv://vspatil8123:ZomVu3KtkROOgvSI@cluster0.ncpkr4b.mongodb.net/
mongoose.connect(uri, {useNewUrlParser: true});

var conn = mongoose.connection;
conn.on('connected', function() {
    console.log('database is connected successfully');
});
conn.on('disconnected',function(){
    console.log('database is disconnected successfully');
})
conn.on('error', console.error.bind(console, 'connection error:'));
module.exports = conn;
