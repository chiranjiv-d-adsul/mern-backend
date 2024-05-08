const mongoose = require('mongoose');


const schemaData = mongoose.Schema({
  name: String,
  course: String,
  date: String,
 drivelink: String,


},{
  timestamps: true
});

const modelData = mongoose.model('user', schemaData);



module.exports = modelData;