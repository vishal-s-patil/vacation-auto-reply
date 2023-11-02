const express = require('express');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const url = require('url');
const yaml = require('js-yaml');
const axios = require('axios');
const fs = require('fs');
const mongoose = require("mongoose");
const bodyParser = require('body-parser');
require('./database/connection');

const { User } = require('./database/Models');

const app = express();
const port = process.env.PORT || 3000;

// app.use(bodyParser.json());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('views', 'views');
app.set('view engine', 'ejs');

let CLIENT_ID;
let CLIENT_SECRET;
let REDIRECT_URL;
let AUTH_CODE;
let ACCESS_TOKEN;
let REFRESH_TOKEN;
let token = "ya29.a0AfB_byBPNMpmSot8rrfaNx-RpP76yGCaIXP7EZVUefLxJuwvV_LgYFE1fyhNLedh1niO1t0q5ToJw4DfVZRu5U4Z7_oWPzeu8CgMaZbsLzHm55evxhwKmMSWZdodc1Cz8Iar4a3M2cL932gya23B6_meMdonkVVmrV101waCgYKAaMSARMSFQGOcNnCnwem1oUIg1XPnptKTuHTiw0173"
let replied_threads = new Set();
let lable_id;
let lable_name = "Vacation";

try {
    const credentials = yaml.load(fs.readFileSync('credentials.yaml', 'utf8'));
    CLIENT_ID = credentials.CLIENT_ID
    CLIENT_SECRET = credentials.CLIENT_SECRET
    REDIRECT_URL = credentials.REDIRECT_URL
} catch (e) {
    console.error('Error reading or parsing the YAML configuration file:', e);
    process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URL
);


const scopes = [
    'https://mail.google.com/',
];

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/login', (req, res) => {
    const auth_url = oauth2Client.generateAuthUrl({
        access_type: 'offline',

        scope: scopes
    });

    // console.log('auth_url', auth_url);

    res.redirect(auth_url);
})

app.get('/callback', async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const auth_code = parsedUrl.query.code;
    // console.log("query", parsedUrl.query);
    console.log('auth_code', auth_code);
    AUTH_CODE = auth_code;

    try {
        const { tokens } = await oauth2Client.getToken(AUTH_CODE)
        // console.log(tokens);
        oauth2Client.setCredentials(tokens);

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        ACCESS_TOKEN = tokens.access_token;
        REFRESH_TOKEN = tokens.refresh_token;

        gmail.users.getProfile({ userId: 'me' }, async (error, response) => {
            if (error) {
                console.error('Error while trying to retrieve user profile:', error);
                res.send('err');
            } else {
                const emailAddress = response.data.emailAddress;
                // console.log('data', response.data);
                let user = await User.findOne({ "email": emailAddress });

                if (!user) {
                    user = new User({
                        "email": emailAddress
                    });
                    user.save();
                }

                createLable(emailAddress);

                res.send(`loged in successfully: ${emailAddress}`);
            }
        });
    }
    catch (err) {
        console.log(err);
        res.send(err);
    }
})

const createLable = (user_mail) => {
    oauth2Client.setCredentials({ access_token: token });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const labelRequest = {
        userId: user_mail,
        resource: {
            name: lable_name,
            labelListVisibility: 'labelShow',
            messageListVisibility: 'show',
        },
    };

    gmail.users.labels.create(labelRequest, (error, label) => {
        if (error) {
            console.log(error.errors[0]["message"])
            if(error.errors[0]["message"] === "Label name exists or conflicts") {
                return;
            }
            console.error('Error creating label:', error);
        } else {
            lable_id = label.data.id;
            console.log('lable id : ', lable_id);
            // console.log('Label created:', label.data);
        }
    });
}

app.post('/add_vacation', async (req, res) => {
    oauth2Client.setCredentials({ access_token: token });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const { email, start_date, end_date } = req.body;

    let user = User.findOne({ "email": email });

    if (!user) {
        res.redirect('/login');
    }

    await User.updateOne({ "email": email }, {
        "is_on_vacation": "true",
        "vacation_start": start_date,
        "vacation_end": end_date
    });

    res.json({ "msg": "vacation details added" });
})

