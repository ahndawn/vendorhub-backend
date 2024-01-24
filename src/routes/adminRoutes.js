const express = require('express');
const router = express.Router();
const { mainPool, sharedPool } = require('../../db');
const { protect } = require('../middleware/authMiddleware');
const moment = require('moment'); // Import moment for date formatting

// Function to get today's date in yyyy-mm-dd format
const getTodaysDate = () => {
  return moment().format('YYYY-MM-DD');
};

// Handler to get exclusive leads for admin
const getExclusiveLeads = async (req, res) => {
    try {
        const todaysDate = getTodaysDate();
        const query = 'SELECT * FROM lead WHERE timestamp = $1';
        const { rows } = await mainPool.query(query, [todaysDate]);
        res.json(rows);
    } catch (error) {
        console.error("Error fetching exclusive leads:", error);
        res.status(500).json({ message: 'Server error occurred while fetching exclusive leads', error: error.toString() });
    }
};

// Handler to get shared leads for admin
const getSharedLeads = async (req, res) => {
    try {
        const todaysDate = getTodaysDate();
        const query = 'SELECT * FROM lead WHERE timestamp = $1';
        const { rows } = await sharedPool.query(query, [todaysDate]);
        res.json(rows);
    } catch (error) {
        console.error("Error fetching shared leads:", error);
        res.status(500).json({ message: 'Server error occurred while fetching shared leads', error: error.toString() });
    }
};

// Handler to get combined leads for admin
const getCombinedLeads = async (req, res) => {
    try {
        const todaysDate = getTodaysDate();
        const exclusiveQuery = 'SELECT * FROM lead WHERE timestamp = $1';
        const sharedQuery = 'SELECT * FROM lead WHERE timestamp = $1';

        // Fetch data from both databases
        const exclusiveLeads = await mainPool.query(exclusiveQuery, [todaysDate]);
        const sharedLeads = await sharedPool.query(sharedQuery, [todaysDate]);

        // Combine the results
        const combinedLeads = exclusiveLeads.rows.concat(sharedLeads.rows);
        res.json(combinedLeads);
    } catch (error) {
        console.error("Error fetching combined leads:", error);
        res.status(500).json({ message: 'Server error occurred while fetching combined leads', error: error.toString() });
    }
};

// Handler to get all vendors
const getVendors = async (req, res) => {
    try {
        // Query to get distinct labels from both databases
        const exclusiveVendorsQuery = 'SELECT DISTINCT label FROM lead';
        const sharedVendorsQuery = 'SELECT DISTINCT label FROM lead';

        // Fetch data from both databases
        const exclusiveVendorsResult = await mainPool.query(exclusiveVendorsQuery);
        const sharedVendorsResult = await sharedPool.query(sharedVendorsQuery);

        // Combine and deduplicate the results
        const exclusiveVendors = exclusiveVendorsResult.rows.map(row => row.label);
        const sharedVendors = sharedVendorsResult.rows.map(row => row.label);
        const allVendors = [...new Set([...exclusiveVendors, ...sharedVendors])];

        res.json(allVendors);
    } catch (error) {
        console.error("Error fetching vendors:", error);
        res.status(500).json({ message: 'Server error occurred while fetching vendors', error: error.toString() });
    }
};

router.get('/vendors', protect, getVendors);
router.get('/exclusive-leads', protect, getExclusiveLeads);
router.get('/shared-leads', protect, getSharedLeads);
router.get('/combined-leads', protect, getCombinedLeads);

module.exports = router;