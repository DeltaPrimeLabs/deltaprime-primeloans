// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "../ReentrancyGuardKeccak.sol";
import "../OnlyOwnerOrInsolvent.sol";
import "../interfaces/joe-v2/ILBRouter.sol";
import "../interfaces/joe-v2/ILBFactory.sol";
import "../interfaces/joe-v2/ITraderJoeV2Rewarder.sol";
import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

abstract contract TraderJoeV2Facet is ITraderJoeV2Facet, ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {

    using TransferHelper for address;

    address private constant REWARDER = 0x624C5b9BEB13af6893e715932c26e2b7A59c410a;

    function maxBinsPerPrimeAccount() public view virtual returns (uint256);

    function getJoeV2RouterAddress() public view virtual returns (address){
        return 0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30;
    }

    function getOwnedTraderJoeV2Bins() public view returns (TraderJoeV2Bin[] memory result){
        return DiamondStorageLib.getTjV2OwnedBinsView();
    }

    function getOwnedTraderJoeV2BinsStorage() internal returns (TraderJoeV2Bin[] storage result){
        return DiamondStorageLib.getTjV2OwnedBins();
    }

    function getWhitelistedTraderJoeV2Pairs() internal view virtual returns (ILBPair[] memory pools);

    function isPairWhitelisted(address pair) internal view virtual returns (bool) {
        ILBPair[] memory pairs = getWhitelistedTraderJoeV2Pairs();

        for (uint i; i < pairs.length; ++i) {
            if (pair == address(pairs[i])) return true;
        }
        return false;
    }

    function claimReward(ITraderJoeV2Rewarder.MerkleEntry[] calldata merkleEntries) external nonReentrant onlyOwner {
        uint256 length = merkleEntries.length;
        IERC20[] memory tokens = new IERC20[](length);
        uint256[] memory beforeBalances = new uint256[](length);
        for (uint256 i; i != length; ++i) {
            tokens[i] = merkleEntries[i].token;
            beforeBalances[i] = tokens[i].balanceOf(address(this));
        }

        ITraderJoeV2Rewarder rewarder = ITraderJoeV2Rewarder(REWARDER);
        rewarder.batchClaim(merkleEntries);

        for (uint256 i; i != length; ++i) {
            uint256 newBalance = tokens[i].balanceOf(address(this));
            if (newBalance > beforeBalances[i]) {
                address(tokens[i]).safeTransfer(msg.sender, newBalance - beforeBalances[i]);
            }
        }
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

        if (maxBinsPerPrimeAccount() > 0 && getOwnedTraderJoeV2BinsStorage().length > maxBinsPerPrimeAccount()) revert TooManyBins();

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


    function addLiquidityTraderJoeV2(ILBRouter.LiquidityParameters memory liquidityParameters) external nonReentrant onlyOwner noBorrowInTheSameBlock recalculateAssetsExposure remainsSolvent {
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

        if (maxBinsPerPrimeAccount() > 0 && getOwnedTraderJoeV2BinsStorage().length > maxBinsPerPrimeAccount()) revert TooManyBins();

        emit AddLiquidityTraderJoeV2(msg.sender, address(pairInfo.LBPair), depositIds, liquidityMinted, tokenX, tokenY, amountXAdded, amountYAdded, block.timestamp);
    }

    function removeLiquidityTraderJoeV2(RemoveLiquidityParameters memory parameters) external nonReentrant onlyOwnerOrInsolvent noBorrowInTheSameBlock recalculateAssetsExposure {
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

    error TooManyBins();
}
