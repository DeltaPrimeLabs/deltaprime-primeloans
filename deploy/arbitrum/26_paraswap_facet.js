import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";
const web3Abi  = require('web3-eth-abi');
const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    const FacetCutAction = {
        Add: 0,
        Replace: 1,
        Remove: 2
    }

    // Deploying from avalanche as it's identical to arbi one
    embedCommitHash("ParaSwapFacet", "./contracts/facets/avalanche");

    let ParaSwapFacet = await deploy("ParaSwapFacet", {
        from: deployer,
        gasLimit: 50000000,
        args: [],
    });


    console.log(
        `ParaSwapFacet implementation deployed at address: ${ParaSwapFacet.address}`
    );

    await verifyContract(hre,
        {
            address: ParaSwapFacet.address,
            contract: `contracts/facets/avalanche/ParaSwapFacet.sol:ParaSwapFacet`,
            constructorArguments: []
        });
    console.log(`Verified ParaSwapFacet`);

    const diamondContract = await ethers.getContract("SmartLoanDiamondBeacon");
    console.log(`Diamond address: ${diamondContract.address}`);
    const diamondCut = await ethers.getContractAt("IDiamondCut", diamondContract.address, deployer);

    // paraSwap
    let methodsSelectors = ["0xcb21c9db"];

    const facetCut = [
        [
            ParaSwapFacet.address,
            FacetCutAction.Add,
            methodsSelectors
        ]
    ]

    const diamondCutInterface = {
        "inputs": [
            {
                "components": [
                    {
                        "internalType": "address",
                        "name": "facetAddress",
                        "type": "address"
                    },
                    {
                        "internalType": "enum IDiamondCut.FacetCutAction",
                        "name": "action",
                        "type": "uint8"
                    },
                    {
                        "internalType": "bytes4[]",
                        "name": "functionSelectors",
                        "type": "bytes4[]"
                    }
                ],
                "internalType": "struct IDiamondCut.FacetCut[]",
                "name": "_diamondCut",
                "type": "tuple[]"
            },
            {
                "internalType": "address",
                "name": "_init",
                "type": "address"
            },
            {
                "internalType": "bytes",
                "name": "_calldata",
                "type": "bytes"
            }
        ],
        "name": "diamondCut",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }

    const calldata = web3Abi.encodeFunctionCall(diamondCutInterface, [
        facetCut,
        ethers.constants.AddressZero,
        []
    ]);

    await diamondCut.pause();
    console.log('Paused')

    console.log(`Calldata to execute diamond cut: ${calldata}`)

    await diamondCut.unpause();
    console.log('Unpaused')
};

module.exports.tags = ["arbitrum-paraswap-facet"];
