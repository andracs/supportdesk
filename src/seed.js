// Fylder databasen med testdata: medarbejdere og mindst tre supportsager.
// Kør: npm run seed   (bruger MONGO_URI eller localhost:27017/supportdesk)
import { connectDb, disconnectDb } from './db.js';
import { Employee } from './models/employee.js';
import { Ticket } from './models/ticket.js';
import { Assignment } from './models/assignment.js';

const EMPLOYEES = [
  { name: 'Ida Jensen', initials: 'IJ' },
  { name: 'Noah Petersen', initials: 'NP' },
  { name: 'Sofia Ahmed', initials: 'SA' },
];

const TICKETS = [
  {
    title: 'Ingen adgang til campus-WiFi',
    description: 'Studerende kan ikke logge på campus-WiFi efter opdateringen. Fejler med "netværk ikke fundet" i bygning C.',
    category: 'Netværk',
  },
  {
    title: 'Printer på biblioteket fejler',
    description: 'Printeren i bibliotekets gruppeerum udskriver kun halve sider.',
    category: 'Udstyr',
  },
  {
    title: 'Kan ikke indgive opgave i Studynet',
    description: 'Upload af opgave i Studynet fejler med fejlkode 500 ved filer over 10 MB.',
    category: 'Systemadgang',
  },
  {
    title: 'Projektor i lokale 2.14 viser intet signal',
    description: 'HDMI-signalet fra lærer-pc bliver ikke vist på projektoren.',
    category: 'Udstyr',
  },
];

export async function seedCollection() {
  await Promise.all([Employee.deleteMany({}), Ticket.deleteMany({}), Assignment.deleteMany({})]);
  await Employee.insertMany(EMPLOYEES);
  const tickets = await Ticket.insertMany(TICKETS);
  return { employees: await Employee.find(), tickets };
}

// Fylder kun databasen, hvis den er tom – demodata ved første opstart
export async function seedIfEmpty() {
  const ticketCount = await Ticket.countDocuments();
  if (ticketCount === 0) {
    const { tickets } = await seedCollection();
    console.log(`Database var tom – demodata indsat: ${tickets.length} sager.`);
  }
}

// Tillad direkte kørsel: `node src/seed.js`
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  await connectDb();
  const { employees, tickets } = await seedCollection();
  console.log(`Seed gennemført: ${employees.length} medarbejdere, ${tickets.length} sager.`);
  await disconnectDb();
}
