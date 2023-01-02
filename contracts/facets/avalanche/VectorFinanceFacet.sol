// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
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
            identifier: "VF_USDC_MAIN",
            balanceSelector: this.vectorUSDC1Balance.selector,
            unstakeSelector: this.vectorUnstakeUSDC1.selector
        });
        stakeToken(amount, position);
    }

    function vectorUnstakeUSDC1(uint256 amount, uint256 minAmount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset: 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E,
            symbol: "USDC",
            identifier: "VF_USDC_MAIN",
            balanceSelector: this.vectorUSDC1Balance.selector,
            unstakeSelector: this.vectorUnstakeUSDC1.selector
        });
        unstakeToken(amount, minAmount, position);
    }

    function vectorUSDC1Balance() public view returns(uint256 _stakedBalance) {
        IVectorFinanceStaking stakingContract = IVectorFinanceStaking(getAssetPoolHelper(0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E));
        _stakedBalance = stakingContract.balance(address(this));
    }

    function vectorStakeWAVAX1(uint256 amount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset: 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7,
            symbol: "AVAX",
            identifier: "VF_AVAX_SAVAX",
            balanceSelector: this.vectorWAVAX1Balance.selector,
            unstakeSelector: this.vectorUnstakeWAVAX1.selector
        });
        stakeToken(amount, position);
    }

    function vectorUnstakeWAVAX1(uint256 amount, uint256 minAmount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset: 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7,
            symbol: "AVAX",
            identifier: "VF_AVAX_SAVAX",
            balanceSelector: this.vectorWAVAX1Balance.selector,
            unstakeSelector: this.vectorUnstakeWAVAX1.selector
        });
        unstakeToken(amount, minAmount, position);
    }

    function vectorWAVAX1Balance() public view returns(uint256 _stakedBalance) {
        IVectorFinanceStaking stakingContract = IVectorFinanceStaking(getAssetPoolHelper(0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7));
        _stakedBalance = stakingContract.balance(address(this));
    }

    function vectorStakeSAVAX1(uint256 amount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset: 0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE,
            symbol: "sAVAX",
            identifier: "VF_SAVAX_MAIN",
            balanceSelector: this.vectorSAVAX1Balance.selector,
            unstakeSelector: this.vectorUnstakeSAVAX1.selector
        });
        stakeToken(amount, position);
    }

    function vectorUnstakeSAVAX1(uint256 amount, uint256 minAmount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset: 0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE,
            symbol: "sAVAX",
            identifier: "VF_SAVAX_MAIN",
            balanceSelector: this.vectorSAVAX1Balance.selector,
            unstakeSelector: this.vectorUnstakeSAVAX1.selector
        });
        unstakeToken(amount, minAmount, position);
    }

    function vectorSAVAX1Balance() public view returns(uint256 _stakedBalance) {
        IVectorFinanceStaking stakingContract = IVectorFinanceStaking(getAssetPoolHelper(0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE));
        _stakedBalance = stakingContract.balance(address(this));
    }

    // INTERNAL FUNCTIONS
    /**
    * @dev This function uses the redstone-evm-connector
    **/
    function stakeToken(uint256 amount, IStakingPositions.StakedPosition memory position) internal
    onlyOwner nonReentrant remainsSolvent {
        IVectorFinanceStaking poolHelper = getAssetPoolHelper(position.asset);
        IERC20Metadata stakedToken = getERC20TokenInstance(position.symbol, false);
        uint256 lpTokenInitialBalance = poolHelper.balance(address(this));

        require(amount > 0, "Cannot stake 0 tokens");
        require(stakedToken.balanceOf(address(this)) >= amount, "Not enough token available");

        stakedToken.approve(VectorMainStaking, amount);

        poolHelper.deposit(amount);

        DiamondStorageLib.addStakedPosition(position);

        if (stakedToken.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(position.symbol);
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        tokenManager.decreaseProtocolExposure(position.symbol, amount * 1e18 / stakedToken.decimals());
        tokenManager.increaseProtocolExposure(position.identifier, (poolHelper.balance(address(this)) - lpTokenInitialBalance) * 1e18 / stakedToken.decimals());

        emit Staked(msg.sender, position.symbol, address(poolHelper), amount, block.timestamp);
    }

    /**
    * Unstakes token from Vector Finance
    * IMPORTANT: This method can be used by anyone when a loan is insolvent. This operation can be costly, that is why
    * if needed it has to be performed in a separate transaction to liquidation
    * @dev This function uses the redstone-evm-connector
    **/
    function unstakeToken(uint256 amount, uint256 minAmount, IStakingPositions.StakedPosition memory position) internal
    onlyOwnerOrInsolvent nonReentrant returns (uint256 unstaked) {
        IVectorFinanceStaking poolHelper = getAssetPoolHelper(position.asset);
        IERC20Metadata unstakedToken = getERC20TokenInstance(position.symbol, false);

        require(amount > 0, "Cannot unstake 0 tokens");

        uint256 initialStakedBalance = poolHelper.balance(address(this));

        require(initialStakedBalance >= amount, "Cannot unstake more than was initially staked");

        uint256 balance = unstakedToken.balanceOf(address(this));

        poolHelper.withdraw(amount, minAmount);

        uint256 newBalance = unstakedToken.balanceOf(address(this));

        if (poolHelper.balance(address(this)) == 0) {
            DiamondStorageLib.removeStakedPosition(position.identifier);
        }
        DiamondStorageLib.addOwnedAsset(position.symbol, address(unstakedToken));

        emit Unstaked(msg.sender, position.symbol, address(poolHelper), newBalance - balance, block.timestamp);

        _handleRewards(poolHelper);

        DeploymentConstants.getTokenManager().increaseProtocolExposure(position.symbol, (newBalance - balance) * 1e18 / unstakedToken.decimals());
        DeploymentConstants.getTokenManager().decreaseProtocolExposure(position.identifier, amount * 1e18 / unstakedToken.decimals());

        return newBalance - balance;
    }

    function _handleRewards(IVectorFinanceStaking stakingContract) internal {
        IVectorRewarder rewarder = stakingContract.rewarder();
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        uint256 index;

        // We do not want to revert in case of unsupported rewardTokens in order not to block the unstaking/liquidation process
        while(true) {
            // No access to the length of rewardTokens[]. Need to iterate until indexOutOfRange
            (bool success, bytes memory result) = address(rewarder).call(abi.encodeWithSignature("rewardTokens(uint256)", index));
            if(!success) {
                break;
            }
            address rewardToken = abi.decode(result, (address));
            bytes32 rewardTokenSymbol = tokenManager.tokenAddressToSymbol(rewardToken);
            if(rewardTokenSymbol == "") {
                emit UnsupportedRewardToken(msg.sender, rewardToken, block.timestamp);
                index += 1;
                continue;
            }
            if(IERC20(rewardToken).balanceOf(address(this)) > 0) {
                DiamondStorageLib.addOwnedAsset(rewardTokenSymbol, rewardToken);
            }
            index += 1;
        }
    }

    function getAssetPoolHelper(address asset) internal view returns(IVectorFinanceStaking){
        IVectorFinanceMainStaking mainStaking = IVectorFinanceMainStaking(VectorMainStaking);
        return IVectorFinanceStaking(mainStaking.getPoolInfo(asset).helper);
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
        * @param amount of the asset that was staked
        * @param timestamp of staking
    **/
    event Staked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 amount, uint256 timestamp);

    /**
        * @dev emitted when user unstakes an asset
        * @param user the address executing unstaking
        * @param asset the asset that was unstaked
        * @param vault address of receipt token
        * @param amount of the asset that was unstaked
        * @param timestamp of unstaking
    **/
    event Unstaked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 amount, uint256 timestamp);

    /**
        * @dev emitted when user collects rewards in tokens that are not supported
        * @param user the address collecting rewards
        * @param asset reward token that was collected
        * @param timestamp of collecting rewards
    **/
    event UnsupportedRewardToken(address indexed user, address indexed asset, uint256 timestamp);
}