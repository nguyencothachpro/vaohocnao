const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Settings = require('../models/Settings');
const User = require('../models/User');
const vnpay = require('../services/payment/vnpay');
const momo = require('../services/payment/momo');
const zalopay = require('../services/payment/zalopay');
const bankTransfer = require('../services/payment/bankTransfer');

// Trang thanh toan: hien toan bo gio hang hien tai + chon phuong thuc + thong tin khach hang
exports.checkoutForm = async (req, res) => {
  const items = await Cart.listWithDetails(req.session.user.id);
  if (items.length === 0) return res.redirect('/gio-hang');
  const total = items.reduce((sum, i) => sum + Number(i.price), 0);

  const config = await Settings.getAll();
  const methods = {
    vnpay: vnpay.isConfigured(config),
    momo: momo.isConfigured(config),
    zalopay: zalopay.isConfigured(config),
    bank_transfer: bankTransfer.isConfigured(config),
    cod: true
  };
  const customer = await User.findById(req.session.user.id);
  res.render('checkout', { items, total, qrUrl: null, order: null, methods, customer });
};

exports.createOrder = async (req, res) => {
  const items = await Cart.listWithDetails(req.session.user.id);
  if (items.length === 0) return res.redirect('/gio-hang');
  const total = items.reduce((sum, i) => sum + Number(i.price), 0);

  const { payment_method, recipient_name, recipient_phone, recipient_address, recipient_birth_year } = req.body;
  const config = await Settings.getAll();
  const customer = await User.findById(req.session.user.id);

  // Bat buoc thu thap du thong tin khach hang cho MOI phuong thuc thanh toan (khong rieng COD),
  // de xay dung du lieu khach hang day du trong Admin
  if (!recipient_name || !recipient_phone || !recipient_address) {
    const methods = {
      vnpay: vnpay.isConfigured(config), momo: momo.isConfigured(config),
      zalopay: zalopay.isConfigured(config), bank_transfer: bankTransfer.isConfigured(config), cod: true
    };
    return res.render('checkout', {
      items, total, qrUrl: null, order: null, methods, customer,
      notice: 'Vui lòng nhập đầy đủ họ tên, số điện thoại và địa chỉ trước khi thanh toán.'
    });
  }

  // Luu lai vao ho so khach hang de lan sau khong phai nhap lai, va de Admin xem duoc thong tin day du
  await User.updateCustomerInfo(req.session.user.id, {
    name: recipient_name, phone: recipient_phone,
    birth_year: recipient_birth_year, address: recipient_address
  });
  req.session.user.name = recipient_name;

  if (payment_method === 'cod') {
    const order = await Order.createWithItems({
      user_id: req.session.user.id, items, amount: total, payment_method: 'cod',
      recipient_name, recipient_phone, recipient_address, recipient_birth_year
    });
    await Cart.clear(req.session.user.id);
    return res.render('checkout', { items, total, qrUrl: null, order, methods: {}, codConfirmed: true });
  }

  if (payment_method === 'bank_transfer') {
    const order = await Order.createWithItems({
      user_id: req.session.user.id, items, amount: total, payment_method: 'bank_transfer',
      recipient_name, recipient_phone, recipient_address, recipient_birth_year
    });
    await Cart.clear(req.session.user.id);
    return res.render('checkout', {
      items, total, qrUrl: `/thanh-toan/qr-anh/${order.id}`, order, methods: {},
      bankInfo: { bank_bin: config.bank_bin || '', bank_account_no: config.bank_account_no || '', bank_account_name: config.bank_account_name || '' }
    });
  }

  if (payment_method === 'vnpay' && vnpay.isConfigured(config)) {
    const order = await Order.createWithItems({
      user_id: req.session.user.id, items, amount: total, payment_method: 'vnpay',
      recipient_name, recipient_phone, recipient_address, recipient_birth_year
    });
    const paymentUrl = vnpay.createPaymentUrl({
      orderId: String(order.id), amount: total, orderDescription: `Thanh toan don hang #${order.id}`,
      ipAddr: req.ip, returnUrl: `${req.protocol}://${req.get('host')}/thanh-toan/vnpay/tra-ve`, config
    });
    await Cart.clear(req.session.user.id);
    return res.redirect(paymentUrl);
  }

  if (payment_method === 'momo' && momo.isConfigured(config)) {
    const order = await Order.createWithItems({
      user_id: req.session.user.id, items, amount: total, payment_method: 'momo',
      recipient_name, recipient_phone, recipient_address, recipient_birth_year
    });
    const payUrl = await momo.createPaymentUrl({
      orderId: String(order.id), amount: total, orderInfo: `Thanh toan don hang #${order.id}`,
      returnUrl: `${req.protocol}://${req.get('host')}/thanh-toan/vnpay/tra-ve`,
      notifyUrl: `${req.protocol}://${req.get('host')}/thanh-toan/vnpay/tra-ve`, config
    });
    await Cart.clear(req.session.user.id);
    return res.redirect(payUrl);
  }

  if (payment_method === 'zalopay' && zalopay.isConfigured(config)) {
    const order = await Order.createWithItems({
      user_id: req.session.user.id, items, amount: total, payment_method: 'zalopay',
      recipient_name, recipient_phone, recipient_address, recipient_birth_year
    });
    const result = await zalopay.createOrder({
      orderId: String(order.id), amount: total, description: `Thanh toan don hang #${order.id}`,
      redirectUrl: `${req.protocol}://${req.get('host')}/thanh-toan/vnpay/tra-ve`, config
    });
    if (result && result.order_url) { await Cart.clear(req.session.user.id); return res.redirect(result.order_url); }
  }

  const methods = { vnpay: vnpay.isConfigured(config), momo: momo.isConfigured(config), zalopay: zalopay.isConfigured(config), bank_transfer: bankTransfer.isConfigured(config), cod: true };
  return res.render('checkout', {
    items, total, qrUrl: null, order: null, methods, customer,
    notice: 'Phương thức này chưa được quản trị viên cấu hình. Vui lòng vào Admin > Cài đặt thanh toán để nhập thông tin merchant.'
  });
};

