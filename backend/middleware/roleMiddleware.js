module.exports = (roles) => (req, res, next) => {
  // Sprawdź, czy użytkownik jest zalogowany i ma rolę
  if (!req.user || !req.user.role) {
    return res.status(403).json({ msg: 'Brak autoryzacji: brak roli użytkownika' });
  }

  // Sprawdź, czy rola użytkownika jest jedną z dozwolonych ról
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ msg: 'Brak autoryzacji: niewystarczające uprawnienia' });
  }

  next();
};