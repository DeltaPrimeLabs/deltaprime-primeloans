// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 799a1765b64edc5c158198ef84f785af79e234ae;
pragma solidity 0.8.17;

import "../../ReentrancyGuardKeccak.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/joe-v2/ILBRouter.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract TraderJoeV2Facet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {

    address private constant JOE_V2_ROUTER_ADDRESS = 0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30;

    //TODO: keccak? sls?
    TraderJoeV2Bin[] storage private ownedTraderJoeV2Bins;

    function getOwnedTraderJoeV2Bins() external view returns (TraderJoeV2Bin[]) {
        return ownedTraderJoeV2Bins;
    }

    function addLiquidityTraderJoeV2(
        IERC20 _tokenX,
        IERC20 _tokenY,
        uint256 _binStep,
        uint256 _amountX,
        uint256 _amountY,
        uint256 _amountXMin,
        uint256 _amountYMin,
        uint256 _activeIdDesired,
        uint256 _idSlippage,
        int256[] _deltaIds,
        uint256[] _distributionX,
        uint256[] _distributionY,
        uint256 _deadline
    ) external nonReentrant onlyOwner noBorrowInTheSameBlock recalculateAssetsExposure remainsSolvent{
        LiquidityParameters liquidityParameters = LiquidityParameters(
            _tokenX,
            _tokenY,
            _binStep,
            _amountX,
            _amountY,
            _amountXMin,
            _amountYMin,
            _activeIdDesired,
            _idSlippage,
            _deltaIds,
            _distributionX,
            _distributionY,
            address(this),
            address(this),
            _deadline
        );

        ILBRouter traderJoeV2Router = ILBRouter(JOE_V2_ROUTER_ADDRESS);

        (
            uint256 amountXAdded,
            uint256 amountYAdded,
            uint256 amountXLeft,
            uint256 amountYLeft,
            uint256[] memory depositIds,
            uint256[] memory liquidityMinted
        ) = traderJoeV2Router.addLiquidity(liquidityParameters);

        ILBFactory lbFactory = traderJoeV2Router.getFactory();
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        for (uint256 i; i < depositIds.length; i++) {
            ILBPair pair = lbFactory.getLBPairInformation(_tokenX, _tokenY, _binStep);

            ownedTraderJoeV2Bins.push(TraderJoeV2Bin(pair, depositIds[i]));

            //TODO: proposal
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(_tokenX), _tokenX);
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(_tokenY), _tokenY);
        }
    }
}
