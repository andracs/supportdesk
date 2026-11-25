import mongoose from 'mongoose';

//Ticket: én supportsag. Status: open | in_progress | closed (dansk visning sker i frontend)
const ticketSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Titel er påkrævet'], trim: true },
    description: { type: String, default: '' },
    category: { type: String, default: 'It-support' },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'closed'],
      default: 'open',
    },
    // Sagens eneste ansvarlige medarbejder. null = sagen er ledig.
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    assignedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Ticket = mongoose.models.Ticket ?? mongoose.model('Ticket', ticketSchema);
