// Hjælpescript til skærmbilleder: starter SupportDesk med en MongoDB i
// hukommelsen, fylder demodata og sætter sagerne i tre forskellige faser:
// WiFi-sagen (Ida, under behandling), printer-sagen (Noah, åben + tildelt)
// og Studynet-sagen (Sofia, afsluttet). Bruges til dokumentation.
import app from '../src/app.js';
import { ensureConnected } from '../src/db.js';
import { seedCollection } from '../src/seed.js';
import { Employee, Ticket } from '../src/models/index.js';

const PORT = process.env.PORT || 3211;

await ensureConnected();
await seedCollection();

const employees = await Employee.find();
const byName = (prefix) => employees.find((e) => e.name.startsWith(prefix));
const ida = byName('Ida');
const noah = byName('Noah');
const sofia = byName('Sofia');

const tickets = await Ticket.find();
const byTitle = (part) => tickets.find((t) => t.title.includes(part));

// Ida: campus-WiFi-sagen, under behandling
await Ticket.findByIdAndUpdate(byTitle('campus-WiFi')._id, {
  assignedTo: ida._id,
  assignedAt: new Date(),
  status: 'in_progress',
});

// Noah: printer-sagen, tildelt men stadig åben
await Ticket.findByIdAndUpdate(byTitle('Printer')._id, {
  assignedTo: noah._id,
  assignedAt: new Date(),
});

// Sofia: Studynet-sagen, afsluttet
await Ticket.findByIdAndUpdate(byTitle('Studynet')._id, {
  assignedTo: sofia._id,
  assignedAt: new Date(),
  status: 'closed',
});

app.listen(PORT, () => {
  console.log(`Screenshot-tilstand klar på http://localhost:${PORT}`);
});
