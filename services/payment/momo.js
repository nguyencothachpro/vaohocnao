// Tich hop Vi MoMo. Thong tin merchant doc uu tien tu Cai dat trong Admin, du phong bang .env
const crypto = require('crypto');
const axios = (() => { try { return require('axios'); } catch (e) { return null; } })();

async function createPaymentUrl({ orderId, amount, orderInfo, returnUrl, notifyUrl, config = {} }) {
  const partnerCode = (config.momo_partner_code || process.env.MOMO_PARTNER_CODE || '').trim();
  const accessKey = (config.momo_access_key || process.env.MOMO_ACCESS_KEY || '').trim();
  const secretKey = (config.momo_secret_key || process.env.MOMO_SECRET_KEY || '').trim();
  const endpoint = config.momo_endpoint || process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create';
  const requestId = orderId + '-' + Date.now();

  const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=&ipnUrl=${notifyUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${returnUrl}&requestId=${requestId}&requestType=captureWallet`;
  const signature = crypto.createHmac('sha256', secretKey || '').update(rawSignature).digest('hex');

  const payload = {
    partnerCode, accessKey, requestId, amount: String(amount), orderId, orderInfo,
    redirectUrl: returnUrl, ipnUrl: notifyUrl, extraData: '', requestType: 'captureWallet',
    signature, lang: 'vi'
  };

  if (!axios) throw new Error('Can cai dat thu vien axios: npm install axios');
  const { data } = await axios.post(endpoint, payload);
  return data.payUrl;
}
function isConfigured(config = {}) {
  return !!((config.momo_partner_code || process.env.MOMO_PARTNER_CODE) && (config.momo_secret_key || process.env.MOMO_SECRET_KEY));
}
module.exports = { createPaymentUrl, isConfigured };
