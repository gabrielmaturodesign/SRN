const { supabaseAdmin, requireAdmin, setCors } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Metodo non consentito' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const roomId = parseInt(req.query.id);
  if (isNaN(roomId)) return res.status(400).json({ error: 'ID non valido' });

  const { name, capacity, color, description, active } = req.body;
  const updates = {};
  if (name        !== undefined) updates.name        = name;
  if (capacity    !== undefined) updates.capacity    = parseInt(capacity);
  if (color       !== undefined) updates.color       = color;
  if (description !== undefined) updates.description = description;
  if (active      !== undefined) updates.active      = active;

  const { data, error } = await supabaseAdmin
    .from('rooms')
    .update(updates)
    .eq('id', roomId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data);
};
