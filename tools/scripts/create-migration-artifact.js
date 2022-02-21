export default function createMigrationArtifact(networkName, filePath, destinationPath, deploymentAddress, transactionHash) {
    var fs = require('fs')

    fs.copyFileSync(filePath, destinationPath);

    let json = JSON.parse(fs.readFileSync(destinationPath, 'utf8'));

    json.address = deploymentAddress;
    json.transactionHash = transactionHash;

    fs.writeFileSync(destinationPath, JSON.stringify(json), 'utf8');

    return 'Migration JSON file created!'
}
