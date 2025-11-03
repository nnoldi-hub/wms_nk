// Test file for lotParser.js
const { parseLotIntrare, generateSmartDescription } = require('./src/utils/lotParser');

console.log('\n🧪 Testing Smart Lot Parser\n');
console.log('='.repeat(80));

// Test cases from real ERP data
const testCases = [
  '##E1200 ELP 0-1083 1083 M',
  '##E1400 ELP 0-4023 4023 M',
  '##E1600 ELP 0-5245 5245 M',
  '##E1700 HES 3090-0 3090 M',
  '# TOP CABLE',
  '##CABTEC',
  '##ELP',
  '##PRYSMIAN',
  'COLAC PRVSMIAN 125 ML',
  '500 ML UNPA',
  'TAMBUR E1200',
];

testCases.forEach((lotString, index) => {
  console.log(`\nTest ${index + 1}: "${lotString}"`);
  console.log('-'.repeat(80));
  
  const result = parseLotIntrare(lotString);
  console.log('Parsed Result:');
  console.log(JSON.stringify(result, null, 2));
  
  const description = generateSmartDescription('Test Product', result);
  console.log(`\nGenerated Description: "${description}"`);
  console.log('='.repeat(80));
});

console.log('\n✅ All tests completed!\n');
