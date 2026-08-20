const db = require('../config/db');

const Settings = {
  // Tra ve toan bo cai dat dang object { key: value }
  async getAll() {
    const r = await db.query('SELECT key, value FROM settings');
    const obj = {};
    r.rows.forEach(row => { obj[row.key] = row.value; });
    return obj;
  },
  // Luu nhieu cai dat cung luc, vd: setMany({ vnp_tmn_code: 'xxx', bank_bin: '970436' })
  // Tu dong xoa khoang trang thua o dau/cuoi de tranh loi (vd: BIN ngan hang bi du dau cach)
  async setMany(data) {
    for (const [key, value] of Object.entries(data)) {
      const cleaned = typeof value === 'string' ? value.trim() : (value ?? '');
      await db.query(
        `INSERT INTO settings (key, value) VALUES ($1,$2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, cleaned]
      );
    }
  }
};
module.exports = Settings;
