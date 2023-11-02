const router = require('express').Router()
const { get_auth_token } = require('../components/get_auth_token')
const { callback } = require('../components/get_auth_token')

router.get('/get_auth_token', get_auth_token)
router.get('/callback', callback)

module.exports = router;

// const router = express.Router();


// const demo_router  = require('./routes/demo_router');
// const auth_router  = require('./routes/auth_router');
// app.use('/demo', demo_router);
// app.use('/v1/auth', auth_router);