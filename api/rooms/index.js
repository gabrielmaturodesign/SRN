const { supabaseAdmin, requireAuth, requireAdmin, setCors } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — restituisce le sale attive (qualsiasi utente autenticato)
  if (req.method === 'GET') {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { data, error } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('active', true)
      .order('id', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // POST — crea nuova sala (solo admin)
  if (req.method === 'POST') {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { name, capacity, color, description } = req.body;
    if (!name || !capacity) {
      return res.status(400).json({ error: 'Nome e capienza sono obbligatori' });
    }

    const { data, error } = await supabaseAdmin
      .from('rooms')
      .insert({ name, capacity: parseInt(capacity), color: color || '#1447e6', description: description || null })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  return res.status(405).json({ error: 'Metodo non consentito' });
};
