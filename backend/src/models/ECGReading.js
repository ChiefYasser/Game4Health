import mongoose from 'mongoose';

const ecgReadingSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true,
  },

  // Heart rate in BPM from the AD8232 sensor
  heartRate: { type: Number, required: true },

  // Raw analog value from the sensor (optional, for debugging)
  rawValue: { type: Number, default: null },

  // Computed stress score at this reading (0-100)
  stressScore: { type: Number, default: 0 },

  // Phase when this reading was taken
  phase: {
    type: String,
    enum: ['calibration', 'active'],
    default: 'active',
  },

  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model('ECGReading', ecgReadingSchema);
