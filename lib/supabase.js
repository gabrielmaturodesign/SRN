const { createClient } = require('@supabase/supabase-js');

// Client con SERVICE_ROLE — bypassa RLS, solo lato server
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Verifica il token JWT e restituisce l'utente, oppure risponde 401
async function requireAuth(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Non autorizzato' });
    return null;
  }
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: 'Token non valido' });
    return null;
  }
  return user;
}

// Verifica che l'utente sia admin, altrimenti risponde 403
async function requireAdmin(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    res.status(403).json({ error: 'Accesso riservato agli admin' });
    return null;
  }
  return { ...user, role: 'admin', profile };
}

// Aggiunge header CORS standard
function setCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

module.exports = { supabaseAdmin, requireAuth, requireAdmin, setCors };
