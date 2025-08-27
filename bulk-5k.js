// Generate 5000 records at once - MAXIMUM SPEED
const generateRecords = (count) => {
  const records = [];
  const companies = ['TechCorp', 'DataSystems', 'CloudSolutions', 'DigitalWorks', 'SmartTech', 'GlobalInc', 'PrimeData', 'EliteCloud'];
  const recordTypes = ['client', 'customer', 'prospect', 'lead'];
  const statuses = ['active', 'inactive', 'pending'];
  const categories = ['premium', 'standard', 'basic'];

  for (let i = 0; i < count; i++) {
    const company = companies[i % companies.length];
    const recordType = recordTypes[i % recordTypes.length];
    const status = statuses[i % statuses.length];
    const category = categories[i % categories.length];
    
    records.push({
      name: `${company} ${i + 3000}`,
      email: `user${i + 3000}@${company.toLowerCase()}.com`,
      record_type: recordType,
      status: status,
      score: String((i % 100) + 1),
      category: category,
      notes: `Bulk record ${i + 3000} - high-performance test`
    });
  }
  return records;
};

console.log(JSON.stringify({ records: generateRecords(5000), options: { batchSize: 5000 } }));