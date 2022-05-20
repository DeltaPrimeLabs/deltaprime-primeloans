/* eslint prefer-const: "off" */
const {ethers} = require("hardhat");


const { getSelectors, FacetCutAction } = require('./diamond.js')

// TODO: Refactor xd

async function replaceFacet(facetName, diamondAddress, newlyIntroducedFunctions = []) {
    const cut = []

    const Facet = await ethers.getContractFactory(facetName);
    const facet = await Facet.deploy()
    await facet.deployed()
    console.log(`${facetName} deployed: ${facet.address}`);

    cut.push({
        facetAddress: facet.address,
        action: FacetCutAction.Replace,
        functionSelectors: getSelectors(facet).remove(newlyIntroducedFunctions)
    })

    if(newlyIntroducedFunctions.length > 0) {
        cut.push({
            facetAddress: facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(facet).get(newlyIntroducedFunctions)
        })
    }

    const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress)
    let tx
    let receipt

    tx = await diamondCut.diamondCut(cut, ethers.constants.AddressZero, [])
    console.log('Diamond cut tx: ', tx.hash)
    receipt = await tx.wait()
    if (!receipt.status) {
        throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    console.log('Completed diamond cut')
}

async function deployFacet(facetName, diamondAddress) {
    const cut = []

    const Facet = await ethers.getContractFactory(facetName);
    const facet = await Facet.deploy()
    await facet.deployed()
    console.log(`${facetName} deployed: ${facet.address}`);
    console.log(`RETURN EXCHANGE: ${await facet.getExchange()}`);

    cut.push({
        facetAddress: facet.address,
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(facet)
    })
    const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress)
    let tx
    let receipt

    tx = await diamondCut.diamondCut(cut, ethers.constants.AddressZero, [])
    console.log('Diamond cut tx: ', tx.hash)
    receipt = await tx.wait()
    if (!receipt.status) {
        throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    console.log('Completed diamond cut')
}

async function deployDiamond () {
    const accounts = await ethers.getSigners()
    const contractOwner = accounts[0]

    // deploy DiamondCutFacet
    const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet')
    const diamondCutFacet = await DiamondCutFacet.deploy()
    await diamondCutFacet.deployed()
    console.log('DiamondCutFacet deployed:', diamondCutFacet.address)

    // deploy Diamond
    const Diamond = await ethers.getContractFactory('SmartLoan')
    const diamond = await Diamond.deploy(contractOwner.address, diamondCutFacet.address)
    await diamond.deployed()
    console.log('Diamond deployed:', diamond.address)

    // console.log('About to revert with error now...')
    // let test = await ethers.getContract("SmartLoan");
    // console.log(`SMART LOAN ADDDDRESS: ${test.address}`);

    // deploy DiamondInit
    // DiamondInit provides a function that is called when the diamond is upgraded to initialize state variables
    // Read about how the diamondCut function works here: https://eips.ethereum.org/EIPS/eip-2535#addingreplacingremoving-functions
    const DiamondInit = await ethers.getContractFactory('DiamondInit')
    const diamondInit = await DiamondInit.deploy()
    await diamondInit.deployed()
    console.log('DiamondInit deployed:', diamondInit.address)

    // deploy facets
    console.log('')
    console.log('Deploying facets')
    // TODO: Should DiamondInit be added?
    const FacetNames = [
        'DiamondInit',
        'DiamondLoupeFacet',
        'OwnershipFacet'
    ]
    const cut = []
    for (const FacetName of FacetNames) {
        const Facet = await ethers.getContractFactory(FacetName)
        const facet = await Facet.deploy()
        await facet.deployed()
        console.log(`${FacetName} deployed: ${facet.address}`)
        cut.push({
            facetAddress: facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(facet)
        })
    }

    // upgrade diamond with facets
    const diamondCut = await ethers.getContractAt('IDiamondCut', diamond.address)
    let tx
    let receipt
    // call to init function
    let functionCall = diamondInit.interface.encodeFunctionData('init')
    tx = await diamondCut.diamondCut(cut, diamondInit.address, functionCall)
    console.log('Diamond cut tx: ', tx.hash)
    receipt = await tx.wait()
    if (!receipt.status) {
        throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    console.log('Completed diamond cut')
    return diamond.address
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
    deployDiamond()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error)
            process.exit(1)
        })
}

exports.deployDiamond = deployDiamond
exports.deployFacet = deployFacet
exports.replaceFacet = replaceFacet