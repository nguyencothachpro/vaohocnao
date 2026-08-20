const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireGuest } = require('../middleware/auth');

router.get('/dang-nhap', requireGuest, authController.showLogin);
router.post('/dang-nhap', authController.login);
router.get('/dang-ky', requireGuest, authController.showRegister);
router.post('/dang-ky', authController.register);
router.get('/dang-xuat', authController.logout);

module.exports = router;