exports.vnpayReturn = async (req, res) => {
  const config = await Settings.getAll();
  const valid = vnpay.verifyReturn(req.query, config);
  const orderId = req.query.vnp_TxnRef;
  if (valid) {
    await Order.markPaid(orderId, req.query.vnp_TransactionNo);
    const order = await Order.findById(orderId);
    if (order) await Order.fulfill(order);
  }
  res.render('checkout-result', { success: valid });
};

exports.qrImage = async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  if (!order || !req.session.user || order.user_id !== req.session.user.id) {
    return res.status(404).send('Not found');
  }
  const config = await Settings.getAll();
  const remoteUrl = bankTransfer.vietQrUrl({ amount: order.amount, addInfo: `THANHTOAN DH${order.id}`, config });

  try {
    const axios = require('axios');
    const response = await axios.get(remoteUrl, {
      responseType: 'arraybuffer', timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' },
      validateStatus: () => true
    });
    const contentType = response.headers['content-type'] || '';
    const buf = Buffer.from(response.data);
    const isPng = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50;
    const isJpg = buf.length > 3 && buf[0] === 0xFF && buf[1] === 0xD8;

    if (response.status !== 200 || (!contentType.startsWith('image/') && !isPng && !isJpg)) {
      const bodyText = buf.toString('utf-8');
      return res.status(502).send(
        `Không tải được ảnh QR thật từ VietQR.\n\nHTTP status: ${response.status}\nContent-Type nhận được: ${contentType || '(không có)'}\nNội dung trả về (rút gọn):\n${bodyText.slice(0, 500)}\n\nLink đã gọi: ${remoteUrl}`
      );
    }
    res.set('Content-Type', contentType.startsWith('image/') ? contentType : 'image/png');
    res.set('Cache-Control', 'no-store');
    res.send(buf);
  } catch (err) {
    console.error('Loi tai anh QR:', err.message);
    res.status(502).send(`Không tải được ảnh QR (lỗi kết nối).\n\nChi tiết: ${err.message}\n\nLink đã thử gọi: ${remoteUrl}`);
  }
};

// Admin xac nhan thu cong khi hoc vien chuyen khoan / COD
exports.adminConfirmPaid = async (req, res) => {
  const { order_id } = req.params;
  const order = await Order.findById(order_id);
  if (order) {
    await Order.markPaid(order.id, null);
    await Order.fulfill(order);
  }
  res.redirect('/admin/don-hang');
};

// ---- Cai dat thanh toan (Admin) ----
exports.settingsForm = async (req, res) => {
  const config = await Settings.getAll();
  res.render('admin/settings/payment', { config, success: null });
};

exports.settingsSave = async (req, res) => {
  const {
    vnp_tmn_code, vnp_hash_secret, vnp_url,
    momo_partner_code, momo_access_key, momo_secret_key,
    zalopay_app_id, zalopay_key1,
    bank_bin, bank_account_no, bank_account_name,
    sepay_api_key
  } = req.body;
  await Settings.setMany({
    vnp_tmn_code, vnp_hash_secret, vnp_url,
    momo_partner_code, momo_access_key, momo_secret_key,
    zalopay_app_id, zalopay_key1,
    bank_bin, bank_account_no, bank_account_name,
    sepay_api_key
  });
  const config = await Settings.getAll();
  res.render('admin/settings/payment', { config, success: 'Đã lưu cấu hình thanh toán!' });
};
