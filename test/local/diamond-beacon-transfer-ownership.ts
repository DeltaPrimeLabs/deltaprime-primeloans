import chai from 'chai'
import {solidity} from "ethereum-waffle";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {deployAllFacets, getFixedGasSigners} from "../_helpers";
import {DiamondCutFacet, OwnershipFacet, SmartLoanDiamondBeacon} from "../../typechain";

const {replaceFacet} = require('../../tools/diamond/deploy-diamond.js');
const {ethers} = require("hardhat");
const { getSelectors, FacetCutAction } = require('../../tools/diamond/selectors.js')

chai.use(solidity);

const {expect} = chai;

describe('SmartLoanDiamondBeacon transfer ownership', () => {

    describe('Test - transfer ownership', () => {
        let diamondBeacon: SmartLoanDiamondBeacon,
        diamondCut: DiamondCutFacet,
        diamondCut1: DiamondCutFacet,
        diamondCutInterface: DiamondCutFacet,
        ownershipFacet: OwnershipFacet,
        owner: SignerWithAddress,
        newOwner: SignerWithAddress,
        other: SignerWithAddress;

        before("deploy the diamond beacon and facets", async () => {
            [owner, newOwner, other] = await getFixedGasSigners(10000000);

            const diamondCutFacetFactory = await ethers.getContractFactory('DiamondCutFacet');
            const diamondBeaconFactory = await ethers.getContractFactory('SmartLoanDiamondBeacon');

            diamondCut = await diamondCutFacetFactory.deploy()
            await diamondCut.deployed();

            diamondCut1 = await diamondCutFacetFactory.deploy()
            await diamondCut1.deployed();

            diamondBeacon = await diamondBeaconFactory.deploy(owner.address, diamondCut.address);
            await diamondBeacon.deployed();

            diamondCutInterface = await ethers.getContractAt('IDiamondCut', diamondBeacon.address, owner);
            await diamondCutInterface.unpause();

            ownershipFacet = await ethers.getContractAt("IOwnershipFacet", diamondBeacon.address, owner);

            await deployAllFacets(diamondBeacon.address);
        });

        it("should check current owner", async () => {
            expect(await ownershipFacet.owner()).to.be.equal(owner.address);
        });

        it("should perform diamondCut as the owner", async () => {
            await diamondCutInterface.pause();
            await diamondCutInterface.diamondCut(
                [{
                    facetAddress: diamondCut1.address,
                    action: FacetCutAction.Replace,
                    functionSelectors: getSelectors(diamondCut).get(['diamondCut'])
                }],
                ethers.constants.AddressZero,
                []
            );
            await diamondCutInterface.unpause();
        });

        it("should fail to pause as the non-owner", async () => {
            await expect(diamondCutInterface.connect(newOwner).pause()).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to perform diamondCut as the non-owner", async () => {
            await diamondCutInterface.pause();
            await expect(diamondCutInterface.connect(newOwner).diamondCut(
                [{
                    facetAddress: diamondCut.address,
                    action: FacetCutAction.Replace,
                    functionSelectors: getSelectors(diamondCut).get(['diamondCut'])
                }],
                ethers.constants.AddressZero,
                []
            )).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await diamondCutInterface.unpause();
        });

        it("should fail to propose a new owner as the non-owner", async () => {
            await expect(diamondBeacon.connect(newOwner).proposeBeaconOwnershipTransfer(newOwner.address)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to accept a non-existing proposal", async () => {
            await expect(diamondBeacon.connect(newOwner).acceptBeaconOwnership()).to.be.revertedWith("Only a proposed user can accept ownership");
        });

        it("should propose a new owner as owner", async () => {
            expect(await ownershipFacet.owner()).to.be.equal(owner.address);
            expect(await ownershipFacet.proposedOwner()).to.be.equal(ethers.constants.AddressZero);

            await diamondBeacon.proposeBeaconOwnershipTransfer(newOwner.address);

            expect(await ownershipFacet.owner()).to.be.equal(owner.address);
            expect(await ownershipFacet.proposedOwner()).to.be.equal(newOwner.address);
        });

        it("should fail to accept an existing proposal as not the newOwner user", async () => {
            await expect(diamondBeacon.connect(other).acceptBeaconOwnership()).to.be.revertedWith("Only a proposed user can accept ownership");
        });

        it("should fail to perform diamondCut as the pending newOwner", async () => {
            await diamondCutInterface.pause();
            await expect(diamondCutInterface.connect(newOwner).diamondCut(
                [{
                    facetAddress: diamondCut.address,
                    action: FacetCutAction.Replace,
                    functionSelectors: getSelectors(diamondCut).get(['diamondCut'])
                }],
                ethers.constants.AddressZero,
                []
            )).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await diamondCutInterface.unpause();
        });

        it("should accept an existing proposal as the newOwner", async () => {
            expect(await ownershipFacet.owner()).to.be.equal(owner.address);
            expect(await ownershipFacet.proposedOwner()).to.be.equal(newOwner.address);

            await diamondBeacon.connect(newOwner).acceptBeaconOwnership();

            expect(await ownershipFacet.owner()).to.be.equal(newOwner.address);
            expect(await ownershipFacet.proposedOwner()).to.be.equal(ethers.constants.AddressZero);
        });

        it("should fail to pause as the old owner", async () => {
            await expect(diamondCutInterface.connect(owner).pause()).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to perform diamondCut as the old owner", async () => {
            await diamondCutInterface.connect(newOwner).pause();
            await expect(diamondCutInterface.connect(owner).diamondCut(
                [{
                    facetAddress: diamondCut.address,
                    action: FacetCutAction.Replace,
                    functionSelectors: getSelectors(diamondCut).get(['diamondCut'])
                }],
                ethers.constants.AddressZero,
                []
            )).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await diamondCutInterface.connect(newOwner).unpause();
        });

        it("should perform diamondCut as the new owner", async () => {
            await diamondCutInterface.connect(newOwner).pause();
            await diamondCutInterface.connect(newOwner).diamondCut(
                [{
                    facetAddress: diamondCut.address,
                    action: FacetCutAction.Replace,
                    functionSelectors: getSelectors(diamondCut).get(['diamondCut'])
                }],
                ethers.constants.AddressZero,
                []
            );
            await diamondCutInterface.connect(newOwner).unpause();
        });
    });
});

