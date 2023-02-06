// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: bdee015765a0dd3731205df659aae576d57dd473;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../ReentrancyGuardKeccak.sol";
import "../../interfaces/IVectorFinanceStaking.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../interfaces/IStakingPositions.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/IVectorFinanceMainStaking.sol";
//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract VectorFinanceFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {

    // CONSTANTS

    address private constant VectorMainStaking = 0x8B3d9F0017FA369cD8C164D0Cc078bf4cA588aE5;

    // PUBLIC FUNCTIONS

    function vectorStakeUSDC1(uint256 amount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset: 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E,
            symbol: "USDC",
            identifier: "VF_USDC_MAIN_AUTO",
            balanceSelector: this.vectorUSDC1Balance.selector,
            unstakeSelector: this.vectorUnstakeUSDC1.selector
        });
        stakeToken(amount, position);
    }

    function vectorUnstakeUSDC1(uint256 amount, uint256 minAmount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset: 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E,
            symbol: "USDC",
            identifier: "VF_USDC_MAIN_AUTO",
            balanceSelector: this.vectorUSDC1Balance.selector,
            unstakeSelector: this.vectorUnstakeUSDC1.selector
        });
        unstakeToken(amount, minAmount, position);
    }

    function vectorUSDC1Balance() public view returns(uint256 _stakedBalance) {
        IVectorFinanceCompounder compounder = getAssetCompounder(0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E);
        _stakedBalance = compounder.userDepositToken(address(this));
    }

    function vectorStakeWAVAX1(uint256 amount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset: 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7,
            symbol: "AVAX",
            identifier: "VF_AVAX_SAVAX_AUTO",
            balanceSelector: this.vectorWAVAX1Balance.selector,
            unstakeSelector: this.vectorUnstakeWAVAX1.selector
        });
        stakeToken(amount, position);
    }

    function vectorUnstakeWAVAX1(uint256 amount, uint256 minAmount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset: 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7,
            symbol: "AVAX",
            identifier: "VF_AVAX_SAVAX_AUTO",
            balanceSelector: this.vectorWAVAX1Balance.selector,
            unstakeSelector: this.vectorUnstakeWAVAX1.selector
        });
        unstakeToken(amount, minAmount, position);
    }

    function vectorWAVAX1Balance() public view returns(uint256 _stakedBalance) {
        IVectorFinanceCompounder compounder = getAssetCompounder(0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7);
        _stakedBalance = compounder.userDepositToken(address(this));
    }

    function vectorStakeSAVAX1(uint256 amount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset: 0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE,
            symbol: "sAVAX",
            identifier: "VF_SAVAX_MAIN_AUTO",
            balanceSelector: this.vectorSAVAX1Balance.selector,
            unstakeSelector: this.vectorUnstakeSAVAX1.selector
        });
        stakeToken(amount, position);
    }

    function vectorUnstakeSAVAX1(uint256 amount, uint256 minAmount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset: 0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE,
            symbol: "sAVAX",
            identifier: "VF_SAVAX_MAIN_AUTO",
            balanceSelector: this.vectorSAVAX1Balance.selector,
            unstakeSelector: this.vectorUnstakeSAVAX1.selector
        });
        unstakeToken(amount, minAmount, position);
    }

    function vectorSAVAX1Balance() public view returns(uint256 _stakedBalance) {
        IVectorFinanceCompounder compounder = getAssetCompounder(0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE);
        _stakedBalance = compounder.userDepositToken(address(this));
    }

    // INTERNAL FUNCTIONS
    /**
    * @dev This function uses the redstone-evm-connector
    **/
    function stakeToken(uint256 amount, IStakingPositions.StakedPosition memory position) internal
    onlyOwner nonReentrant  recalculateAssetsExposure remainsSolvent {
        IVectorFinanceCompounder compounder = getAssetCompounder(position.asset);
        IERC20Metadata stakedToken = getERC20TokenInstance(position.symbol, false);
        uint256 initialReceiptTokenBalance = compounder.userDepositToken(address(this));

        amount = Math.min(stakedToken.balanceOf(address(this)), amount);
        require(amount > 0, "Cannot stake 0 tokens");

        stakedToken.approve(address(compounder), amount);

        compounder.deposit(amount);

        DiamondStorageLib.addStakedPosition(position);

        if (stakedToken.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(position.symbol);
        }

        emit Staked(
            msg.sender,
            position.symbol,
            address(compounder),
            amount,
            compounder.userDepositToken(address(this)) - initialReceiptTokenBalance,
            block.timestamp
        );
    }

    /**
    * Unstakes token from Vector Finance
    * IMPORTANT: This method can be used by anyone when a loan is insolvent. This operation can be costly, that is why
    * if needed it has to be performed in a separate transaction to liquidation
    * @dev This function uses the redstone-evm-connector
    **/
    function unstakeToken(uint256 amount, uint256 minAmount, IStakingPositions.StakedPosition memory position) internal
    onlyOwnerOrInsolvent recalculateAssetsExposure nonReentrant returns (uint256 unstaked) {
        IVectorFinanceCompounder compounder = getAssetCompounder(position.asset);
        IERC20Metadata unstakedToken = getERC20TokenInstance(position.symbol, false);

        require(amount > 0, "Cannot unstake 0 tokens");

        amount = Math.min(compounder.userDepositToken(address(this)), amount);

        uint256 balance = unstakedToken.balanceOf(address(this));

        compounder.withdraw(amount, minAmount);

        uint256 newBalance = unstakedToken.balanceOf(address(this));

        if (compounder.userDepositToken(address(this)) == 0) {
            DiamondStorageLib.removeStakedPosition(position.identifier);
        }
        DiamondStorageLib.addOwnedAsset(position.symbol, address(unstakedToken));

        emit Unstaked(
            msg.sender,
            position.symbol,
            address(compounder),
            newBalance - balance,
            amount,
            block.timestamp
        );

        return newBalance - balance;
    }

    function getAssetCompounder(address asset) internal view returns(IVectorFinanceCompounder){
        IVectorFinanceMainStaking mainStaking = IVectorFinanceMainStaking(VectorMainStaking);
        return IVectorFinanceStaking(mainStaking.getPoolInfo(asset).helper).compounder();
    }

    // MODIFIERS

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    // EVENTS

    /**
        * @dev emitted when user stakes an asset
        * @param user the address executing staking
        * @param asset the asset that was staked
        * @param vault address of receipt token
        * @param depositTokenAmount how much of deposit token was staked
        * @param receiptTokenAmount how much of receipt token was received
        * @param timestamp of staking
    **/
    event Staked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 depositTokenAmount, uint256 receiptTokenAmount, uint256 timestamp);

    /**
        * @dev emitted when user unstakes an asset
        * @param user the address executing unstaking
        * @param asset the asset that was unstaked
        * @param vault address of receipt token
        * @param depositTokenAmount how much deposit token was received
        * @param receiptTokenAmount how much receipt token was unstaked
        * @param timestamp of unstaking
    **/
    event Unstaked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 depositTokenAmount, uint256 receiptTokenAmount, uint256 timestamp);
}