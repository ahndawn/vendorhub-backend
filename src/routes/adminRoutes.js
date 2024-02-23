const express = require('express');
const router = express.Router();
const { mainPool, sharedPool } = require('../services/db');
const { protect } = require('../middleware/authMiddleware');
const LeadStatus = require('../models/LeadStatus');
const moment = require('moment');

// Function to get today's date in yyyy-mm-dd format
const getTodaysDate = () => {
  return moment().format('YYYY-MM-DD');
};

const getExclusiveLeads = async (req, res) => {
    try {
        const todaysDate = getTodaysDate();
        // Fetch today's leads, excluding those with empty or null phone1
        const query = `
            SELECT * FROM lead 
            WHERE timestamp = $1 
            AND phone1 IS NOT NULL 
            AND phone1 <> ''
            ORDER BY timestamp DESC
        `;
        const { rows: todayLeads } = await mainPool.query(query, [todaysDate]);

        // Fetch invalid leads based on validation == '0' directly from SQL
        const invalidLeadsQuery = `
            SELECT id FROM lead 
            WHERE validation = '0' 
            AND phone1 IS NOT NULL 
            AND phone1 <> ''
        `;
        const { rows: invalidLeadsRows } = await mainPool.query(invalidLeadsQuery);
        const invalidLeadIds = invalidLeadsRows.map(row => row.id);

        // Fetch all relevant lead statuses from MongoDB
        const leadStatuses = await LeadStatus.find({}).lean();
        const leadStatusMap = new Map(leadStatuses.map(status => [status.leadId, status]));

        // Enhance today's leads with isDuplicate, isBooked, and invalid status
        const leadsWithStatus = todayLeads.map(lead => {
            const status = leadStatusMap.get(lead.id) || {};
            return {
                ...lead,
                isDuplicate: !!status.duplicate,
                isBooked: !!status.booked,
                invalid: invalidLeadIds.includes(lead.id) || !!status.invalid // Mark as invalid if found in invalidLeadIds or marked in MongoDB
            };
        });

        res.json(leadsWithStatus);
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

const getBookedLeads = async (req, res) => {
    try {
        // Fetch all leads marked as booked
        const bookedLeads = await LeadStatus.find({ booked: true });
        const bookedLeadIds = bookedLeads.map(lead => lead.leadId);

        // Fetch all leads that are booked, regardless of the vendor
        const { rows } = await mainPool.query('SELECT * FROM lead WHERE id = ANY($1::int[])', [bookedLeadIds]);
        
        // Add isBooked property to each lead
        const leadsWithBookedStatus = rows.map(row => ({ ...row, isBooked: bookedLeadIds.includes(row.id) }));

        res.json(leadsWithBookedStatus);
    } catch (error) {
        console.error('Error fetching booked leads:', error);
        res.status(500).json({ message: 'Error fetching booked leads', error: error.toString() });
    }
};

router.get('/booked-leads', protect, getBookedLeads);
router.get('/vendors', protect, getVendors);
router.get('/exclusive-leads', protect, getExclusiveLeads);
router.get('/shared-leads', protect, getSharedLeads);
router.get('/combined-leads', protect, getCombinedLeads);

module.exports = router;