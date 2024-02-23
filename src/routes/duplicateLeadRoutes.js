const express = require('express');
const schedule = require('node-schedule');
const router = express.Router();
const { mainPool, sharedPool } = require('../services/db');
const { protect } = require('../middleware/authMiddleware');
const LeadStatus = require('../models/LeadStatus');

const identifyAndMarkDuplicates = async (vendorLabel = null) => {
  let duplicateQuery = `
    SELECT phone1, label, ARRAY_AGG(id) AS ids
    FROM lead
    GROUP BY phone1, label
    HAVING COUNT(*) > 1
  `;

  // If a specific vendor label is provided, adjust the query to filter by that label
  if (vendorLabel) {
    duplicateQuery += ` AND label = '${vendorLabel}'`;
  }

  try {
    const { rows: duplicateRows } = await mainPool.query(duplicateQuery);

    for (const row of duplicateRows) {
      for (const id of row.ids) {
        const existingStatus = await LeadStatus.findOne({ leadId: id });
        if (!existingStatus || existingStatus.userMarkedDuplicate !== true) {
          await LeadStatus.updateOne(
            { leadId: id },
            { $set: { duplicate: true } },
            { upsert: true }
          );
        }
      }
    }
  } catch (error) {
    console.error('Error identifying and marking duplicates:', error);
  }
};

// Schedule the function to run every hour
schedule.scheduleJob('0 * * * *', identifyAndMarkDuplicates);

// Mark duplicates manually
const markDuplicates =  async (req, res) => {
  try {
    await identifyAndMarkDuplicates();
    res.status(200).json({ message: 'Duplicate marking process initiated successfully.' });
  } catch (error) {
    console.error('Error manually marking duplicates:', error);
    res.status(500).json({ message: 'Error initiating duplicate marking process', error: error.toString() });
  }
};

const getAllBadLeads = async (req, res) => {
  try {
    // Determine the vendorLabel based on the request (e.g., from query params or user info)
    const vendorLabel = req.query.vendor || (req.user.role === 'vendor' ? req.user.username : null);

    // Fetch duplicates
    const duplicates = await LeadStatus.find({ duplicate: true }).lean();
    const duplicateIds = duplicates.map(dup => dup.leadId);

    // Fetch invalid leads based on validation == '0'
    const invalidLeadsQuery = `
      SELECT id FROM lead 
      WHERE validation = '0' 
      AND phone1 IS NOT NULL 
      AND phone1 <> ''
    `;
    const { rows: invalidLeadsRows } = await mainPool.query(invalidLeadsQuery);
    const invalidLeadIds = invalidLeadsRows.map(row => row.id);

    // Combine duplicate and invalid lead IDs, removing duplicates
    const combinedIds = [...new Set([...duplicateIds, ...invalidLeadIds])];

    // Prepare the query and parameters based on whether a vendorLabel is specified
    let leadsQuery = `
      SELECT * FROM lead 
      WHERE id = ANY($1::int[]) 
      AND phone1 IS NOT NULL 
      AND phone1 <> '' 
    `;
    let queryParameters = [combinedIds];

    if (vendorLabel) {
      leadsQuery += ` AND label = $2 ORDER BY timestamp DESC`;
      queryParameters.push(vendorLabel);
    } else {
      leadsQuery += ` ORDER BY timestamp DESC`;
    }

    const { rows: leadsDetails } = await mainPool.query(leadsQuery, queryParameters);

    // Fetch all relevant lead statuses from MongoDB to get the booked status
    const leadStatuses = await LeadStatus.find({
      leadId: { $in: combinedIds }
    }).lean();
    const leadStatusMap = new Map(leadStatuses.map(status => [status.leadId.toString(), status]));

    // Enhance leads with isDuplicate, invalid, and isBooked status
    const leadsWithStatus = leadsDetails.map(lead => {
      const status = leadStatusMap.get(lead.id.toString());
      return {
        ...lead,
        isDuplicate: duplicateIds.includes(lead.id),
        invalid: invalidLeadIds.includes(lead.id),
        isBooked: status ? status.booked : false // Add isBooked status
      };
    });

    res.json({ leads: leadsWithStatus });
  } catch (error) {
    console.error('Error fetching bad leads:', error);
    res.status(500).json({ message: 'Error fetching bad leads', error: error.toString() });
  }
};

  router.get('/bad-leads', protect, getAllBadLeads)
  router.post('/manually-mark-duplicates', protect, markDuplicates)

  module.exports = router