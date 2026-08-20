// Nhan webhook (IPN) tu SePay khi co tien vao tai khoan ngan hang
// Tai lieu: https://docs.sepay.vn/tich-hop-webhooks.html
const Order = require('../models/Order');
const Settings = require('../models/Settings');

exports.sepayWebhook = async (req, res) => {
  try {
    const config = await Settings.getAll();
    const expectedKey = (config.sepay_api_key || process.env.SEPAY_API_KEY || '').trim();

    // Xac thuc: SePay gui header "Authorization: Apikey <API_KEY_BAN_DA_CAU_HINH_BEN_SEPAY>"
    if (expectedKey) {
      const authHeader = req.headers['authorization'] || '';
      const providedKey = authHeader.replace(/^Apikey\s+/i, '').trim();
      if (providedKey !== expectedKey) {
        console.warn('>>> SePay webhook: sai API key, tu choi.');
        return res.status(401).json({ success: false, message: 'Invalid API key' });
      }
    }

    const body = req.body || {};
    const transferType = body.transfer_type; // 'credit' = tien vao, 'debit' = tien ra
    const content = body.content || '';
    const amount = Number(body.amount || 0);
    const transactionId = body.transaction_id || body.reference_code || null;

    console.log('>>> SePay webhook nhan duoc:', { transferType, content, amount, transactionId });

    if (transferType !== 'credit') {
      return res.json({ success: true, message: 'Bo qua giao dich tien ra' });
    }

    // Noi dung chuyen khoan co dang "THANHTOAN DH<id_don_hang>" (xem services/payment/bankTransfer.js)
    const match = content.match(/DH(\d+)/i);
    if (!match) {
      console.warn('>>> SePay webhook: khong tim thay ma don hang trong noi dung:', content);
      return res.json({ success: true, message: 'Khong tim thay ma don hang trong noi dung chuyen khoan' });
    }

    const orderId = match[1];
    const order = await Order.findById(orderId);
    if (!order) {
      console.warn('>>> SePay webhook: khong tim thay don hang #' + orderId);
      return res.json({ success: true, message: 'Khong tim thay don hang' });
    }
    if (order.status === 'paid') {
      return res.json({ success: true, message: 'Don hang da duoc xac nhan truoc do' });
    }
    if (amount < order.amount) {
      console.warn(`>>> SePay webhook: so tien chuyen (${amount}) nho hon gia tri don hang #${orderId} (${order.amount})`);
      return res.json({ success: true, message: 'So tien chuyen khoan chua du' });
    }

    await Order.markPaid(order.id, transactionId);
    await Order.fulfill(order);
    console.log(`>>> SePay webhook: da tu dong xac nhan va mo khoa don hang #${orderId}`);

    res.json({ success: true, message: 'Da xac nhan thanh toan va mo khoa hoc' });
  } catch (err) {
    console.error('Loi xu ly SePay webhook:', err);
    res.status(500).json({ success: false, message: 'Loi server' });
  }
};
