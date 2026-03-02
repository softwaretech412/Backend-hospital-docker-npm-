import express from 'express';
import { env } from './config/env.js';

import simulacroRoutes from './routes/simulacro.js';
import doctorsRoutes from './routes/doctors.js';
import reportsRoutes from './routes/reports.js';
import patientsRoutes from './routes/patients.js';
import historiesRoutes from './routes/histories.js';

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'SaludPlus API running' });
});

app.use('/api/simulacro', simulacroRoutes);
app.use('/api/doctors', doctorsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/histories', historiesRoutes);

export default app;
export { env };
