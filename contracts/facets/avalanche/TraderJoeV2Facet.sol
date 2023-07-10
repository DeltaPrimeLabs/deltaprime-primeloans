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

    function getOwnedBins() internal view returns (TraderJoeV2Bin[] storage result){
        bytes32 slot = OWNED_TRADERJOE_V2_BINS_SLOT;
        assembly{
            result.slot := sload(slot)
        }
    }

    function getOwnedTraderJoeV2Bins() public view returns (TraderJoeV2Bin[] memory result){
        return getOwnedBins();
    }

    function addLiquidityTraderJoeV2(ILBRouter.LiquidityParameters memory liquidityParameters) external nonReentrant onlyOwner noBorrowInTheSameBlock recalculateAssetsExposure remainsSolvent {
        ILBRouter traderJoeV2Router = ILBRouter(JOE_V2_ROUTER_ADDRESS);
        TraderJoeV2Bin[] memory ownedBins = getOwnedBins();

        liquidityParameters.to = address(this);
        liquidityParameters.refundTo = address(this);

        address(liquidityParameters.tokenX).safeApprove(address(traderJoeV2Router), liquidityParameters.amountX);
        address(liquidityParameters.tokenY).safeApprove(address(traderJoeV2Router), liquidityParameters.amountY);

        (,,,,uint256[] memory depositIds,) = traderJoeV2Router.addLiquidity(liquidityParameters);

        ILBFactory lbFactory = traderJoeV2Router.getFactory();
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        for (uint256 i; i < depositIds.length; ++i) {
            ILBFactory.LBPairInformation memory pairInfo = lbFactory.getLBPairInformation(liquidityParameters.tokenX, liquidityParameters.tokenY, liquidityParameters.binStep);

            bool userHadBin;

            for (int256 j; uint(j) < ownedBins.length; ++j) {
                if (address(ownedBins[uint(j)].pair) == address(pairInfo.LBPair)
                && ownedBins[uint(j)].id == depositIds[i]
                ) {
                    userHadBin = true;
                    break;
                }
            }

            if (!userHadBin) {
                getOwnedBins().push(TraderJoeV2Bin(pairInfo.LBPair, uint24(depositIds[i])));
            }
        }
    }

    function removeLiquidityTraderJoeV2(RemoveLiquidityParameters memory parameters) external nonReentrant onlyOwnerOrInsolvent noBorrowInTheSameBlock recalculateAssetsExposure remainsSolvent {
        ILBRouter traderJoeV2Router = ILBRouter(JOE_V2_ROUTER_ADDRESS);

        ILBPair(traderJoeV2Router.getFactory().getLBPairInformation(parameters.tokenX, parameters.tokenY, parameters.binStep).LBPair).approveForAll(address(traderJoeV2Router), true);

        traderJoeV2Router.removeLiquidity(
            parameters.tokenX, parameters.tokenY, parameters.binStep, parameters.amountXMin, parameters.amountYMin, parameters.ids, parameters.amounts, address(this), parameters.deadline
        );

        ILBFactory lbFactory = traderJoeV2Router.getFactory();
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        ILBFactory.LBPairInformation memory pairInfo = lbFactory.getLBPairInformation(parameters.tokenX, parameters.tokenY, parameters.binStep);

        TraderJoeV2Bin storage bin;

        for (int256 i; uint(i) < getOwnedBins().length; i++) {
            if (address(getOwnedBins()[uint(i)].pair) == address(pairInfo.LBPair)) {
                bin = getOwnedBins()[uint(i)];

                if (bin.pair.balanceOf(address(this), bin.id) == 0) {
                    getOwnedBins()[uint(i)] = getOwnedBins()[getOwnedBins().length - 1];
                    i--;
                    getOwnedBins().pop();
                }

                break;
            }
        }
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }
}