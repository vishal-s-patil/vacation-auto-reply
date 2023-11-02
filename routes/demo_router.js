const {fun1} = require('../components/demo');
const router = require('express').Router()


router.get('/', fun1);

module.exports = router;
