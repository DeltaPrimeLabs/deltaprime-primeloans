import {execSync} from "child_process";

export function embedCommitHash(contractName, contractPath = './contracts/') {
    const fs = require('fs');
    const path = require('path')

    const filePath = path.join(contractPath, contractName + '.sol');
    let data = fs.readFileSync(filePath, 'utf8');

    const commitHash = require('child_process')
        .execSync('git rev-parse HEAD')
        .toString().trim();
    let result = data.replace(/\/\/ Last deployed using commit: .*;/g, `// Last deployed from commit: ${commitHash};`);

    fs.writeFileSync(filePath, result, 'utf8');

    const output = execSync('npx hardhat compile', { encoding: 'utf-8' });
    console.log(output);

    console.log(`Successfully baked commit ${commitHash} into the ${filePath} file.`);
}
