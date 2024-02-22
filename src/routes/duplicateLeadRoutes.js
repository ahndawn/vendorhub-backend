const express = require('express');
const schedule = require('node-schedule');
const router = express.Router();
const { mainPool, sharedPool } = require('../services/db');
const { protect } = require('../middleware/authMiddleware');
const LeadStatus = require('../models/LeadStatus');

const identifyAndMarkDuplicates = async () => {
  const duplicateQuery = `
      SELECT phone1, ARRAY_AGG(id) AS ids
      FROM lead
      GROUP BY phone1
      HAVING COUNT(*) > 1
  `;

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

const getAllDuplicates = async (req, res) => {
  try {
      // Adjusted to exclude leads with lead.phone1 null or ''
      const duplicates = await LeadStatus.find({ duplicate: true }).lean();
      const duplicateIds = duplicates.map(dup => dup.leadId);

      // Include a condition in your SQL query to exclude leads with phone1 being null or an empty string
      const leadsQuery = `
        SELECT * FROM lead 
        WHERE id = ANY($1::int[]) 
        AND phone1 IS NOT NULL 
        AND phone1 <> '' 
        ORDER BY phone1, id
      `;
      const { rows: leadsDetails } = await mainPool.query(leadsQuery, [duplicateIds]);

      // Add isDuplicate status to each lead
      const leadsWithDuplicateStatus = leadsDetails.map(lead => ({
          ...lead,
          isDuplicate: duplicateIds.includes(lead.id)
      }));

      res.json({ leads: leadsWithDuplicateStatus });
  } catch (error) {
      console.error('Error fetching duplicate leads:', error);
      res.status(500).json({ message: 'Error fetching duplicate leads', error: error.toString() });
  }
};

  router.get('/get-duplicates', protect, getAllDuplicates)
  router.post('/manually-mark-duplicates', protect, markDuplicates)

  module.exports = router