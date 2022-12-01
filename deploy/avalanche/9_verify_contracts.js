import {ethers, getNamedAccounts} from "hardhat";
import verifyContract from "../../tools/scripts/verify-contract";
import web3Abi from "web3-eth-abi";
import PangolinIntermediaryArtifact
    from "../../artifacts/contracts/integrations/avalanche/PangolinIntermediary.sol/PangolinIntermediary.json";
import addresses from "../../common/addresses/avax/token_addresses.json";
import {toBytes32} from "../../test/_helpers";
import TraderJoeIntermediaryArtifact
    from "../../artifacts/contracts/integrations/avalanche/TraderJoeIntermediary.sol/TraderJoeIntermediary.json";

const hre = require("hardhat");

function asset(symbol) {
    return { asset: toBytes32(symbol), assetAddress: addresses[symbol] }
}

module.exports = async ({
}) => {
    const {deployer, admin} = await getNamedAccounts();

    const facet = await ethers.getContract("VariableUtilisationRatesCalculator");

    await verifyContract(hre, {
      address: facet.address
    });

    let wavaxPoolJSON = require('../../deployments/mainnet_test/by-factory/WavaxPool.json');

    await verifyContract(hre, {
      address: wavaxPoolJSON.address,
      contract: `contracts/deployment/avalanche/WavaxPool.sol:WavaxPool`
    });

    let usdcPoolJSON = require('../../deployments/mainnet_test/by-factory/UsdcPool.json');

    await verifyContract(hre, {
        address: usdcPoolJSON.address,
        contract: `contracts/deployment/avalanche/UsdcPool.sol:UsdcPool`
    });


    await verifyContract(hre, {
      address: (await ethers.getContract("WavaxPoolTUP")).address,
      contract: `contracts/proxies/tup/avalanche/WavaxPoolTUP.sol:WavaxPoolTUP`,
      constructorArguments: [
        wavaxPoolJSON.address,
        admin,
        []
      ]
    });

    await verifyContract(hre, {
        address: (await ethers.getContract("UsdcPoolTUP")).address,
        contract: `contracts/proxies/tup/avalanche/UsdcPoolTUP.sol:UsdcPoolTUP`,
        constructorArguments: [
            usdcPoolJSON.address,
            admin,
            []
        ]
    });


    await verifyContract(hre, {
        address: (await ethers.getContract("PangolinIntermediary")).address,
        contract: `contracts/integrations/avalanche/PangolinIntermediary.sol:PangolinIntermediary`,
    })

    const pangolinRouter = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106";

    const pangolinSupportedAssets = [
        asset('AVAX'),
        asset('USDC'),
        {asset:'BTC', assetAddress: '0x50b7545627a5162f82a992c33b87adc75187b218'},
        asset('ETH'),
        asset('sAVAX'),
        asset('USDT'),
        asset('QI'),
        asset('PNG_AVAX_USDC_LP'),
    ]

    const calldata = web3Abi.encodeFunctionCall(
        PangolinIntermediaryArtifact.abi.find(method => method.name === 'initialize'),
        [pangolinRouter, pangolinSupportedAssets.map(asset => asset.assetAddress)]
    )

    await verifyContract(hre, {
        address: (await ethers.getContract("PangolinIntermediaryTUP")).address,
        contract: "contracts/proxies/tup/avalanche/PangolinIntermediaryTUP.sol:PangolinIntermediaryTUP",
        constructorArguments: [
            (await ethers.getContract("PangolinIntermediary")).address,
            admin,
            calldata
        ]
    });

    await verifyContract(hre, {
        address: (await ethers.getContract("PangolinIntermediary")).address,
        contract: `contracts/integrations/avalanche/PangolinIntermediary.sol:PangolinIntermediary`,
    })

    const traderJoeRouter = "0x60aE616a2155Ee3d9A68541Ba4544862310933d4";

    const traderJoeSupportedAssets = [
        asset('AVAX'),
        asset('USDC'),
        asset('BTC'),
        asset('ETH'),
        asset('USDT'),
        asset('sAVAX'),
        asset('TJ_AVAX_USDC_LP'),
    ]

    const calldata = web3Abi.encodeFunctionCall(
        TraderJoeIntermediaryArtifact.abi.find(method => method.name === 'initialize'),
        [traderJoeRouter, traderJoeSupportedAssets.map(asset => asset.assetAddress)]
    )

    await verifyContract(hre, {
        address: (await ethers.getContract("TraderJoeIntermediaryTUP")).address,
        contract: "contracts/proxies/tup/avalanche/TraderJoeIntermediaryTUP.sol:TraderJoeIntermediaryTUP",
        constructorArguments: [
            (await ethers.getContract("TraderJoeIntermediary")).address,
            admin,
            calldata
        ]
    });

    await verifyContract(hre, {
        address: (await ethers.getContract("SmartLoansFactoryTUP")).address,
        contract: `contracts/proxies/tup/SmartLoansFactoryTUP.sol:SmartLoansFactoryTUP`,
        constructorArguments: [
            (await ethers.getContract("SmartLoansFactory")).address,
            admin,
            []
        ]
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("VectorFinanceFacet")).address,
        contract: `contracts/facets/avalanche/VectorFinanceFacet.sol:VectorFinanceFacet`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("YieldYakFacet")).address,
        contract: `contracts/facets/avalanche/YieldYakFacet.sol:YieldYakFacet`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("SmartLoanDiamondBeacon")).address,
        contract: `contracts/SmartLoanDiamondBeacon.sol:SmartLoanDiamondBeacon`,
        constructorArguments: [
            deployer,
            (await ethers.getContract("DiamondCutFacet")).address
        ]
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("SolvencyFacetProd")).address,
        contract: `contracts/facets/SolvencyFacetProd.sol:SolvencyFacetProd`,
    })

};


module.exports.tags = ['verify-contracts'];
