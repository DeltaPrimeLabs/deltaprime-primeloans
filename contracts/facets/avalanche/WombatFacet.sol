// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "../../ReentrancyGuardKeccak.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../interfaces/facets/avalanche/IWombatPool.sol";
import "../../interfaces/facets/avalanche/IWombatMaster.sol";
import "../../interfaces/facets/avalanche/IWombatRouter.sol";
import "../../interfaces/facets/avalanche/IRewarder.sol";
import "../../interfaces/IStakingPositions.sol";
import "../../interfaces/IWrappedNativeToken.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract WombatFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address;

    address public constant WOM_TOKEN =
        0xa15E4544D141aa98C4581a1EA10Eb9048c3b3382;
    address public constant WOMBAT_ROUTER =
        0x4A88C44B8D9B9f3F2BA4D97236F737CF03DF76CD;
    address public constant WOMBAT_MASTER =
        0x6521a549834F5E6d253CD2e5F4fbe4048f86cd7b;
    address public constant sAVAX_AVAX_POOL =
        0xE3Abc29B035874a9f6dCDB06f8F20d9975069D87;
    address public constant ggAVAX_AVAX_POOL =
        0xBbA43749efC1bC29eA434d88ebaf8A97DC7aEB77;
    bytes32 public constant WOMBAT_ggAVAX_AVAX_LP_AVAX =
        "WOMBAT_ggAVAX_AVAX_LP_AVAX";
    bytes32 public constant WOMBAT_ggAVAX_AVAX_LP_ggAVAX =
        "WOMBAT_ggAVAX_AVAX_LP_ggAVAX";
    bytes32 public constant WOMBAT_sAVAX_AVAX_LP_AVAX =
        "WOMBAT_sAVAX_AVAX_LP_AVAX";
    bytes32 public constant WOMBAT_sAVAX_AVAX_LP_sAVAX =
        "WOMBAT_sAVAX_AVAX_LP_sAVAX";

    function depositSavaxToAvaxSavax(uint256 amount, uint256 minLpOut) external {
        _depositToken(
            "sAVAX",
            WOMBAT_sAVAX_AVAX_LP_sAVAX,
            sAVAX_AVAX_POOL,
            amount,
            minLpOut,
            this.sAvaxBalanceAvaxSavax.selector,
            this.withdrawSavaxFromAvaxSavax.selector
        );
    }

    function withdrawSavaxFromAvaxSavax(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        return
            _withdrawToken(
                "sAVAX",
                WOMBAT_sAVAX_AVAX_LP_sAVAX,
                sAVAX_AVAX_POOL,
                amount,
                minOut
            );
    }

    function sAvaxBalanceAvaxSavax()
        external
        view
        returns (uint256 _stakedBalance)
    {
        return getLpTokenBalance(WOMBAT_sAVAX_AVAX_LP_sAVAX);
    }

    function depositGgavaxToAvaxGgavax(
        uint256 amount,
        uint256 minLpOut
    ) external {
        _depositToken(
            "ggAVAX",
            WOMBAT_ggAVAX_AVAX_LP_ggAVAX,
            ggAVAX_AVAX_POOL,
            amount,
            minLpOut,
            this.ggAvaxBalanceAvaxGgavax.selector,
            this.withdrawGgavaxFromAvaxGgavax.selector
        );
    }

    function withdrawGgavaxFromAvaxGgavax(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        return
            _withdrawToken(
                "ggAVAX",
                WOMBAT_ggAVAX_AVAX_LP_ggAVAX,
                ggAVAX_AVAX_POOL,
                amount,
                minOut
            );
    }

    function ggAvaxBalanceAvaxGgavax()
        external
        view
        returns (uint256 _stakedBalance)
    {
        return getLpTokenBalance(WOMBAT_ggAVAX_AVAX_LP_ggAVAX);
    }

    function depositAvaxToAvaxSavax(uint256 amount, uint256 minLpOut) external {
        _depositNative(
            WOMBAT_sAVAX_AVAX_LP_AVAX,
            sAVAX_AVAX_POOL,
            amount,
            minLpOut,
            this.avaxBalanceAvaxSavax.selector,
            this.withdrawAvaxFromAvaxSavax.selector
        );
    }

    function withdrawAvaxFromAvaxSavax(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        return
            _withdrawNative(
                WOMBAT_sAVAX_AVAX_LP_AVAX,
                sAVAX_AVAX_POOL,
                amount,
                minOut
            );
    }

    function avaxBalanceAvaxSavax()
        external
        view
        returns (uint256 _stakedBalance)
    {
        return getLpTokenBalance(WOMBAT_sAVAX_AVAX_LP_AVAX);
    }

    function depositAvaxToAvaxGgavax(uint256 amount, uint256 minLpOut) external {
        _depositNative(
            WOMBAT_ggAVAX_AVAX_LP_AVAX,
            ggAVAX_AVAX_POOL,
            amount,
            minLpOut,
            this.avaxBalanceAvaxGgavax.selector,
            this.withdrawAvaxFromAvaxGgavax.selector
        );
    }

    function withdrawAvaxFromAvaxGgavax(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        return
            _withdrawNative(
                WOMBAT_ggAVAX_AVAX_LP_AVAX,
                ggAVAX_AVAX_POOL,
                amount,
                minOut
            );
    }

    function avaxBalanceAvaxGgavax()
        external
        view
        returns (uint256 _stakedBalance)
    {
        return getLpTokenBalance(WOMBAT_ggAVAX_AVAX_LP_AVAX);
    }

    function depositAvaxSavaxSavaxLp(uint256 amount) external {
        _depositAndStakeWombatLP(
            WOMBAT_sAVAX_AVAX_LP_sAVAX,
            amount,
            this.sAvaxBalanceAvaxSavax.selector,
            this.withdrawAvaxSavaxSavaxLp.selector
        );
    }

    function withdrawAvaxSavaxSavaxLp(
        uint256 amount
    ) external returns (uint256 amountOut) {
        return _unstakeAndWithdrawWombatLP(WOMBAT_sAVAX_AVAX_LP_sAVAX, amount);
    }

    function depositAvaxSavaxAvaxLp(uint256 amount) external {
        _depositAndStakeWombatLP(
            WOMBAT_sAVAX_AVAX_LP_AVAX,
            amount,
            this.avaxBalanceAvaxSavax.selector,
            this.withdrawAvaxSavaxAvaxLp.selector
        );
    }

    function withdrawAvaxSavaxAvaxLp(
        uint256 amount
    ) external returns (uint256 amountOut) {
        return _unstakeAndWithdrawWombatLP(WOMBAT_sAVAX_AVAX_LP_AVAX, amount);
    }

    function depositAvaxGgavaxGgavaxLp(uint256 amount) external {
        _depositAndStakeWombatLP(
            WOMBAT_ggAVAX_AVAX_LP_ggAVAX,
            amount,
            this.ggAvaxBalanceAvaxGgavax.selector,
            this.withdrawAvaxGgavaxGgavaxLp.selector
        );
    }

    function withdrawAvaxGgavaxGgavaxLp(
        uint256 amount
    ) external returns (uint256 amountOut) {
        return _unstakeAndWithdrawWombatLP(WOMBAT_ggAVAX_AVAX_LP_ggAVAX, amount);
    }

    function depositAvaxGgavaxAvaxLp(uint256 amount) external {
        _depositAndStakeWombatLP(
            WOMBAT_ggAVAX_AVAX_LP_AVAX,
            amount,
            this.avaxBalanceAvaxGgavax.selector,
            this.withdrawAvaxGgavaxAvaxLp.selector
        );
    }

    function withdrawAvaxGgavaxAvaxLp(
        uint256 amount
    ) external returns (uint256 amountOut) {
        return _unstakeAndWithdrawWombatLP(WOMBAT_ggAVAX_AVAX_LP_AVAX, amount);
    }

    function _depositToken(
        bytes32 stakeAsset,
        bytes32 lpAsset,
        address pool,
        uint256 amount,
        uint256 minLpOut,
        bytes4 balanceSelector,
        bytes4 unstakeSelector
    ) internal onlyOwner nonReentrant remainsSolvent {
        IERC20Metadata stakeToken = getERC20TokenInstance(stakeAsset, false);
        IERC20Metadata lpToken = getERC20TokenInstance(lpAsset, false);

        amount = Math.min(stakeToken.balanceOf(address(this)), amount);
        require(amount > 0, "Cannot deposit 0 tokens");

        address(stakeToken).safeApprove(pool, 0);
        address(stakeToken).safeApprove(pool, amount);

        uint256 lpOut = IWombatPool(pool).deposit(
            address(stakeToken),
            amount,
            minLpOut,
            address(this),
            block.timestamp,
            true
        );

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _decreaseExposure(tokenManager, address(stakeToken), amount);

        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: address(lpToken),
                symbol: lpAsset,
                identifier: lpAsset,
                balanceSelector: balanceSelector,
                unstakeSelector: unstakeSelector
            });
        DiamondStorageLib.addStakedPosition(position);
    }

    function _withdrawToken(
        bytes32 stakeAsset,
        bytes32 lpAsset,
        address pool,
        uint256 amount,
        uint256 minOut
    ) internal onlyOwner nonReentrant remainsSolvent returns (uint256 amountOut) {
        IERC20Metadata unstakeToken = getERC20TokenInstance(stakeAsset, false);
        IERC20Metadata lpToken = getERC20TokenInstance(lpAsset, false);
        uint256 pid = IWombatMaster(WOMBAT_MASTER).getAssetPid(address(lpToken));

        amount = Math.min(amount, getLpTokenBalance(lpAsset));
        require(amount > 0, "Cannot withdraw 0 tokens");

        (uint256 reward, uint256[] memory additionalRewards) = IWombatMaster(
            WOMBAT_MASTER
        ).withdraw(pid, amount);

        address(lpToken).safeApprove(pool, 0);
        address(lpToken).safeApprove(pool, amount);

        amountOut = IWombatPool(pool).withdraw(
            address(unstakeToken),
            amount,
            minOut,
            address(this),
            block.timestamp
        );

        if (getLpTokenBalance(lpAsset) == 0) {
            DiamondStorageLib.removeStakedPosition(lpAsset);
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _increaseExposure(tokenManager, address(unstakeToken), amountOut);
        handleRewards(pid, reward, additionalRewards);
    }

    function _depositNative(
        bytes32 lpAsset,
        address pool,
        uint256 amount,
        uint256 minLpOut,
        bytes4 balanceSelector,
        bytes4 unstakeSelector
    ) internal onlyOwner nonReentrant remainsSolvent {
        IWrappedNativeToken wrapped = IWrappedNativeToken(
            DeploymentConstants.getNativeToken()
        );
        IERC20Metadata lpToken = getERC20TokenInstance(lpAsset, false);

        amount = Math.min(wrapped.balanceOf(address(this)), amount);
        require(amount > 0, "Cannot deposit 0 tokens");

        wrapped.withdraw(amount);

        uint256 lpOut = IWombatRouter(WOMBAT_ROUTER).addLiquidityNative{
            value: amount
        }(pool, minLpOut, address(this), block.timestamp, true);

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _decreaseExposure(tokenManager, address(wrapped), amount);

        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: address(lpToken),
                symbol: lpAsset,
                identifier: lpAsset,
                balanceSelector: balanceSelector,
                unstakeSelector: unstakeSelector
            });
        DiamondStorageLib.addStakedPosition(position);
    }

    function _withdrawNative(
        bytes32 lpAsset,
        address pool,
        uint256 amount,
        uint256 minOut
    ) internal onlyOwner nonReentrant remainsSolvent returns (uint256 amountOut) {
        IWrappedNativeToken wrapped = IWrappedNativeToken(
            DeploymentConstants.getNativeToken()
        );
        IERC20Metadata lpToken = getERC20TokenInstance(lpAsset, false);
        uint256 pid = IWombatMaster(WOMBAT_MASTER).getAssetPid(address(lpToken));

        amount = Math.min(amount, getLpTokenBalance(lpAsset));
        require(amount > 0, "Cannot withdraw 0 tokens");

        (uint256 reward, uint256[] memory additionalRewards) = IWombatMaster(
            WOMBAT_MASTER
        ).withdraw(pid, amount);

        address(lpToken).safeApprove(WOMBAT_ROUTER, 0);
        address(lpToken).safeApprove(WOMBAT_ROUTER, amount);

        amountOut = IWombatRouter(WOMBAT_ROUTER).removeLiquidityNative(
            pool,
            amount,
            minOut,
            address(this),
            block.timestamp
        );

        wrapped.deposit{value: amountOut}();

        if (getLpTokenBalance(lpAsset) == 0) {
            DiamondStorageLib.removeStakedPosition(lpAsset);
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _increaseExposure(tokenManager, address(wrapped), amountOut);
        handleRewards(pid, reward, additionalRewards);
    }

    function _depositAndStakeWombatLP(
        bytes32 lpAsset,
        uint256 amount,
        bytes4 balanceSelector,
        bytes4 unstakeSelector
    ) internal onlyOwner nonReentrant remainsSolvent {
        IERC20Metadata lpToken = getERC20TokenInstance(lpAsset, false);

        amount = Math.min(amount, lpToken.balanceOf(msg.sender));
        require(amount > 0, "Cannot deposit 0 tokens");

        address(lpToken).safeTransferFrom(msg.sender, address(this), amount);

        address(lpToken).safeApprove(WOMBAT_MASTER, 0);
        address(lpToken).safeApprove(WOMBAT_MASTER, amount);

        uint256 pid = IWombatMaster(WOMBAT_MASTER).getAssetPid(address(lpToken));

        IWombatMaster(WOMBAT_MASTER).deposit(pid, amount);

        IStakingPositions.StakedPosition memory position = IStakingPositions
            .StakedPosition({
                asset: address(lpToken),
                symbol: lpAsset,
                identifier: lpAsset,
                balanceSelector: balanceSelector,
                unstakeSelector: unstakeSelector
            });
        DiamondStorageLib.addStakedPosition(position);
    }

    function _unstakeAndWithdrawWombatLP(
        bytes32 lpAsset,
        uint256 amount
    ) internal onlyOwner nonReentrant remainsSolvent returns (uint256 amountOut) {
        IERC20Metadata lpToken = getERC20TokenInstance(lpAsset, false);
        uint256 pid = IWombatMaster(WOMBAT_MASTER).getAssetPid(address(lpToken));

        amount = Math.min(amount, getLpTokenBalance(lpAsset));
        require(amount > 0, "Cannot withdraw 0 tokens");

        (uint256 reward, uint256[] memory additionalRewards) = IWombatMaster(
            WOMBAT_MASTER
        ).withdraw(pid, amount);

        address(lpToken).safeTransfer(msg.sender, amount);

        if (getLpTokenBalance(lpAsset) == 0) {
            DiamondStorageLib.removeStakedPosition(lpAsset);
        }

        handleRewards(pid, reward, additionalRewards);

        return amount;
    }

    function handleRewards(
        uint256 pid,
        uint256 reward,
        uint256[] memory additionalRewards
    ) internal {
        (, , address rewarder, , , , ) = IWombatMaster(WOMBAT_MASTER).poolInfo(pid);
        address boostedRewarder = IWombatMaster(WOMBAT_MASTER).boostedRewarders(
            pid
        );
        address owner = DiamondStorageLib.contractOwner();
        address(WOM_TOKEN).safeTransfer(owner, reward);
        uint256 baseIdx;
        if (rewarder != address(0)) {
            address[] memory rewardTokens = IRewarder(rewarder).rewardTokens();
            baseIdx = rewardTokens.length;
            for (uint256 i; i != baseIdx; ++i) {
                if (additionalRewards[i] > 0) {
                    address(rewardTokens[i]).safeTransfer(owner, additionalRewards[i]);
                }
            }
        }
        if (boostedRewarder != address(0)) {
            address[] memory rewardTokens = IRewarder(boostedRewarder).rewardTokens();
            for (uint256 i; i != rewardTokens.length; ++i) {
                if (additionalRewards[baseIdx + i] > 0) {
                    address(rewardTokens[i]).safeTransfer(
                        owner,
                        additionalRewards[baseIdx + i]
                    );
                }
            }
        }
    }

    function getLpTokenBalance(bytes32 asset) internal view returns (uint256) {
        IERC20Metadata lpToken = getERC20TokenInstance(asset, false);
        uint256 pid = IWombatMaster(WOMBAT_MASTER).getAssetPid(address(lpToken));
        IWombatMaster.UserInfo memory userInfo = IWombatMaster(WOMBAT_MASTER)
            .userInfo(pid, address(this));
        return userInfo.amount;
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /* ========== RECEIVE AVAX FUNCTION ========== */
    receive() external payable {}
}
