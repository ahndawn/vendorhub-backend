const express = require('express');
const router = express.Router();
const { mainPool, sharedPool } = require('../services/db');
const { protect } = require('../middleware/authMiddleware');
const LeadStatus = require('../models/LeadStatus');

const getAllDuplicateLeads = async (req, res) => {
    // Query to find duplicates based on your criteria, e.g., same email or phone
    const duplicateQuery = `
        SELECT id, label, firstname, email, phone, COUNT(*)
        FROM lead
        GROUP BY id, label, firstname, email, phone
        HAVING COUNT(*) > 1
    `;

    try {
        // Step 1: Identify duplicates
        const { rows: duplicateRows } = await mainPool.query(duplicateQuery);
        const duplicateLeadIds = duplicateRows.map(row => row.id);

        // Step 2: Fetch complete lead details for duplicates
        const leadsDetailsQuery = 'SELECT * FROM lead WHERE id = ANY($1::int[])';
        const { rows: leadsDetails } = await mainPool.query(leadsDetailsQuery, [duplicateLeadIds]);

        // Step 3: Mark identified duplicates in LeadStatus, considering user actions
        await Promise.all(leadsDetails.map(async (lead) => {
            const existingStatus = await LeadStatus.findOne({ leadId: lead.id });
            if (!existingStatus || existingStatus.userMarkedDuplicate !== false) {
                // Mark as duplicate if not already marked by user as non-duplicate
                await LeadStatus.updateOne(
                    { leadId: lead.id },
                    { $set: { duplicate: true } },
                    { upsert: true }
                );
            }
        }));

        // Optionally, return the detailed leads marked as duplicates
        res.json({ duplicates: leadsDetails });
    } catch (error) {
        console.error('Error fetching and marking duplicate leads:', error);
        res.status(500).json({ message: 'Error fetching and marking duplicate leads', error: error.toString() });
    }
};

// Route to mark a lead as duplicate/non-duplicate
const markLeadDuplicate = async (req, res) => {
    const { leadId } = req.params;
    const { isDuplicate } = req.body; // Boolean indicating whether the lead is marked as duplicate or not
  
    try {
      const lead = await LeadStatus.findByIdAndUpdate(leadId, {
        $set: {
          userMarkedDuplicate: isDuplicate,
          duplicate: isDuplicate // Optionally synchronize the duplicate field based on user action
        }
      }, { new: true });
  
      res.json(lead);
    } catch (error) {
      console.error('Error updating lead duplicate status:', error);
      res.status(500).json({ message: 'Error updating lead duplicate status', error: error.toString() });
    }
  };

  router.put('/leads/:leadId/mark-duplicate', protect, markLeadDuplicate)
  router.put('/leads/get-duplicates', protect, getAllDuplicateLeads)