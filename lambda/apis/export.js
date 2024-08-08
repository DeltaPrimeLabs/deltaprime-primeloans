const fs = require("fs");
const {
  fetchAllDataFromDB
} = require('../utils/helpers');

const exportTable = async () => {
  let params = {
    TableName: 'sprime-ava-prod'
  };

  const results = await fetchAllDataFromDB(params, true, 50);
  // const sorted = results.sort((a, b) => a.timestamp > b.timestamp)

  fs.writeFileSync('sprime-ava.json', JSON.stringify(results));
}

exportTable();