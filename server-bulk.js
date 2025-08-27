// Generate 10k records directly on server - MUCH FASTER
const generateRecords = (count, startIndex = 0) => {
  const records = [];
  const companies = ['Tech', 'Data', 'Cloud', 'Digital', 'Smart', 'Global', 'Prime', 'Elite'];
  const types = ['Inc', 'LLC', 'Corp', 'Ltd'];
  const recordTypes = ['client', 'customer', 'prospect', 'lead'];
  const statuses = ['active', 'inactive', 'pending'];
  const categories = ['premium', 'standard', 'basic'];

  for (let i = 0; i < count; i++) {
    const idx = startIndex + i;
    const company = companies[idx % companies.length];
    const type = types[idx % types.length];
    const recordType = recordTypes[idx % recordTypes.length];
    const status = statuses[idx % statuses.length];
    const category = categories[idx % categories.length];
    
    records.push({
      name: `${company} ${type} ${idx}`,
      email: `contact${idx}@${company.toLowerCase()}corp.com`,
      record_type: recordType,
      status: status,
      score: String((idx % 100) + 1),
      category: category,
      notes: `Bulk generated record ${idx + 1} for performance testing`
    });
  }
  return records;
};

// Generate and output JSON for 1000 records at a time
const records = generateRecords(1000);
console.log(JSON.stringify({ records, options: { batchSize: 1000 } }));