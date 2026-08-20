const express=require('express'); const router=express.Router(); const c=require('../controllers/classroomController'); const {requireLogin}=require('../middleware/auth');
router.get('/hoc-cung-thay-co', c.index);
router.post('/hoc-cung-thay-co', requireLogin, c.create);
router.get('/hoc-cung-thay-co/:code', c.show);
module.exports=router;
