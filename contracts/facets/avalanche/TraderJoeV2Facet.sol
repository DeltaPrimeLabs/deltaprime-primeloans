// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "../../ReentrancyGuardKeccak.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/joe-v2/ILBRouter.sol";
import "../../interfaces/joe-v2/ILBFactory.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract TraderJoeV2Facet is ITraderJoeV2Facet, ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {

    using TransferHelper for address;

    address private constant JOE_V2_ROUTER_ADDRESS = 0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30;

    bytes32 internal constant OWNED_TRADERJOE_V2_BINS_SLOT = bytes32(uint256(keccak256('TRADERJOE_V2_BINS_1685370112')) - 1);

    function getOwnedTraderJoeV2Bins() internal view returns (TraderJoeV2Bin[] storage result){
        bytes32 slot = OWNED_TRADERJOE_V2_BINS_SLOT;
        assembly{
            result.slot := sload(slot)
        }
    }

    function addLiquidityTraderJoeV2(ILBRouter.LiquidityParameters memory liquidityParameters) external nonReentrant onlyOwner noBorrowInTheSameBlock recalculateAssetsExposure remainsSolvent {
        ILBRouter traderJoeV2Router = ILBRouter(JOE_V2_ROUTER_ADDRESS);

        liquidityParameters.to = address(this);
        liquidityParameters.refundTo = address(this);

        address(liquidityParameters.tokenX).safeApprove(address(traderJoeV2Router), liquidityParameters.amountX);
        address(liquidityParameters.tokenY).safeApprove(address(traderJoeV2Router), liquidityParameters.amountY);

        (,,,,uint256[] memory depositIds,) = traderJoeV2Router.addLiquidity(liquidityParameters);

        ILBFactory lbFactory = traderJoeV2Router.getFactory();
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        for (uint256 i; i < depositIds.length; i++) {
            ILBFactory.LBPairInformation memory pairInfo = lbFactory.getLBPairInformation(liquidityParameters.tokenX, liquidityParameters.tokenY, liquidityParameters.binStep);

            getOwnedTraderJoeV2Bins().push(TraderJoeV2Bin(pairInfo.LBPair, uint24(depositIds[i])));
        }
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }
}
