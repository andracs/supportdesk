import { Router } from 'express';
import { Ticket } from '../models/ticket.js';
import { Assignment } from '../models/assignment.js';
import { Employee } from '../models/employee.js';
import { badRequest, notFound, conflict } from '../middleware/errors.js';

const router = Router();

/**
 * POST /api/assignments
 * Body: { ticketId, employeeId }
 *
 * KRITISK: Overtagelsen sker med ÉT atomisk databasekald:
 * findOneAndUpdate med betingelsen "assignedTo er stadig null".
 * Mongo garanterer, at kun ét af flere samtidige kald kan matche
 * og ændre dokumentet – så kun én medarbejder kan få sagen.
 */
router.post('/', async (req, res, next) => {
  try {
    const { ticketId, employeeId } = req.body ?? {};

    // Krav 5: ugyldige/ manglende oplysninger afvises med forståelig fejl
    if (!ticketId || !employeeId) {
      throw badRequest('Både ticketId og employeeId skal angives for at overtage en sag.');
    }

    // Find medarbejderen (avvis ukendte id'er – også forkerte formater)
    const employee = await Employee.findById(employeeId).catch(() => null);
    if (!employee) throw badRequest('Medarbejderen findes ikke. Kan ikke overtage sagen.');

    // Find sagen, så vi kan give en præcis fejlbesked
    const ticket = await Ticket.findById(ticketId).catch(() => null);
    if (!ticket) throw notFound('Supportsagen findes ikke.');
    if (ticket.status === 'closed') throw badRequest('Sagen er afsluttet og kan ikke overtages.');

    // Atomisk overtagelse: matcher KUN hvis assignedTo stadig er null.
    // Selv hvis Ida og Noah sender kaldet samtidig, vinder netop ét kald.
    // Status ændres ikke her – den ansvarlige medarbejder flytter selv
    // sagen videre (åben -> under behandling -> afsluttet), se tickets-ruten.
    const claimed = await Ticket.findOneAndUpdate(
      { _id: ticket._id, assignedTo: null },
      { $set: { assignedTo: employee._id, assignedAt: new Date() } },
      { new: true }
    );

    if (!claimed) {
      // En anden vandt kapetlov
      throw conflict(`Sagen er allerede overtaget af en anden medarbejder.`);
    }

    // Registrér den gennemførte overtagelse i journalen
    const assignment = await Assignment.create({
      ticket: claimed._id,
      employee: employee._id,
      takenAt: claimed.assignedAt,
    });

    res.status(201).json({
      message: `Sagen "${claimed.title}" er overtaget af ${employee.name}.`,
      ticket: claimed,
      assignment,
    });
  } catch (err) {
    next(err);
  }
});

// Oversigt over gennemførte overtagelser (hvem arbejder på hvad)
router.get('/', async (_req, res, next) => {
  try {
    const assignments = await Assignment.find()
      .populate('employee', 'name initials')
      .populate('ticket', 'title status')
      .sort({ takenAt: -1 });
    res.json(assignments);
  } catch (err) {
    next(err);
  }
});

export const assignmentsRouter = router;
