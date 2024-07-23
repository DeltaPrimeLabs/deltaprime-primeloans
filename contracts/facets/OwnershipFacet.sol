
// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 8b58ef10ba0685f601f98a700dae8cb3002ec1a6;
pragma solidity 0.8.17;

import { DiamondStorageLib } from "../lib/DiamondStorageLib.sol";
import "../SmartLoansFactory.sol";
import "./SmartLoanLiquidationFacet.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract OwnershipFacet {
    modifier onlyWhitelistedLiquidators() {
        // External call in order to execute this method in the SmartLoanDiamondBeacon contract storage
        require(SmartLoanLiquidationFacet(DeploymentConstants.getDiamondAddress()).isLiquidatorWhitelisted(msg.sender), "Only whitelisted liquidators can execute this method");
        _;
    }

    function proposeOwnershipTransfer(address _newOwner) external {
        DiamondStorageLib.enforceIsContractOwner();
        require(_newOwner != msg.sender, "Can't propose oneself as a contract owner");
        require(SmartLoansFactory(DeploymentConstants.getSmartLoansFactoryAddress()).getLoanForOwner(_newOwner) == address(0),
            "Can't propose an address that already has a loan");
        DiamondStorageLib.setProposedOwner(_newOwner);

        emit OwnershipProposalCreated(msg.sender, _newOwner);
    }

    function revertToRightfulOwner() external onlyWhitelistedLiquidators {
        address rightfulOwner;
        bool shouldUpdateSmartLoansFactory = false;

        if(address(this) == 0xad5783Fb992BFee99732a5eBE5Ba301657Fb047E){
            rightfulOwner = 0x3c6DfB5D608c4849d289d81d8bfcCBD48d86d0a8;
            shouldUpdateSmartLoansFactory = false;
        } else if(address(this) == 0x10750001efb9c5AF263F650FB1f49Dd69C955CA0){
            rightfulOwner = 0x14f69F9C351b798dF31fC53E33c09dD29bFAb547;
            shouldUpdateSmartLoansFactory = false;
        } else if(address(this) == 0x6018e2752B64e31FDAc15d1eD5Dedf82566A484C){
            rightfulOwner = 0x944496b6B25f94d5d0bd9dFb60F5532dac211A20;
            shouldUpdateSmartLoansFactory = false;
        } else if(address(this) == 0xe5ED5AfaD6493E0cB63Dc42E1f3ABb9676378c4f){
            rightfulOwner = 0xACc3F29902FE029e7D0Ebb66B28B282ddc4b9f26;
            shouldUpdateSmartLoansFactory = false;
        } else if(address(this) == 0x96E114D73AE220cbd2bD8Ce620BcfEA2e20B0C00){
            rightfulOwner = 0x35489cDcc57b7eCB0333F504B2Fe60828309a97E;
            shouldUpdateSmartLoansFactory = false;
        } else if(address(this) == 0x2B97706A7184FdDDdaEb70614b0a8fD35Fb54F60){
            rightfulOwner = 0x96C94E710690FAF6Ca4b0EF6e129B8de1F3001E2;
            shouldUpdateSmartLoansFactory = false;
        } else if(address(this) == 0x9F1FD5458E0E465379E8aff9d1d825e2C13D2eCb){
            rightfulOwner = 0xeE03A69A2C787D9A560172176524B4409723cCb4;
            shouldUpdateSmartLoansFactory = false;
        } else if(address(this) == 0xA9694B73d6614183138A697c7B7C99d9718d3Eca){
            rightfulOwner = 0xC8160b24922664d9b3CF7f0acBC149dC33917d15;
            shouldUpdateSmartLoansFactory = false;
        } else if(address(this) == 0xba5C8630E224B8AF7b29BBDdb0435f07b6643190){
            rightfulOwner = 0xf4E6232d2f86Bd3399D956b3892d6B1893e1e06E;
            shouldUpdateSmartLoansFactory = false;
        } else if(address(this) == 0x2FfD0D2bEa8E922A722De83c451Ad93e097851F5){
            rightfulOwner = 0x81262DfC30A5E3Ae137029F20850566F86f6eB3A;
            shouldUpdateSmartLoansFactory = true;
        } else if(address(this) == 0x0b7DcF8E70cF0f9c73D2777d871F4eBD6150Bd3b){
            rightfulOwner = 0xE18C25BFb89596AF5B13FDE5E9676e6C19fE5D20;
            shouldUpdateSmartLoansFactory = true;
        } else if(address(this) == 0x48285109D4b959608C8E9691cAb1aFc244a80D5F){
            rightfulOwner = 0x50418699cB44BfDa9c9afc9B7a0b0d244d8927D2;
            shouldUpdateSmartLoansFactory = false;
        } else if(address(this) == 0xCC5159C01C1bdAb6c607F800E71B84898597c9FE){
            rightfulOwner = 0x96645412c8D1981b8104DC99E84996276c7D9435;
            shouldUpdateSmartLoansFactory = true;
        } else if(address(this) == 0xfeD94826098d636c517F7F1021B37EB465b9FCE4){
            rightfulOwner = 0xED2A1F4b1b1BfFD86c6Ab72A55c0F7d21b00D207;
            shouldUpdateSmartLoansFactory = true;
        } else if(address(this) == 0x58c80413603841455b3C5abF08d6AA854F376086){
            rightfulOwner = 0xB97D1BFa5c0cb2b776EACa2050B4Ff6e5DF486E6;
            shouldUpdateSmartLoansFactory = true;
        } else if(address(this) == 0xc00bE32F7669A3417AD26DD41352418Fc49eB0F7){
            rightfulOwner = 0x9e0C163c5D07AE90c8F805165864D583bbAE6b17;
            shouldUpdateSmartLoansFactory = true;
        } else if(address(this) == 0x36a1bCcf37AF1E315888c2cA967B163c50B1D943){
            rightfulOwner = 0xcDA5a93Dd9947b6FF11dB866fE90ca79d033ADD9;
            shouldUpdateSmartLoansFactory = true;
        } else if(address(this) == 0xb9967f0e4ea928550E3d05B0e57a627AB0302108){
            rightfulOwner = 0x0e2852b070fbF866acecb93DeC04b91F02804cFE;
            shouldUpdateSmartLoansFactory = true;
        } else if(address(this) == 0x7F23dc430AF70aBE865387d5b1FDC91c27daEcCB){
            rightfulOwner = 0xDd64DCFcA556198dcbEf3Fc09Ee40E61BD716b0b;
            shouldUpdateSmartLoansFactory = true;
        } else if(address(this) == 0x35C93a488906798341ce4267Ecb398dC2aD230a6){
            rightfulOwner = 0x4512d1577517a46fc81111F8db4fA286B38D3Ee4;
            shouldUpdateSmartLoansFactory = true;
        } else if(address(this) == 0x0844F379be6E5b7Fd4A6D8f7A1b5146A68E23e9f){
            rightfulOwner = 0xC152Cd87af2b3774e93ed2ad2523c90C576db5fA;
            shouldUpdateSmartLoansFactory = true;
        } else if(address(this) == 0xeAA7425910Af14657ED96a278274e6e85D947f2D){
            rightfulOwner = 0x4726464FB17727cb6C7aAab2451F7229C94BfdC4;
            shouldUpdateSmartLoansFactory = true;
        } else {
            revert("AccountNotListed");
        }

        require(rightfulOwner != address(0), "Rightful owner not found");

        DiamondStorageLib.setContractOwner(rightfulOwner);
        DiamondStorageLib.setProposedOwner(address(0));
        if(shouldUpdateSmartLoansFactory){
            SmartLoansFactory(DeploymentConstants.getSmartLoansFactoryAddress()).changeOwnership(rightfulOwner);
        }
    }

    function acceptOwnership() external {
        require(DiamondStorageLib.proposedOwner() == msg.sender, "Only a proposed user can accept ownership");
        DiamondStorageLib.setContractOwner(msg.sender);
        DiamondStorageLib.setProposedOwner(address(0));
        SmartLoansFactory(DeploymentConstants.getSmartLoansFactoryAddress()).changeOwnership(msg.sender);

        emit OwnershipProposalAccepted(msg.sender);
    }

    function owner() external view returns (address owner_) {
        owner_ = DiamondStorageLib.contractOwner();
    }

    function proposedOwner() external view returns (address proposedOwner_) {
        proposedOwner_ = DiamondStorageLib.proposedOwner();
    }

    function pauseAdmin() external view returns (address pauseAdmin) {
        pauseAdmin = DiamondStorageLib.pauseAdmin();
    }

    function proposedPauseAdmin() external view returns (address proposedPauseAdmin) {
        proposedPauseAdmin = DiamondStorageLib.proposedPauseAdmin();
    }

    /**
     * @dev emitted after creating a ownership transfer proposal by the owner
     * @param owner address of the current owner
     * @param proposed address of the proposed owner
     **/
    event OwnershipProposalCreated(address indexed owner, address indexed proposed);

    /**
     * @dev emitted after accepting a ownership transfer proposal by the new owner
     * @param newOwner address of the new owner
     **/
    event OwnershipProposalAccepted(address indexed newOwner);
}