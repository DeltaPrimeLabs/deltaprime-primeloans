export function embedCommitHash(contractName, contractPath = './contracts/') {
    const fs = require('fs');
    const path = require('path')

    const filePath = path.join(contractPath, contractName);
    let data = fs.readFileSync(filePath, 'utf8');

    const commitHash = require('child_process')
        .execSync('git rev-parse HEAD')
        .toString().trim();
    let result = data.replace(/\/\/ Last deployed using commit: .*;/g, `// Last deployed from commit: ${commitHash};`);

    fs.writeFileSync(filePath, result, 'utf8');

    console.log(`Successfully baked commit ${commitHash} into the ${filePath} file.`);
}
