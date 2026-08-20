// Middleware phan quyen: super_admin > admin > teacher > ta > student
const ROLE_LEVEL = { super_admin: 5, admin: 4, teacher: 3, ta: 2, student: 1 };

function attachUser(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  next();
}

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/dang-nhap');
  next();
}

function requireGuest(req, res, next) {
  if (req.session.user) return res.redirect('/');
  next();
}

// Cho phep tu 1 role toi thieu tro len (theo cap bac ROLE_LEVEL)
function requireRole(minRole) {
  return (req, res, next) => {
    const user = req.session.adminUser || req.session.user;
    if (!user) return res.redirect('/admin/dang-nhap');
    const level = ROLE_LEVEL[user.role] || 0;
    if (level < ROLE_LEVEL[minRole]) {
      return res.status(403).render('403', { user });
    }
    next();
  };
}

function requireAdminLogin(req, res, next) {
  if (!req.session.adminUser) return res.redirect('/admin/dang-nhap');
  res.locals.adminUser = req.session.adminUser;
  next();
}

module.exports = { attachUser, requireLogin, requireGuest, requireRole, requireAdminLogin, ROLE_LEVEL };
