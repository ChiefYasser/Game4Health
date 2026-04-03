import mongoose from 'mongoose';

const questionnaireSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
  },

  // Pre-session questionnaire answers
  age: { type: Number, required: true },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },

  // Self-reported pre-session state
  priorGamingExperience: {
    type: String,
    enum: ['none', 'casual', 'regular', 'hardcore'],
    default: 'casual',
  },
  currentMood: {
    type: String,
    enum: ['calm', 'neutral', 'anxious', 'stressed'],
    default: 'neutral',
  },
  phobiaLevel: {
    type: Number,  // 1-10 self-reported fear level
    min: 1,
    max: 10,
    default: 5,
  },

  // Any medical conditions worth noting
  notes: { type: String, default: '' },
}, {
  timestamps: true,
});

export default mongoose.model('Questionnaire', questionnaireSchema);
