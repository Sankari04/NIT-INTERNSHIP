require('dotenv').config();

module.exports = {
  name: process.env.COMPANY_NAME || 'Demo Snacks Company',
  state: process.env.COMPANY_STATE || 'Tamil Nadu',
  gstin: process.env.COMPANY_GSTIN || 'REPLACE_WITH_YOUR_GSTIN',
  address: process.env.COMPANY_ADDRESS || 'REPLACE_WITH_YOUR_BUSINESS_ADDRESS',
  disclaimer: 'Demo/Prototype GST calculation only. Not certified for statutory GST filing.',
};