const parseDate = (dateStr) => {
    const parts = dateStr.split('/');
    if (parts.length == 1) {
        return parseInt(dateStr);
    }
    const date = new Date(parts[2], parts[1] - 1, parts[0]);
    const unixTime = Math.floor(date.getTime() / 1000);
    return unixTime
}

function updateLable_promise(user_mail, msg_id) {
    return new Promise(async(resolve, reject) => {
        oauth2Client.setCredentials({ access_token: token });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        
        gmail.users.messages.modify(
            {
                userId: user_mail,
                id: msg_id,
                resource: {
                    addLabelIds: [lable_id],
                },
            },
            (error, response) => {
                if (error) {
                    console.log('lable id in upfate', lable_id);
                    console.error('Error adding label to the email:');
                    reject();
                } else {
                    // response.data
                    console.log('Label added to the email');
                    resolve()
                }
            }
        );
    });
}

const sendMail = async (user_mail, from_mail, subject, thread_id) => {
    oauth2Client.setCredentials({ access_token: token })

    let resource = {
        raw: Buffer.from(
            `To: ${from_mail
            }\r\n` +
            `Subject: ${subject
            }\r\n` +
            `Content-Type: text/plain; charset="UTF-8"\r\n` +
            `Content-Transfer-Encoding: 7bit\r\n\r\n` +
            `I am on vacation please accept some delays in the reply\r\n`
        ).toString("base64")
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    gmail.users.messages.send({
        userId: user_mail,
        resource: {
            raw: resource.raw,
            threadId: thread_id
        },
    }, (error, response) => {
        if (error) {
            console.error('Error sending email:', error);
        } else {
            console.log('Email sent:', response.data);
        }
    });
}

function getMessage_promise(user, msg_id) {
    return new Promise(async (resolve, reject) => {
        oauth2Client.setCredentials({ access_token: ACCESS_TOKEN });
        let url = `https://gmail.googleapis.com/gmail/v1/users/${user}/messages/${msg_id}`

        const config = {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        };

        let from_mail;
        let subject;

        const response = await axios.get(url, config);
        let len = response["data"]["payload"]["headers"].length;
        for (let i = 0; i < len; i++) {
            let data = response["data"]["payload"]["headers"][i];
            // console.log('data', data, data["name"]);
            if (data["name"] == "From") {
                from_mail = data["value"];
            }
            if (data["name"] == "Subject") {
                subject = data["value"];
            }
        }
        // console.log("from_email", from_email);
        resolve({ from_mail, subject });
    });
}

const reply = async (email, unix_start_date, unix_end_date, access_token) => {
    const config = {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    };

    let url = `https://www.googleapis.com/gmail/v1/users/vspatil8123@gmail.com/messages/?q="is:unread after:${unix_start_date} before:${unix_end_date}"`;

    const response = await axios.get(url, config);
    console.log("total_messages", response["data"]["resultSizeEstimate"]);
    if (response["data"]["resultSizeEstimate"] == 0) {
        //console.log("data", response["data"]);
        console.log("no new messages");
        return;
    }

    
    let msg_id = response["data"]["messages"][0]["id"];
    let thread_id = response["data"]["messages"][0]["threadId"];

    console.log('ids', msg_id, thread_id);

    let { from_mail, subject } = await getMessage_promise(email, msg_id, thread_id);
    console.log('from_mail', from_mail);
    console.log('sub', subject);

    if (!replied_threads.has(thread_id)) {
        sendMail(email, from_mail, subject, thread_id);
    }
    else {
        console.log('already replied, ignoring');
    }

    await updateLable_promise(email, msg_id);
    replied_threads.add(thread_id);
}

const interval = setInterval(async () => {
    let users = await User.find();

    users.forEach((user, index) => {
        if (user.is_on_vacation == 'true') {
            console.log(`${user.email} is in vacaion`);
            let start_time = parseDate(user.vacation_start);
            let end_time = parseDate(user.vacation_end);

            let curr_time = Math.floor(new Date().getTime() / 1000);
            console.log(start_time, end_time, curr_time);
            if (start_time <= curr_time && end_time >= curr_time) {
                reply(user.email, start_time, end_time);
            }
        }
    });
}, Math.floor(Math.random() * (120 - 45 + 1)) + 45);



app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});