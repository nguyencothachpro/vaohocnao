// Tich hop ZaloPay. Thong tin merchant doc uu tien tu Cai dat trong Admin, du phong bang .env
const crypto = require('crypto');
const axios = (() => { try { return require('axios'); } catch (e) { return null; } })();

async function createOrder({ orderId, amount, description, redirectUrl, config = {} }) {
  const appId = (config.zalopay_app_id || process.env.ZALOPAY_APP_ID || '').trim();
  const key1 = (config.zalopay_key1 || process.env.ZALOPAY_KEY1 || '').trim();
  const endpoint = config.zalopay_endpoint || process.env.ZALOPAY_ENDPOINT || 'https://sb-openapi.zalopay.vn/v2/create';

  const appTime = Date.now();
  const appTransId = `${new Date().toISOString().slice(2, 10).replace(/-/g, '')}_${orderId}`;
  const embedData = JSON.stringify({ redirecturl: redirectUrl });
  const item = JSON.stringify([]);

  const order = {
    app_id: appId, app_trans_id: appTransId, app_user: 'user_' + orderId, app_time: appTime,
    item, embed_data: embedData, amount, description, bank_code: ''
  };
  const data = `${appId}|${appTransId}|${order.app_user}|${amount}|${appTime}|${embedData}|${item}`;
  order.mac = crypto.createHmac('sha256', key1 || '').update(data).digest('hex');

  if (!axios) throw new Error('Can cai dat thu vien axios: npm install axios');
  const res = await axios.post(endpoint, null, { params: order });
  return res.data;
}
function isConfigured(config = {}) {
  return !!((config.zalopay_app_id || process.env.ZALOPAY_APP_ID) && (config.zalopay_key1 || process.env.ZALOPAY_KEY1));
}
module.exports = { createOrder, isConfigured };
