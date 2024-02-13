const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Function to create a new pool based on the connection string
const createPool = (connectionString) => {
  return new Pool({
    connectionString: connectionString,
    ssl: process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: true } // In production, enforce valid SSL certificates
      : { rejectUnauthorized: false } // In development, accept self-signed certificates
  });
};

// Create pools for both databases
const mainPool = createPool(process.env.DATABASE_URL);
const sharedPool = createPool(process.env.SHARED_DATABASE_URL);

// Test the connection for the main database
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
} else {
  mainPool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('Error connecting to the main database:', err.stack);
    } else {
      console.log('Connected to main database:', process.env.DATABASE_URL);
    }
  });
}

// Test the connection for the shared database
if (!process.env.SHARED_DATABASE_URL) {
  console.error('SHARED_DATABASE_URL not set');
} else {
  sharedPool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('Error connecting to the shared database:', err.stack);
    } else {
      console.log('Connected to shared database:', process.env.SHARED_DATABASE_URL);
    }
  });
}

// Export both pools
module.exports = { mainPool, sharedPool };