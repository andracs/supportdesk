// Udvidede tests: overstiger minimum fra product owner og dækker
// kravene om overtagelse, samtidighed, statusflow og fejlhåndtering.
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { ensureConnected } from '../src/db.js';
import { seedCollection } from '../src/seed.js';
import { Employee } from '../src/models/employee.js';
import { Ticket } from '../src/models/ticket.js';

let ida, noah, sofia;
let freeTicket, otherTicket, takenTicket;

async function getFreeTicket() {
  const tickets = await Ticket.find({ assignedTo: null, status: 'open' });
  return tickets[0];
}

beforeAll(async () => {
  await ensureConnected();
  await seedCollection();
  const employees = await Employee.find();
  ida = employees.find((e) => e.name.startsWith('Ida'));
  noah = employees.find((e) => e.name.startsWith('Noah'));
  sofia = employees.find((e) => e.name.startsWith('Sofia'));

  // En sag forvarer vi som "allerede overtaget" til 409-tests
  const tickets = await Ticket.find({ status: 'open' });
  otherTicket = tickets[0];
  takenTicket = tickets[1];
  await Ticket.findByIdAndUpdate(takenTicket._id, {
    assignedTo: ida._id,
    assignedAt: new Date(),
  });
  freeTicket = await getFreeTicket();
});

describe('Krav 1-2: oversigt og overtagelse', () => {
  it('viser sager med status og ansvarlig', async () => {
    const res = await request(app).get('/api/tickets');
    expect(res.status).toBe(200);
    const claimed = res.body.find((t) => t._id === String(takenTicket._id));
    expect(claimed.assignedTo.name).toMatch(/Ida/);
  });

  it('gennemfører en overtagelse af en ledig sag', async () => {
    const res = await request(app)
      .post('/api/assignments')
      .send({ ticketId: freeTicket._id, employeeId: noah._id });
    expect(res.status).toBe(201);
    expect(res.body.ticket.assignedTo).toBe(String(noah._id));
    expect(res.body.message).toBeTruthy();
  });

  it('afviser overtagelse af en allerede tildelt sag (409)', async () => {
    const res = await request(app)
      .post('/api/assignments')
      .send({ ticketId: takenTicket._id, employeeId: noah._id });
    expect(res.status).toBe(409);
    expect(res.body.error).toBeTruthy();
  });

  it('afviser overtagelse af en sag, der ikke findes (404)', async () => {
    const res = await request(app)
      .post('/api/assignments')
      .send({ ticketId: 'aaaaaaaaaaaaaaaaaaaaaaaa', employeeId: ida._id });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it('afviser ukendt medarbejder (400) uden at ændre data', async () => {
    const before = await Ticket.findById(freeTicket._id);
    const res = await request(app)
      .post('/api/assignments')
      .send({ ticketId: freeTicket._id, employeeId: 'bbbbbbbbbbbbbbbbbbbbbbbb' });
    expect(res.status).toBe(400);
    const after = await Ticket.findById(freeTicket._id);
    expect(String(after.assignedTo)).toBe(String(before.assignedTo));
  });
});

describe('Krav 3: to samtidige overtagelser af samme sag', () => {
  it('gennemfører kun én overtagelse, selv om Ida og Noah rammer samme sag samtidig', async () => {
    const ticket = await getFreeTicket();
    expect(ticket).toBeTruthy();

    // To (faktisk tre) parallelle requests mod samme ledige sag
    const [idaRes, noahRes, sofiaRes] = await Promise.all([
      request(app).post('/api/assignments').send({ ticketId: ticket._id, employeeId: ida._id }),
      request(app).post('/api/assignments').send({ ticketId: ticket._id, employeeId: noah._id }),
      request(app).post('/api/assignments').send({ ticketId: ticket._id, employeeId: sofia._id }),
    ]);
    const all = [idaRes, noahRes, sofiaRes];
    const winners = all.filter((r) => r.status === 201);
    const losers = all.filter((r) => r.status === 409);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(2);
    expect(losers.every((r) => r.body.error)).toBe(true);

    // Databasen har præcis én ansvarlig – og det er vinderen
    const dbTicket = await Ticket.findById(ticket._id).populate('assignedTo');
    expect(dbTicket.assignedTo._id.toString()).toBe(
      winners[0].body.ticket.assignedTo
    );
  });
});

// Hjælper til krav 4: lav en frisk sag og giv den direkte til Ida i DB'en
async function makeTicketAssignedToIda() {
  const res = await request(app).post('/api/tickets').send({
    title: 'Test-sag til statusflow',
    description: 'Oprettet af test',
  });
  const ticket = await Ticket.findByIdAndUpdate(
    res.body._id,
    { assignedTo: ida._id, assignedAt: new Date() },
    { new: true }
  );
  return ticket;
}

describe('Krav 4: status og sagsforløb', () => {
  it('afviser ugyldig statusværdi (400)', async () => {
    const ticket = await makeTicketAssignedToIda();
    const res = await request(app)
      .patch(`/api/tickets/${ticket._id}/status`)
      .send({ status: 'på pause', employeeId: ida._id });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('gennemfører forløbet åben → under behandling → afsluttet', async () => {
    const ticket = await makeTicketAssignedToIda();

    const start = await request(app)
      .patch(`/api/tickets/${ticket._id}/status`)
      .send({ status: 'in_progress', employeeId: ida._id });
    expect(start.status).toBe(200);
    expect(start.body.status).toBe('in_progress');

    const done = await request(app)
      .patch(`/api/tickets/${ticket._id}/status`)
      .send({ status: 'closed', employeeId: ida._id });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe('closed');

    // En afsluttet sag er IKKE åben: den findes ikke under ?status=open
    const open = await request(app).get('/api/tickets?status=open');
    expect(open.body.find((t) => t._id === String(ticket._id))).toBeUndefined();
  });

  it('afviser statusspring (åben → afsluttet) og ændring af lukket sag', async () => {
    const ticket = await Ticket.findOne({ status: 'closed' });
    const res = await request(app)
      .patch(`/api/tickets/${ticket._id}/status`)
      .send({ status: 'open', employeeId: ida._id });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('afviser, at en ANDEN medarbejder ændrer status (403)', async () => {
    const ticket = await makeTicketAssignedToIda();
    const res = await request(app)
      .patch(`/api/tickets/${ticket._id}/status`)
      .send({ status: 'in_progress', employeeId: noah._id });
    expect(res.status).toBe(403);
  });

  it('afviser opdatering af en sag, der ikke findes (404)', async () => {
    const res = await request(app)
      .patch('/api/tickets/aaaaaaaaaaaaaaaaaaaaaaaa/status')
      .send({ status: 'in_progress', employeeId: ida._id });
    expect(res.status).toBe(404);
  });
});

describe('Krav 6: vedvarende lagring', () => {
  it('har gemt overtagelsen i assignment-journalen', async () => {
    const res = await request(app).get('/api/assignments');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].employee.name).toBeTruthy();
    expect(res.body[0].ticket.title).toBeTruthy();
  });
});
