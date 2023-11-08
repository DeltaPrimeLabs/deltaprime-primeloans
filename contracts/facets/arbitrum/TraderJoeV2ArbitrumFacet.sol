// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "../../ReentrancyGuardKeccak.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/joe-v2/ILBRouter.sol";
import "../../interfaces/joe-v2/ILBFactory.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract TraderJoeV2ArbitrumFacet is ITraderJoeV2Facet, ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {

    using TransferHelper for address;


    function getJoeV2RouterAddress() public view virtual returns (address){
        return 0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30;
    }

    function getOwnedTraderJoeV2Bins() public view returns (TraderJoeV2Bin[] memory result){
        return DiamondStorageLib.getTjV2OwnedBinsView();
    }

    function getOwnedTraderJoeV2BinsStorage() internal returns (TraderJoeV2Bin[] storage result){
        return DiamondStorageLib.getTjV2OwnedBins();
    }

    function getWhitelistedTraderJoeV2Pairs() internal view virtual returns (ILBPair[11] memory pools){
        return [
            // TJLB_DAI_USDCe
            ILBPair(0x500173F418137090dad96421811147b63b448A0f),
            // TJLB_ETH_USDT
            ILBPair(0xd387c40a72703B38A5181573724bcaF2Ce6038a5),
            // TJLB_ETH_USDCe
            ILBPair(0x94d53BE52706a155d27440C4a2434BEa772a6f7C),
            // TJLB_ARB_ETH
            ILBPair(0x0Be4aC7dA6cd4bAD60d96FbC6d091e1098aFA358),
            // TJLB_BTC_ETH
            ILBPair(0xcfA09B20c85933B197e8901226ad0D6dACa7f114),
            // TJLB_GMX_ETH
            ILBPair(0x60563686ca7b668e4a2d7D31448e5F10456ecaF8),
            // TJLB_WOO_ETH
            ILBPair(0xB87495219C432fc85161e4283DfF131692A528BD),
            // TJLB_JOE_ETH
            ILBPair(0x4b9bfeD1dD4E6780454b2B02213788f31FfBA74a),
            // TJLB_USDT_USDCe
            ILBPair(0x0242DD3b2e792CdBD399cc6195951bC202Aee97B),
            // TJLB_ETH_USDC
            ILBPair(0x69f1216cB2905bf0852f74624D5Fa7b5FC4dA710),
            // TJLB_GRAIL_ETH
            ILBPair(0x461761f2848EC6B9Fb3D3fb031e112c7d5b89563)
        ];
    }

    function isPairWhitelisted(address pair) internal view virtual returns (bool){
        ILBPair[11] memory pairs = getWhitelistedTraderJoeV2Pairs();

        for (uint i; i < pairs.length; ++i) {
            if (pair == address(pairs[i])) return true;
        }
        return false;
    }

    function fundLiquidityTraderJoeV2(ILBPair pair, uint256[] memory ids, uint256[] memory amounts) external nonReentrant {
        if (!isPairWhitelisted(address(pair))) revert TraderJoeV2PoolNotWhitelisted();

        pair.batchTransferFrom(msg.sender, address(this), ids, amounts);

        TraderJoeV2Bin[] memory ownedBins = getOwnedTraderJoeV2Bins();

        for (uint256 i; i < ids.length; ++i) {
            bool userHadBin;

            for (int256 j; uint(j) < ownedBins.length; ++j) {
                if (address(ownedBins[uint(j)].pair) == address(pair)
                    && ownedBins[uint(j)].id == ids[i]
                ) {
                    userHadBin = true;
                    break;
                }
            }

            if (!userHadBin) {
                getOwnedTraderJoeV2BinsStorage().push(TraderJoeV2Bin(pair, uint24(ids[i])));
            }
        }

        emit FundedLiquidityTraderJoeV2(msg.sender, address(pair), ids, amounts, block.timestamp);
    }


    function withdrawLiquidityTraderJoeV2(ILBPair pair, uint256[] memory ids, uint256[] memory amounts) external nonReentrant onlyOwner canRepayDebtFully noBorrowInTheSameBlock remainsSolvent {
        if (!isPairWhitelisted(address(pair))) revert TraderJoeV2PoolNotWhitelisted();

        pair.batchTransferFrom(address(this), msg.sender, ids, amounts);

        TraderJoeV2Bin[] storage binsStorage = getOwnedTraderJoeV2BinsStorage();
        TraderJoeV2Bin storage bin;

        for (int256 i; uint(i) < binsStorage.length; i++) {
            if (address(binsStorage[uint(i)].pair) == address(pair)) {
                bin = binsStorage[uint(i)];

                if (bin.pair.balanceOf(address(this), bin.id) == 0) {
                    binsStorage[uint(i)] = binsStorage[binsStorage.length - 1];
                    i--;
                    binsStorage.pop();
                }
            }
        }

        emit WithdrawnLiquidityTraderJoeV2(msg.sender, address(pair), ids, amounts, block.timestamp);
    }


    function addLiquidityTraderJoeV2(ILBRouter.LiquidityParameters memory liquidityParameters) external nonReentrant onlyOwner noBorrowInTheSameBlock remainsSolvent {
        ILBRouter traderJoeV2Router = ILBRouter(getJoeV2RouterAddress());
        TraderJoeV2Bin[] memory ownedBins = getOwnedTraderJoeV2Bins();
        ILBFactory lbFactory = traderJoeV2Router.getFactory();
        ILBFactory.LBPairInformation memory pairInfo = lbFactory.getLBPairInformation(liquidityParameters.tokenX, liquidityParameters.tokenY, liquidityParameters.binStep);

        if (!isPairWhitelisted(address(pairInfo.LBPair))) revert TraderJoeV2PoolNotWhitelisted();

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        bytes32 tokenX = tokenManager.tokenAddressToSymbol(address(liquidityParameters.tokenX));
        bytes32 tokenY = tokenManager.tokenAddressToSymbol(address(liquidityParameters.tokenY));

        liquidityParameters.to = address(this);
        liquidityParameters.refundTo = address(this);

        address(liquidityParameters.tokenX).safeApprove(address(traderJoeV2Router), 0);
        address(liquidityParameters.tokenY).safeApprove(address(traderJoeV2Router), 0);

        address(liquidityParameters.tokenX).safeApprove(address(traderJoeV2Router), liquidityParameters.amountX);
        address(liquidityParameters.tokenY).safeApprove(address(traderJoeV2Router), liquidityParameters.amountY);

        (uint256 amountXAdded,uint256 amountYAdded,,,uint256[] memory depositIds, uint256[] memory liquidityMinted) = traderJoeV2Router.addLiquidity(liquidityParameters);

        for (uint256 i; i < depositIds.length; ++i) {
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
                getOwnedTraderJoeV2BinsStorage().push(TraderJoeV2Bin(pairInfo.LBPair, uint24(depositIds[i])));
            }
        }

        if (liquidityParameters.tokenX.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(tokenX);
        }

        if (liquidityParameters.tokenY.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(tokenY);
        }

        emit AddLiquidityTraderJoeV2(msg.sender, address(pairInfo.LBPair), depositIds, liquidityMinted, tokenX, tokenY, amountXAdded, amountYAdded, block.timestamp);
    }

    function removeLiquidityTraderJoeV2(RemoveLiquidityParameters memory parameters) external nonReentrant onlyOwnerOrInsolvent noBorrowInTheSameBlock {
        ILBRouter traderJoeV2Router = ILBRouter(getJoeV2RouterAddress());

        ILBPair(traderJoeV2Router.getFactory().getLBPairInformation(parameters.tokenX, parameters.tokenY, parameters.binStep).LBPair).approveForAll(address(traderJoeV2Router), true);

        traderJoeV2Router.removeLiquidity(
            parameters.tokenX, parameters.tokenY, parameters.binStep, parameters.amountXMin, parameters.amountYMin, parameters.ids, parameters.amounts, address(this), parameters.deadline
        );

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        ILBFactory lbFactory = traderJoeV2Router.getFactory();

        ILBFactory.LBPairInformation memory pairInfo = lbFactory.getLBPairInformation(parameters.tokenX, parameters.tokenY, parameters.binStep);

        TraderJoeV2Bin storage bin;
        TraderJoeV2Bin[] storage binsStorage = getOwnedTraderJoeV2BinsStorage();

        for (int256 i; uint(i) < binsStorage.length; i++) {
            if (address(binsStorage[uint(i)].pair) == address(pairInfo.LBPair)) {
                bin = binsStorage[uint(i)];

                if (bin.pair.balanceOf(address(this), bin.id) == 0) {
                    binsStorage[uint(i)] = binsStorage[binsStorage.length - 1];
                    i--;
                    binsStorage.pop();
                }
            }
        }


        bytes32 tokenX = tokenManager.tokenAddressToSymbol(address(parameters.tokenX));
        bytes32 tokenY = tokenManager.tokenAddressToSymbol(address(parameters.tokenY));

        if (parameters.tokenX.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset(tokenX, address(parameters.tokenX));
        }

        if (parameters.tokenY.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset(tokenY, address(parameters.tokenY));
        }

        emit RemoveLiquidityTraderJoeV2(msg.sender, address(pairInfo.LBPair), parameters.ids, parameters.amounts, tokenX, tokenY, block.timestamp);

    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /**
     * @dev emitted after adding liquidity to TraderJoe V2
     * @param user the address of user providing liquidity
     * @param pair TraderJoe V2 pair
     * @param binIds the ids of bin
     * @param liquidityMinted amount of liquidity minted per bin
     * @param firstAsset first asset provided for liquidity
     * @param secondAsset second asset provided for liquidity
     * @param firstAmount amount of the first asset used
     * @param secondAmount amount of the second asset used
     * @param timestamp time of the transaction
     **/
    event AddLiquidityTraderJoeV2(address indexed user, address indexed pair, uint256[] binIds, uint[] liquidityMinted, bytes32 firstAsset, bytes32 secondAsset, uint firstAmount, uint secondAmount, uint256 timestamp);

    /**
     * @dev emitted after removing liquidity from TraderJoe V2
     * @param user the address of user removing liquidity
     * @param pair TraderJoe V2 pair
     * @param binIds the ids of bin
     * @param amounts The list of amounts to burn of each id in binIds
     * @param firstAsset first asset provided for liquidity
     * @param secondAsset second asset provided for liquidity
     * @param timestamp time of the transaction
     **/
    event RemoveLiquidityTraderJoeV2(address indexed user, address indexed pair, uint256[] binIds, uint[] amounts, bytes32 firstAsset, bytes32 secondAsset, uint256 timestamp);

    /**
     * @dev emitted after funding account with TraderJoe V2 LB tokens
     * @param user the address of user removing liquidity
     * @param pair TraderJoe V2 pair
     * @param binIds the ids of bin
     * @param amounts The list of amounts to burn of each id in binIds
     * @param timestamp time of the transaction
     **/
    event FundedLiquidityTraderJoeV2(address indexed user, address indexed pair, uint256[] binIds, uint[] amounts, uint256 timestamp);

    /**
     * @dev emitted after withdrawing TraderJoe V2 LB tokens
     * @param user the address of user removing liquidity
     * @param pair TraderJoe V2 pair
     * @param binIds the ids of bin
     * @param amounts The list of amounts to burn of each id in binIds
     * @param timestamp time of the transaction
     **/
    event WithdrawnLiquidityTraderJoeV2(address indexed user, address indexed pair, uint256[] binIds, uint[] amounts, uint256 timestamp);

    error TraderJoeV2PoolNotWhitelisted();
}
