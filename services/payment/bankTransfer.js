// Chuyen khoan QR - dung dich vu VietQR (mien phi, khong can dang ky merchant)
// Thong tin tai khoan ngan hang doc uu tien tu Cai dat trong Admin, du phong bang .env
function vietQrUrl({ amount, addInfo, config = {} }) {
  const bankBin = (config.bank_bin || process.env.BANK_BIN || '970436').trim();
  const accountNo = (config.bank_account_no || process.env.BANK_ACCOUNT_NO || '0000000000').trim();
  const accountName = encodeURIComponent((config.bank_account_name || process.env.BANK_ACCOUNT_NAME || 'CHU TAI KHOAN').trim());
  return `https://img.vietqr.io/image/${bankBin}-${accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${accountName}`;
}
function isConfigured(config = {}) {
  return !!(config.bank_account_no || process.env.BANK_ACCOUNT_NO);
}
module.exports = { vietQrUrl, isConfigured };
