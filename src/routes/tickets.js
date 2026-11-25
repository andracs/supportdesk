import { Router } from 'express';
import { Ticket } from '../models/ticket.js';
import { isValidTransition, isStatus } from '../db.js';
import { badRequest, notFound, forbidden } from '../middleware/errors.js';

const router = Router();

const isOid = (value) =>
  typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);

// GET /api/tickets – oversigt over alle sager med status og ansvarlig
router.get('/', async (req, res, next) => {
  try {
    let query = {};
    // Ekstra-funktion: filtrering, f.eks. /api/tickets?status=open
    if (req.query.status) {
      if (!isStatus(req.query.status)) throw badRequest(`Ugyldig status-filter: '${req.query.status}'`);
      query.status = req.query.status;
    }
    const tickets = await Ticket.find(query).populate('assignedTo', 'name initials').sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    next(err);
  }
});

// GET /api/tickets/:id – enkelt sag
router.get('/:id', async (req, res, next) => {
  try {
    if (!isOid(req.params.id)) throw notFound('Supportsagen findes ikke.');
    const ticket = await Ticket.findById(req.params.id).populate('assignedTo', 'name initials');
    if (!ticket) throw notFound('Supportsagen findes ikke.');
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

// POST /api/tickets – opret ny sag (titel er påkrævet)
router.post('/', async (req, res, next) => {
  try {
    const { title, description, category } = req.body ?? {};
    if (!title || !String(title).trim()) throw badRequest('Titel er påkrævet for at oprette en supportsag.');
    const ticket = await Ticket.create({
      title: String(title).trim(),
      description: String(description ?? '').trim(),
      category: category || 'It-support',
    });
    res.status(201).json(ticket);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/tickets/:id/status
 * Body: { status, employeeId }
 *
 * Kun sagens ansvarlige medarbejder må ændre status, og kun via
 * det gyldne forløb: open -> in_progress -> closed.
 * Ændringen er atomisk: betingelsen "nuværende status" er med i
 * selve update-kaldet, så samtidige/opdaterede kald ikke kan
 * springe trin over eller overskrive hinanden.
 */
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status: newStatus, employeeId } = req.body ?? {};

    if (!isOid(req.params.id)) throw notFound('Supportsagen findes ikke.');
    if (!newStatus) throw badRequest('Ny status (status) skal angives.');
    if (typeof newStatus !== 'string' || !isStatus(newStatus)) {
      throw badRequest(`'${newStatus}' er ikke en gyldig status. Gyldige værdier: open, in_progress, closed.`);
    }
    if (!employeeId || !isOid(employeeId)) {
      throw badRequest('employeeId skal angives, så kun den ansvarlige medarbejder kan ændre status.');
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) throw notFound('Supportsagen findes ikke.');

    if (!ticket.assignedTo) {
      throw badRequest('Sagen er ikke overtaget endnu – kun den ansvarlige medarbejder kan ændre status.');
    }
    if (String(ticket.assignedTo) !== String(employeeId)) {
      throw forbidden('Kun den medarbejder, der har ansvaret for sagen, må ændre dens status.');
    }
    if (newStatus === ticket.status) {
      throw badRequest(`Sagen har allerede status '${newStatus}'.`);
    }
    if (!isValidTransition(ticket.status, newStatus)) {
      throw badRequest(`Ugyldig statusændring: '${ticket.status}' -> '${newStatus}'. Forløbet er open -> in_progress -> closed.`);
    }

    // Atomisk opdatering, der stadig garanterer det gyldne forløb
    const updated = await Ticket.findOneAndUpdate(
      { _id: ticket._id, status: ticket.status, assignedTo: employeeId },
      { $set: { status: newStatus } },
      { new: true }
    );
    if (!updated) {
      throw badRequest(`Sagen kunne ikke opdateres (nuværende status: '${ticket.status}').`);
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export const ticketsRouter = router;
