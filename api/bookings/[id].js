const { supabaseAdmin, requireAuth, setCors } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Metodo non consentito' });

  const user = await requireAuth(req, res);
  if (!user) return;

  const bookingId = parseInt(req.query.id);
  if (isNaN(bookingId)) return res.status(400).json({ error: 'ID non valido' });

  // Recupera la prenotazione
  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('user_id')
    .eq('id', bookingId)
    .single();

  if (!booking) return res.status(404).json({ error: 'Prenotazione non trovata' });

  // Solo il proprietario o un admin può eliminare
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isOwner = booking.user_id === user.id;
  const isAdmin = profile?.role === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'Non autorizzato a eliminare questa prenotazione' });
  }

  const { error } = await supabaseAdmin
    .from('bookings')
    .delete()
    .eq('id', bookingId);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
};
