// Tich hop VNPay. Thong tin merchant (TMN Code, Hash Secret) doc uu tien tu Cai dat trong Admin,
// neu chua nhap trong Admin thi doc tu bien moi truong .env lam du phong.
const crypto = require('crypto');
const qs = require('qs');

function sortObject(obj) {
  const sorted = {};
  Object.keys(obj).sort().forEach(key => { sorted[key] = obj[key]; });
  return sorted;
}

function createPaymentUrl({ orderId, amount, orderDescription, ipAddr, returnUrl, config = {} }) {
  const tmnCode = (config.vnp_tmn_code || process.env.VNP_TMN_CODE || '').trim();
  const secretKey = (config.vnp_hash_secret || process.env.VNP_HASH_SECRET || '').trim();
  const vnpUrl = (config.vnp_url || process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html').trim();

  const date = new Date();
  const createDate = date.toISOString().replace(/[-:T.]/g, '').slice(0, 14);

  let vnp_Params = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode,
    vnp_Locale: 'vn',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: orderId,
    vnp_OrderInfo: orderDescription,
    vnp_OrderType: 'other',
    vnp_Amount: amount * 100,
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: createDate
  };

  vnp_Params = sortObject(vnp_Params);
  const signData = qs.stringify(vnp_Params, { encode: false });
  const hmac = crypto.createHmac('sha512', secretKey || '');
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
  vnp_Params.vnp_SecureHash = signed;

  return vnpUrl + '?' + qs.stringify(vnp_Params, { encode: false });
}

function verifyReturn(query, config = {}) {
  const secretKey = config.vnp_hash_secret || process.env.VNP_HASH_SECRET;
  const vnp_Params = { ...query };
  const secureHash = vnp_Params.vnp_SecureHash;
  delete vnp_Params.vnp_SecureHash;
  delete vnp_Params.vnp_SecureHashType;
  const sorted = sortObject(vnp_Params);
  const signData = qs.stringify(sorted, { encode: false });
  const hmac = crypto.createHmac('sha512', secretKey || '');
  const checkSum = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
  return checkSum === secureHash && query.vnp_ResponseCode === '00';
}

function isConfigured(config = {}) {
  return !!((config.vnp_tmn_code || process.env.VNP_TMN_CODE) && (config.vnp_hash_secret || process.env.VNP_HASH_SECRET));
}

module.exports = { createPaymentUrl, verifyReturn, isConfigured };
