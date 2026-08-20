// Sinh chung chi PDF co QR Code xac thuc
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const Certificate = require('../models/Certificate');
const Course = require('../models/Course');
const User = require('../models/User');

exports.downloadCertificate = async (req, res) => {
  const cert = await Certificate.find(req.session.user.id, req.params.courseId);
  if (!cert) return res.status(404).send('Bạn chưa hoàn thành khóa học này.');

  const course = await Course.findById(req.params.courseId);
  const user = await User.findById(req.session.user.id);
  const verifyUrl = `${req.protocol}://${req.get('host')}/chung-chi/xac-thuc/${cert.certificate_code}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl);
  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=chung-chi-${cert.certificate_code}.pdf`);

  const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 0 });
  doc.pipe(res);

  // Vien trang trai
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f7f5ef');
  doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).lineWidth(3).stroke('#c9a55a');
  doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).lineWidth(1).stroke('#c9a55a');

  doc.fillColor('#2b2b2b').fontSize(14).font('Helvetica').text('CHỨNG NHẬN HOÀN THÀNH KHÓA HỌC', 0, 90, { align: 'center', characterSpacing: 3 });
  doc.moveDown(1.5);
  doc.fontSize(30).font('Helvetica-Bold').text(user.name, 0, 160, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(13).font('Helvetica').fillColor('#555').text('đã hoàn thành xuất sắc khóa học', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#2b2b2b').text(course.title, { align: 'center' });
  doc.moveDown(1);
  doc.fontSize(10).font('Helvetica').fillColor('#777').text(
    `Mã chứng chỉ: ${cert.certificate_code}   •   Ngày cấp: ${new Date(cert.issued_at).toLocaleDateString('vi-VN')}`,
    { align: 'center' }
  );

  doc.image(qrBuffer, doc.page.width - 160, doc.page.height - 160, { width: 100 });
  doc.fontSize(8).fillColor('#999').text('Quét mã để xác thực', doc.page.width - 160, doc.page.height - 55, { width: 100, align: 'center' });

  doc.end();
};
