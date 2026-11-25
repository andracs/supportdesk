import { Router } from 'express';
import { Employee } from '../models/employee.js';
import { badRequest } from '../middleware/errors.js';

const router = Router();

// GET /api/employees – listen over supportmedarbejdere (til frontend-dropdown)
router.get('/', async (_req, res, next) => {
  try {
    const employees = await Employee.find().sort({ name: 1 });
    res.json(employees);
  } catch (err) {
    next(err);
  }
});

// POST /api/employees – tilføj medarbejder
router.post('/', async (req, res, next) => {
  try {
    const { name, initials } = req.body ?? {};
    if (!name || !String(name).trim()) throw badRequest('Navn er påkrævet.');
    const employee = await Employee.create({ name: String(name).trim(), initials: initials || '' });
    res.status(201).json(employee);
  } catch (err) {
    next(err);
  }
});

export const employeesRouter = router;
