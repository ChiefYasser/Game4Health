import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  // Player info
  playerName: { type: String, default: 'Anonymous' },

  // Session lifecycle: created → calibrating → active → completed
  status: {
    type: String,
    enum: ['created', 'calibrating', 'active', 'completed'],
    default: 'created',
  },

  // Baseline heart rate computed during calibration phase
  baselineHR: { type: Number, default: null },

  // Latest computed stress score (0-100)
  currentStress: { type: Number, default: 0 },

  // Game difficulty level (can be adjusted based on stress)
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },

  // Timestamps
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },

  // Summary stats filled at session end
  summary: {
    avgHeartRate: { type: Number, default: null },
    maxHeartRate: { type: Number, default: null },
    minHeartRate: { type: Number, default: null },
    avgStress: { type: Number, default: null },
    maxStress: { type: Number, default: null },
    totalReadings: { type: Number, default: 0 },
    totalGameEvents: { type: Number, default: 0 },
    durationSeconds: { type: Number, default: null },
  },

  // AI-generated insight from Gemini
  aiInsight: { type: String, default: null },
}, {
  timestamps: true,
});

export default mongoose.model('Session', sessionSchema);
