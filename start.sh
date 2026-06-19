#!/bin/bash
# Script di avvio — Prenotazioni Sale Riunioni

echo ""
echo "🏢 Prenotazioni Sale Riunioni"
echo "────────────────────────────────"

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js non trovato. Installalo da https://nodejs.org"
  exit 1
fi

# Install dependencies if missing
if [ ! -d "node_modules" ]; then
  echo "📦 Installazione dipendenze..."
  npm install
  echo "✅ Dipendenze installate"
fi

echo ""
echo "🚀 Avvio del server..."
echo "   Apri il browser su: http://localhost:3000"
echo "   Admin:              http://localhost:3000/admin.html"
echo "   Credenziali admin:  admin@example.com / admin123"
echo ""
echo "   Premi Ctrl+C per fermare"
echo "────────────────────────────────"
echo ""

node --experimental-sqlite server.js
