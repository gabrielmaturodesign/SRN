const { supabaseAdmin, requireAdmin, setCors } = require('../../../lib/supabase');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo non consentito' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, role, created_at')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Aggiungi email recuperando da auth.users via admin API
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
  const emailMap = Object.fromEntries(authUsers.users.map(u => [u.id, u.email]));

  const users = data.map(p => ({ ...p, email: emailMap[p.id] || '—' }));
  return res.status(200).json(users);
};
