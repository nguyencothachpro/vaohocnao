const db = require('../config/db');
const LoginLog = {
  async record(user_id, ip_address, user_agent) {
    await db.query('INSERT INTO login_logs (user_id,ip_address,user_agent) VALUES ($1,$2,$3)',
      [user_id, ip_address, user_agent]);
  },
  async byUser(user_id, limit = 20) {
    const r = await db.query('SELECT * FROM login_logs WHERE user_id=$1 ORDER BY logged_in_at DESC LIMIT $2',
      [user_id, limit]);
    return r.rows;
  }
};
module.exports = LoginLog;
