import mongoose from 'mongoose';

// Journal over gennemførte overtagelser – gør det muligt at se,
// hvem der har ansvaret for hvad, og hvornår sagen blev overtaget.
const assignmentSchema = new mongoose.Schema(
  {
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    takenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Assignment = mongoose.models.Assignment ?? mongoose.model('Assignment', assignmentSchema);
