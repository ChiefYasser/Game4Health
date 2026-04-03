import mongoose from 'mongoose';

const gameEventSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true,
  },

  // Event type sent by the game
  eventType: {
    type: String,
    required: true,
    // e.g., 'enemy_encounter', 'jump_scare', 'puzzle_start', 'puzzle_complete',
    //       'level_change', 'player_death', 'safe_zone', 'game_over'
  },

  // Additional event data from the game
  data: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Heart rate at the moment of this event (snapshot)
  heartRateAtEvent: { type: Number, default: null },

  // Stress score at the moment of this event (snapshot)
  stressAtEvent: { type: Number, default: null },

  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model('GameEvent', gameEventSchema);
