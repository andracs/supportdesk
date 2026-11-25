import app from './app.js';
import { ensureConnected, disconnectDb } from './db.js';

const PORT = process.env.PORT || 3000;

ensureConnected()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`SupportDesk API kører på http://localhost:${PORT}`);
    });

    // Kontrolleret nedlukning, så processen ikke hænger ved Ctrl+C
    const shutdown = async () => {
      server.close();
      await disconnectDb();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  })
  .catch((err) => {
    console.error('Kunne ikke starte SupportDesk (MongoDB-forbindelse fejlede):', err.message);
    process.exit(1);
  });
