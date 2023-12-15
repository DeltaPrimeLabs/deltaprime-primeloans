// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: f2b3e69107e2fab8f83a67aaa491ce220a2c49b9;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../ReentrancyGuardKeccak.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";
import "../lib/SolvencyMethods.sol";
import "../interfaces/ITokenManager.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract ParaSwapFacet is ReentrancyGuardKeccak, SolvencyMethods {
    using TransferHelper for address;

    address private constant PARA_TRANSFER_PROXY =
        0x216B4B4Ba9F3e719726886d34a177484278Bfcae;
    address private constant PARA_ROUTER =
        0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57;

    struct SwapTokensDetails {
        bytes32 tokenSoldSymbol;
        bytes32 tokenBoughtSymbol;
        IERC20Metadata soldToken;
        IERC20Metadata boughtToken;
        uint256 initialSoldTokenBalance;
        uint256 initialBoughtTokenBalance;
    }

    function getInitialTokensDetails(
        address _soldTokenAddress,
        address _boughtTokenAddress
    ) internal view returns (SwapTokensDetails memory) {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        if (_boughtTokenAddress == 0xaE64d55a6f09E4263421737397D1fdFA71896a69) {
            _boughtTokenAddress = 0x9e295B5B976a184B14aD8cd72413aD846C299660;
        }

        if (_soldTokenAddress == 0xaE64d55a6f09E4263421737397D1fdFA71896a69) {
            _soldTokenAddress = 0x9e295B5B976a184B14aD8cd72413aD846C299660;
        }

        bytes32 _tokenSoldSymbol = tokenManager.tokenAddressToSymbol(
            _soldTokenAddress
        );
        bytes32 _tokenBoughtSymbol = tokenManager.tokenAddressToSymbol(
            _boughtTokenAddress
        );

        require(
            tokenManager.isTokenAssetActive(_boughtTokenAddress),
            "Asset not supported."
        );

        IERC20Metadata _soldToken = IERC20Metadata(_soldTokenAddress);
        IERC20Metadata _boughtToken = IERC20Metadata(_boughtTokenAddress);

        return
            SwapTokensDetails({
                tokenSoldSymbol: _tokenSoldSymbol,
                tokenBoughtSymbol: _tokenBoughtSymbol,
                soldToken: _soldToken,
                boughtToken: _boughtToken,
                initialSoldTokenBalance: _soldToken.balanceOf(address(this)),
                initialBoughtTokenBalance: _boughtToken.balanceOf(address(this))
            });
    }

    function paraSwapV2(
        bytes4 selector,
        bytes memory data,
        address fromToken,
        uint256 fromAmount,
        address toToken,
        uint256 minOut
    )
        external
        nonReentrant
        onlyOwner
        noBorrowInTheSameBlock
        recalculateAssetsExposure
        remainsSolvent
    {
        SwapTokensDetails memory swapTokensDetails = getInitialTokensDetails(
            fromToken,
            toToken
        );

        require(swapTokensDetails.soldToken.balanceOf(address(this)) >= fromAmount, "Insufficient balance");
        require(minOut > 0, "minOut needs to be > 0");
        require(fromAmount > 0, "Amount of tokens to sell has to be greater than 0");

        address(swapTokensDetails.soldToken).safeApprove(PARA_TRANSFER_PROXY, 0);
        address(swapTokensDetails.soldToken).safeApprove(
            PARA_TRANSFER_PROXY,
            fromAmount
        );

        (bool success, ) = PARA_ROUTER.call((abi.encodePacked(selector, data)));
        require(success, "Swap failed");

        // Add asset to ownedAssets
        if (swapTokensDetails.boughtToken.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset(
                swapTokensDetails.tokenBoughtSymbol,
                address(swapTokensDetails.boughtToken)
            );
        }

        // Remove asset from ownedAssets if the asset balance is 0 after the swap
        if (swapTokensDetails.soldToken.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(swapTokensDetails.tokenSoldSymbol);
        }

        uint256 boughtTokenFinalAmount = swapTokensDetails.boughtToken.balanceOf(
            address(this)
        ) - swapTokensDetails.initialBoughtTokenBalance;
        require(boughtTokenFinalAmount >= minOut, "Too little received");

        emit Swap(
            msg.sender,
            swapTokensDetails.tokenSoldSymbol,
            swapTokensDetails.tokenBoughtSymbol,
            swapTokensDetails.initialSoldTokenBalance -
                swapTokensDetails.soldToken.balanceOf(address(this)),
            boughtTokenFinalAmount,
            block.timestamp
        );
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /**
     * @dev emitted after a swap of assets
     * @param user the address of user making the purchase
     * @param soldAsset sold by the user
     * @param boughtAsset bought by the user
     * @param amountSold amount of tokens sold
     * @param amountBought amount of tokens bought
     * @param timestamp time of the swap
     **/
    event Swap(
        address indexed user,
        bytes32 indexed soldAsset,
        bytes32 indexed boughtAsset,
        uint256 amountSold,
        uint256 amountBought,
        uint256 timestamp
    );
}
