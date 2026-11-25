import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureConnected } from './db.js';
import { ticketsRouter } from './routes/tickets.js';
import { assignmentsRouter } from './routes/assignments.js';
import { employeesRouter } from './routes/employees.js';
import { errorHandler } from './middleware/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Express-appen. Eksporteres UDEN at starte serveren,
// så Vitest/Supertest kan bruge den direkte (jvf. PO's test-kontrakt).
const app = express();

app.use(express.json());

// Sikrer DB-forbindelse (og demodata) ved første kald – fejlen sendes
// videre til fejlhåndteringen, så API'et svarer kontrolleret.
app.use('/api', async (_req, _res, next) => {
  try {
    await ensureConnected();
    next();
  } catch (err) {
    next(err);
  }
});

// Statisk frontend (brugergrænsefladen taler med API'et via fetch/HTTP)
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/tickets', ticketsRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/employees', employeesRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpointet findes ikke.' });
});

// Øverste fejlhåndtering: ingen uventet fejl må bringe serveren ned
app.use(errorHandler);

export default app;
