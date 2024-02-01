const mongoose = require('mongoose');

const leadStatusSchema = new mongoose.Schema({
  leadId: {
    type: Number,
    required: true,
    unique: true
  },
  booked: {
    type: Boolean,
    default: false
  }
  // add more attributes here 
});

const LeadStatus = mongoose.model('LeadStatus', leadStatusSchema);

module.exports = LeadStatus;