const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const userRoutes = require('./src/routes/userRoutes');
const vendorRoutes = require('./src/routes/vendorRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const leadUpdates = require('./src/routes/leadUpdates');
const duplicateLeadRoutes = require('./src/routes/duplicateLeadRoutes')
const cors = require('cors');

dotenv.config();
const app = express();

app.use(express.json());
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

app.use(cors()); // Allow CORS from anywhere

app.use('/api/leads', duplicateLeadRoutes)
app.use('/api/users', userRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/update', leadUpdates);

const PORT = process.env.PORT || 4000;
app.listen(PORT, console.log(`Server running on port ${PORT}`));