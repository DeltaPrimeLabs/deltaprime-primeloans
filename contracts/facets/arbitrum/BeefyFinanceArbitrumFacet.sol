// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../../ReentrancyGuardKeccak.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/facets/IBeefyFinance.sol";

import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract BeefyFinanceArbitrumFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address payable;
    using TransferHelper for address;

    // Vaults
    address private constant MOO_HOP_ETH_LP = 0xf6a1284Dc2ce247Bca885ac4F36b37E91d3bD032;
    address private constant MOO_HOP_USDT_LP = 0x46034C63ad03254D6E96c655e82393E6C31E07C3;
    address private constant MOO_HOP_DAI_LP = 0xED8c1B73De6F006387f768fF024e33de378c0e25;
    address private constant MOO_GMX = 0x5B904f19fb9ccf493b623e5c8cE91603665788b0;

    // LPs
    address private constant HOP_ETH_LP = 0x59745774Ed5EfF903e615F5A2282Cae03484985a;
    address private constant HOP_USDT_LP = 0xCe3B19D820CB8B9ae370E423B0a329c4314335fE;
    address private constant HOP_DAI_LP = 0x68f5d998F00bB2460511021741D098c05721d8fF;
    address private constant GMX = 0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a;

    // ----- STAKE -----

    /**
      * Stakes HOP_ETH_LP in the Beefy protocol
      * @dev This function uses the redstone-evm-connector
      * @param amount amount of HOP_ETH_LP to be staked
    **/
    function stakeHopEthLpBeefy(uint256 amount) public onlyOwnerOrInsolvent nonReentrant recalculateAssetsExposure remainsSolvent {
        _stakeLpBeefy(IBeefyFinance.BeefyStakingDetails({
            lpTokenAddress: HOP_ETH_LP,
            vaultAddress: MOO_HOP_ETH_LP,
            lpTokenSymbol: "HOP_ETH_LP",
            vaultTokenSymbol: "MOO_HOP_ETH_LP",
            amount: amount
        }));
    }

    /**
      * Stakes HOP_USDT_LP in the Beefy protocol
      * @dev This function uses the redstone-evm-connector
      * @param amount amount of HOP_USDT_LP to be staked
    **/
    function stakeHopUsdtLpBeefy(uint256 amount) public onlyOwnerOrInsolvent nonReentrant recalculateAssetsExposure remainsSolvent {
        _stakeLpBeefy(IBeefyFinance.BeefyStakingDetails({
            lpTokenAddress: HOP_USDT_LP,
            vaultAddress: MOO_HOP_USDT_LP,
            lpTokenSymbol: "HOP_USDT_LP",
            vaultTokenSymbol: "MOO_HOP_USDT_LP",
            amount: amount
        }));
    }

    /**
      * Stakes HOP_DAI_LP in the Beefy protocol
      * @dev This function uses the redstone-evm-connector
      * @param amount amount of HOP_DAI_LP to be staked
    **/
    function stakeHopDaiLpBeefy(uint256 amount) public onlyOwnerOrInsolvent nonReentrant recalculateAssetsExposure remainsSolvent {
        _stakeLpBeefy(IBeefyFinance.BeefyStakingDetails({
            lpTokenAddress: HOP_DAI_LP,
            vaultAddress: MOO_HOP_DAI_LP,
            lpTokenSymbol: "HOP_DAI_LP",
            vaultTokenSymbol: "MOO_HOP_DAI_LP",
            amount: amount
        }));
    }

    /**
      * Stakes GMX in the Beefy protocol
      * @dev This function uses the redstone-evm-connector
      * @param amount amount of GMX to be staked
    **/
    function stakeGmxBeefy(uint256 amount) public onlyOwnerOrInsolvent nonReentrant recalculateAssetsExposure remainsSolvent {
        _stakeLpBeefy(IBeefyFinance.BeefyStakingDetails({
            lpTokenAddress: GMX,
            vaultAddress: MOO_GMX,
            lpTokenSymbol: "GMX",
            vaultTokenSymbol: "MOO_GMX",
            amount: amount
        }));
    }

    // ----- UNSTAKE -----

    /**
      * Unstakes HOP_ETH_LP from the Beefy protocol
      * @dev This function uses the redstone-evm-connector
      * @param amount amount of HOP_ETH_LP to be unstaked
    **/
    function unstakeHopEthLpBeefy(uint256 amount) public onlyOwnerOrInsolvent nonReentrant recalculateAssetsExposure remainsSolvent {
            _unstakeLpBeefy(IBeefyFinance.BeefyStakingDetails({
            lpTokenAddress: HOP_ETH_LP,
            vaultAddress: MOO_HOP_ETH_LP,
            lpTokenSymbol: "HOP_ETH_LP",
            vaultTokenSymbol: "MOO_HOP_ETH_LP",
            amount: amount
        }));
    }

    /**
      * Unstakes HOP_USDT_LP from the Beefy protocol
      * @dev This function uses the redstone-evm-connector
      * @param amount amount of HOP_USDT_LP to be unstaked
    **/
    function unstakeHopUsdtLpBeefy(uint256 amount) public onlyOwnerOrInsolvent nonReentrant recalculateAssetsExposure remainsSolvent {
        _unstakeLpBeefy(IBeefyFinance.BeefyStakingDetails({
            lpTokenAddress: HOP_USDT_LP,
            vaultAddress: MOO_HOP_USDT_LP,
            lpTokenSymbol: "HOP_USDT_LP",
            vaultTokenSymbol: "MOO_HOP_USDT_LP",
            amount: amount
        }));
    }

    /**
      * Untakes HOP_DAI_LP from the Beefy protocol
      * @dev This function uses the redstone-evm-connector
      * @param amount amount of HOP_DAI_LP to be unstaked
    **/
    function unstakeHopDaiLpBeefy(uint256 amount) public onlyOwnerOrInsolvent nonReentrant recalculateAssetsExposure remainsSolvent {
        _unstakeLpBeefy(IBeefyFinance.BeefyStakingDetails({
            lpTokenAddress: HOP_DAI_LP,
            vaultAddress: MOO_HOP_DAI_LP,
            lpTokenSymbol: "HOP_DAI_LP",
            vaultTokenSymbol: "MOO_HOP_DAI_LP",
            amount: amount
        }));
    }

    /**
      * Untakes GMX from the Beefy protocol
      * @dev This function uses the redstone-evm-connector
      * @param amount amount of GMX to be unstaked
    **/
    function unstakeGmxBeefy(uint256 amount) public onlyOwnerOrInsolvent nonReentrant recalculateAssetsExposure remainsSolvent {
        _unstakeLpBeefy(IBeefyFinance.BeefyStakingDetails({
            lpTokenAddress: GMX,
            vaultAddress: MOO_GMX,
            lpTokenSymbol: "GMX",
            vaultTokenSymbol: "MOO_GMX",
            amount: amount
        }));
    }

    // ----- PRIVATE METHODS -----

    /**
      * Stakes {stakingDetails.lpTokenAddress} LP token in the Beefy protocol
      * @dev This function uses the redstone-evm-connector
      * @param stakingDetails IBeefyFinance.BeefyStakingDetails staking details
    **/
    function _stakeLpBeefy(IBeefyFinance.BeefyStakingDetails memory stakingDetails) private {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        require(stakingDetails.amount > 0, "Cannot stake 0 tokens");
        // _ACTIVE = 2
        require(tokenManager.tokenToStatus(stakingDetails.lpTokenAddress) == 2, "LP token not supported");
        require(tokenManager.tokenToStatus(stakingDetails.vaultAddress) == 2, "Vault token not supported");
        require(IERC20(stakingDetails.lpTokenAddress).balanceOf(address(this)) >= stakingDetails.amount, "Not enough LP token available");

        stakingDetails.lpTokenAddress.safeApprove(stakingDetails.vaultAddress, 0);
        stakingDetails.lpTokenAddress.safeApprove(stakingDetails.vaultAddress, stakingDetails.amount);

        IBeefyFinance vaultContract = IBeefyFinance(stakingDetails.vaultAddress);

        vaultContract.deposit(stakingDetails.amount);

        // Add/remove owned tokens
        if(vaultContract.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset(stakingDetails.vaultTokenSymbol, stakingDetails.vaultAddress);
        }
        if(IERC20(stakingDetails.lpTokenAddress).balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(stakingDetails.lpTokenSymbol);
        }

        emit Staked(msg.sender, stakingDetails.lpTokenSymbol, stakingDetails.vaultAddress, stakingDetails.amount, block.timestamp);
    }

    /**
     * Unstakes {stakingDetails.lpTokenAddress} LP token in the Beefy protocol
     * @dev This function uses the redstone-evm-connector
     * @param stakingDetails IBeefyFinance.BeefyStakingDetails staking details
    **/
    function _unstakeLpBeefy(IBeefyFinance.BeefyStakingDetails memory stakingDetails) private {
        IBeefyFinance vaultContract = IBeefyFinance(stakingDetails.vaultAddress);
        uint256 initialStakedBalance = vaultContract.balanceOf(address(this));

        require(initialStakedBalance >= stakingDetails.amount, "Cannot unstake more than was initially staked");

        vaultContract.withdraw(stakingDetails.amount);

        // Add/remove owned tokens
        if(IERC20(stakingDetails.lpTokenAddress).balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset(stakingDetails.lpTokenSymbol, stakingDetails.lpTokenAddress);
        }
        if(vaultContract.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(stakingDetails.vaultTokenSymbol);
        }

        emit Unstaked(msg.sender, stakingDetails.lpTokenSymbol, stakingDetails.vaultAddress, stakingDetails.amount, block.timestamp);
    }


    /* ========== RECEIVE AVAX FUNCTION ========== */
    receive() external payable {}

    /**
        * @dev emitted when user stakes an asset
        * @param user the address executing staking
        * @param asset the asset that was staked
        * @param vault address of the vault token
        * @param amount of the asset that was staked
        * @param timestamp of staking
    **/
    event Staked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 amount, uint256 timestamp);

    /**
        * @dev emitted when user unstakes an asset
        * @param user the address executing unstaking
        * @param asset the asset that was unstaked
        * @param vault address of the vault token
        * @param amount of the asset that was unstaked
        * @param timestamp of unstaking
    **/
    event Unstaked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 amount, uint256 timestamp);
}