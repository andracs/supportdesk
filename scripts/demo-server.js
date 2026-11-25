// Demonstration af krav 3: To (eller flere) medarbejdere forsøger at
// overtage DEN SAMME ledige sag på samme tid – kun én må vinde.
//
// Kør med: npm run demo:concurrency
// Tilføj --serve for at lade serveren køre bagefter (åbn http://localhost:3000).
// Bruger MONGO_URI hvis den er sat; ellers startes en MongoDB i hukommelsen.

import app from '../src/app.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { seedCollection } from '../src/seed.js';
import { Employee, Ticket } from '../src/models/index.js';

const PORT = process.env.PORT || 3000;

async function startMongoIfNeeded() {
  if (!process.env.MONGO_URI) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongod.getUri('supportdesk_demo');
    console.log('(Ingen MONGO_URI – bruger MongoDB i hukommelsen)');
  }
}

async function fireConcurrentClaims() {
  const employees = await Employee.find();
  const ticket = await Ticket.findOne({ assignedTo: null, status: 'open' });
  if (!ticket) throw new Error('Ingen ledig sag at demonstrere med (kør seed igen).');

  console.log(`\n=== Simultan overtagelse af sagen "${ticket.title}" (id ${ticket._id}) ===`);
  console.log('Ida, Noah og Sofia rammer alle sagens POST /api/assignments på præcis samme tid:\n');

  const base = `http://localhost:${PORT}`;
  const attempts = employees.map((emp) =>
    fetch(`${base}/api/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId: ticket._id, employeeId: emp._id }),
    })
      .then(async (res) => ({ emp, res, body: await res.json() }))
  );

  const results = await Promise.all(attempts);
  for (const { emp, res, body } of results) {
    const ok = res.status === 201;
    console.log(
      `${emp.name.padEnd(15)} HTTP ${res.status} ${ok ? '✓ FIK SAGEN' : '✗ AFVIST: ' + body.error}`
    );
  }

  const finalTicket = await Ticket.findById(ticket._id).populate('assignedTo');
  const winners = results.filter((r) => r.res.status === 201);
  console.log(`\nResultat i databasen: ${finalTicket.assignedTo.name} har ansvaret.`);
  console.log(
    winners.length === 1
      ? '✔ Præcis én medarbejder fik ansvaret – krav 3 er opfyldt.\n'
      : '✘ FEJL: mere end én overtagelse gennemførtes!\n'
  );
  return winners.length === 1;
}

const server = await (async () => {
  await startMongoIfNeeded();
  await connectDb(process.env.MONGO_URI);
  await seedCollection();
  return app.listen(PORT);
})();

console.log(`SupportDesk kører på http://localhost:${PORT} (frontend) og ${PORT}/api (API)`);

const okay = await fireConcurrentClaims();

if (process.argv.includes('--serve')) {
  console.log('Serveren kører videre (Ctrl+C for at lukke).');
} else {
  server.close();
  await disconnectDb();
  process.exit(okay ? 0 : 1);
}
