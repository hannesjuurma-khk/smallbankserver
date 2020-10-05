const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const transferSchema = new Schema({
  accountFrom: {
    type: String,
    required: true,
    min: 12,
    max: 12
  },
  accountTo: {
    type: String,
    required: true,
    min: 12,
    max: 12
  },
  amount: {
    type: Number,
    required: true,
    default: 1,
  }
})

const Transfer = mongoose.model('transfers', transferSchema);
module.exports = Transfer;