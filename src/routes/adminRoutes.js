const express = require('express');
const router = express.Router();
const { mainPool, sharedPool } = require('../services/db');
const { protect } = require('../middleware/authMiddleware');
const LeadStatus = require('../models/LeadStatus');
const readFromGoogleSheet = require('../services/googleSheetsClient');
const moment = require('moment');

// Function to get today's date in yyyy-mm-dd format
const getTodaysDate = () => {
  return moment().format('YYYY-MM-DD');
};

const getExclusiveLeads = async (req, res) => {
    try {
        const todaysDate = getTodaysDate();
        const query = 'SELECT * FROM lead WHERE timestamp = $1';
        const { rows } = await mainPool.query(query, [todaysDate]);

        // Fetch booked lead IDs from MongoDB
        const bookedLeads = await LeadStatus.find({ booked: true });
        const bookedLeadIds = new Set(bookedLeads.map(lead => lead.leadId));

        // Add isBooked status to each lead
        const leadsWithBookedStatus = rows.map(lead => ({
            ...lead,
            isBooked: bookedLeadIds.has(lead.id)
        }));

        res.json(leadsWithBookedStatus);
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


const updateLead = async (req, res) => {
    try {
        const { leadId } = req.params;
        const {
            timestamp, label, firstname, email, phone1, ozip, dzip, dcity, dstate, movesize, 
            movedte, conversion, validation, notes, sent_to_gronat, sent_to_sheets, moverref, ocity, ostate,
            isBooked // Include isBooked here
        } = req.body;

        const updateQuery = `
            UPDATE lead 
            SET 
                timestamp = $1, label = $2, firstname = $3, email = $4, phone1 = $5, 
                ozip = $6, dzip = $7, dcity = $8, dstate = $9, movesize = $10, 
                movedte = $11, conversion = $12, validation = $13, notes = $14, 
                sent_to_gronat = $15, sent_to_sheets = $16, moverref = $17, ocity = $18, ostate = $19
            WHERE id = $20
        `;
        await mainPool.query(updateQuery, [
            timestamp, label, firstname, email, phone1, ozip, dzip, dcity, dstate, movesize, 
            movedte, conversion, validation, notes, sent_to_gronat, sent_to_sheets, moverref, ocity, ostate, leadId
        ]);

        // Log the received isBooked value for debugging
        console.log(`Updating leadId: ${leadId}, isBooked: ${isBooked}`);

        // Update MongoDB booked status if isBooked is provided
        if (typeof isBooked !== 'undefined') {
            await LeadStatus.findOneAndUpdate(
                { leadId: leadId },
                { booked: isBooked },
                { new: true, upsert: true }
            );
        }

        res.json({ message: 'Lead updated successfully' });
    } catch (error) {
        console.error("Error updating lead:", error);
        res.status(500).json({ message: 'Server error occurred while updating lead', error: error.toString() });
    }
};


const updateBookedStatus = async (req, res) => {
    try {
        // Read data from Google Sheet starting at A2
        const sheetData = await readFromGoogleSheet();

        // Iterate over each row from the sheet
        for (const [note] of sheetData) {
            // Find matching lead in PostgreSQL
            const { rows } = await mainPool.query('SELECT * FROM lead WHERE notes = $1', [note]);

            // If a matching lead is found
            if (rows.length > 0) {
                const leadId = rows[0].id; // Assuming 'id' is the identifier for leads

                // Update the booked status in MongoDB
                await LeadStatus.findOneAndUpdate(
                    { leadId: leadId },
                    { booked: true },
                    { new: true, upsert: true }
                );
            }
        }

        res.json({ message: 'Booked statuses updated from Google Sheet' });
    } catch (error) {
        console.error('Error updating booked statuses:', error);
        res.status(500).json({ message: 'Error updating booked statuses', error: error.toString() });
    }
};

const getBookedLeads = async (req, res) => {
    try {
        console.log('LeadStatus model:', LeadStatus); // Log the LeadStatus model
        console.log('LeadStatus.find:', LeadStatus.find); // Log the find method of the model

        const bookedLeads = await LeadStatus.find({ booked: true });
        console.log('Booked Leads:', bookedLeads); // Log the result of the find method
        res.json(bookedLeads);
    } catch (error) {
        console.error('Error fetching booked leads:', error);
        res.status(500).json({ message: 'Error fetching booked leads', error: error.toString() });
    }
};

const vendorBookedLeads = async (req, res) => {
    const vendor = req.params.vendor;
    const bookedLeads = await LeadStatus.find({ booked: true });
    const bookedLeadIds = bookedLeads.map(lead => lead.leadId);

    // Assuming leads are stored in mainPool with a 'label' column for vendor
    const { rows } = await mainPool.query('SELECT * FROM lead WHERE id = ANY($1::int[]) AND label = $2', [bookedLeadIds, vendor]);
    res.json(rows);
};

router.get ('/booked-leads/:vendor', protect, vendorBookedLeads)
router.get('/booked-leads', protect, getBookedLeads);
router.put('/update-lead-booked-status/:leadId', protect, updateBookedStatus);
router.get('/vendors', protect, getVendors);
router.get('/exclusive-leads', protect, getExclusiveLeads);
router.get('/shared-leads', protect, getSharedLeads);
router.get('/combined-leads', protect, getCombinedLeads);
router.put('/update-lead/:leadId', protect, updateLead);

module.exports = router;