import mongoose from 'mongoose';
import { env } from './env.js';

// Embedded appointment subdocument for patient history (read-optimized, no joins)
const appointmentSubSchema = new mongoose.Schema({
  appointmentId: { type: String, required: true },
  date: { type: String, required: true },
  doctorName: { type: String, required: true },
  doctorEmail: { type: String, required: true },
  specialty: { type: String, required: true },
  treatmentCode: { type: String, required: true },
  treatmentDescription: { type: String, required: true },
  treatmentCost: { type: Number, required: true },
  insuranceProvider: { type: String, required: true },
  coveragePercentage: { type: Number, required: true },
  amountPaid: { type: Number, required: true },
}, { _id: false });

const patientHistorySchema = new mongoose.Schema({
  patientEmail: {
    type: String,
    required: true,
    unique: true,
    match: /^\S+@\S+\.\S+$/,
  },
  patientName: { type: String, required: true },
  appointments: {
    type: [appointmentSubSchema],
    default: [],
  },
}, { timestamps: true, collection: 'patient_histories' });

// patientEmail already has unique: true above, which creates an index; no extra index needed

export const PatientHistory = mongoose.model('PatientHistory', patientHistorySchema);

export async function connectMongo() {
  try {
    await mongoose.connect(env.databaseMongoUrl);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
}
