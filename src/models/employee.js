import mongoose from 'mongoose';

// Medarbejder i IT-support (f.eks. Ida og Noah fra casen)
const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Navn er påkrævet'], trim: true },
    initials: { type: String, uppercase: true, trim: true },
  },
  { timestamps: true }
);

export const Employee = mongoose.models.Employee ?? mongoose.model('Employee', employeeSchema);
