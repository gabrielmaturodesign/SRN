const { supabaseAdmin, requireAuth, setCors } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await requireAuth(req, res);
  if (!user) return;

  // GET /api/bookings — tutte le prenotazioni (filtrabili per data e sala)
  if (req.method === 'GET') {
    const { date_from, date_to, room_id } = req.query;

    let query = supabaseAdmin
      .from('booking_details')
      .select('*')
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    if (date_from) query = query.gte('date', date_from);
    if (date_to)   query = query.lte('date', date_to);
    if (room_id)   query = query.eq('room_id', parseInt(room_id));

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // POST /api/bookings — crea nuova prenotazione
  if (req.method === 'POST') {
    const { room_id, title, date, start_time, end_time, notes } = req.body;
    if (!room_id || !title || !date || !start_time || !end_time) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti' });
    }
    if (start_time >= end_time) {
      return res.status(400).json({ error: 'L\'ora di fine deve essere successiva all\'inizio' });
    }

    // Controllo sovrapposizione
    const { data: overlap } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('room_id', room_id)
      .eq('date', date)
      .lt('start_time', end_time)
      .gt('end_time', start_time);

    if (overlap && overlap.length > 0) {
      return res.status(409).json({ error: 'La sala è già prenotata in questo orario' });
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .insert({ room_id, user_id: user.id, title, date, start_time, end_time, notes: notes || null })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  return res.status(405).json({ error: 'Metodo non consentito' });
};
