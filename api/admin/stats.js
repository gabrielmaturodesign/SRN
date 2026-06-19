const { supabaseAdmin, requireAdmin, setCors } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo non consentito' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const today = new Date().toISOString().slice(0, 10);

  const [usersRes, roomsRes, bookingsRes, todayRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('rooms').select('*', { count: 'exact', head: true }).eq('active', true),
    supabaseAdmin.from('bookings').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('bookings').select('*', { count: 'exact', head: true }).eq('date', today),
  ]);

  return res.status(200).json({
    totalUsers:    usersRes.count    ?? 0,
    totalRooms:    roomsRes.count    ?? 0,
    totalBookings: bookingsRes.count ?? 0,
    todayBookings: todayRes.count    ?? 0,
  });
};
