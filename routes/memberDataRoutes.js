const express = require('express');
const router = express.Router();
const memberDataController = require('../controllers/memberDataController');

// 1. Specific sub-paths (GET) - MUST BE BEFORE Parametrized routes
router.get('/shubhechhak', memberDataController.getShubhechhakMembers);
router.get('/bloodGroup', memberDataController.getBloodGroups);
router.get('/relation', memberDataController.getRelations);
router.get('/profession', memberDataController.getProfessions);
router.get('/marriageStatus', memberDataController.getMarriageStatuses);
router.get('/getTotalDonation', memberDataController.getTotalDonation);
router.get('/donationData', memberDataController.getDonationData);
router.get('/downloadDonationData', memberDataController.downloadDonationData);
router.get('/fetchByMemberId/:memberId', memberDataController.getMemberByMemberId);
router.get('/appPin', memberDataController.getAppPin);

// 2. Base paths (GET)
router.get('/', memberDataController.getAllMembers);

// 3. Member by ID (GET) - Parametrized routes go after specific ones
router.get('/:id', memberDataController.getMemberById);

// 4. POST routes
router.post('/shubhechhak', memberDataController.addShubhechhakMember);
router.post('/donation', memberDataController.createDonation);
router.post('/', memberDataController.addMember);

// 5. PUT routes
router.put('/shubhechhak/:id', memberDataController.updateShubhechhakMember);
router.put('/:id', memberDataController.updateMember);

// 6. DELETE routes
router.delete('/shubhechhak/:id', memberDataController.deleteShubhechhakMember);
router.delete('/donation/:id', memberDataController.deleteDonation);
router.delete('/:id', memberDataController.deleteMember);

module.exports = router;
