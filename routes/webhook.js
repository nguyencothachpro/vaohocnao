const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

router.post('/sepay', webhookController.sepayWebhook);

module.exports = router;
