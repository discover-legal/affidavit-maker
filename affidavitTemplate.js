// affidavitTemplate.js
const generateAffidavitHTML = (data) => {
  const { state, caseType, affiantName, caseNumber, facts, county, notaryDate } = data;
  
  // State-specific headers
  const stateHeaders = {
    'TX': 'THE STATE OF TEXAS',
    'UT': 'STATE OF UTAH', 
    'AZ': 'STATE OF ARIZONA'
  };

  const stateName = {
    'TX': 'Texas',
    'UT': 'Utah',
    'AZ': 'Arizona'
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 2;
      margin: 1in;
      color: #000;
    }
    .header {
      text-align: center;
      font-weight: bold;
      margin-bottom: 20px;
    }
    .case-caption {
      margin-bottom: 20px;
    }
    .title {
      text-align: center;
      font-weight: bold;
      text-decoration: underline;
      margin: 20px 0;
    }
    .paragraph {
      text-align: justify;
      margin-bottom: 20px;
      text-indent: 0.5in;
    }
    .numbered-paragraph {
      margin-left: 0.5in;
      margin-bottom: 15px;
    }
    .signature-block {
      margin-top: 50px;
      margin-bottom: 30px;
    }
    .notary-block {
      margin-top: 50px;
      border: 1px solid black;
      padding: 20px;
    }
    .disclaimer {
      margin-top: 40px;
      padding: 10px;
      border: 1px solid #ccc;
      background-color: #f5f5f5;
      font-size: 10pt;
    }
  </style>