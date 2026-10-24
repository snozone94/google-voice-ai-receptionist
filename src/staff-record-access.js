export function requireStaffRecords(authenticate) {
  return async (req, res, next) => {
    res.set("Cache-Control", "no-store, private");
    res.vary("x-admin-pin");
    res.vary("x-staff-code");
    try {
      const staff = await authenticate(req);
      if (!staff?.ok) return res.status(403).json({ ok: false, error: "Sign in with your DDD staff code." });
      res.locals.staff = staff;
      next();
    } catch (error) { next(error); }
  };
}
