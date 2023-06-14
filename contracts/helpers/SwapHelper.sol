// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 4da64a8a04844045e51b88c6202064e16ea118aa;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "../interfaces/ITokenManager.sol";

//this path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract SwapHelper {
    struct SwapTokensDetails {
        bytes32 tokenSoldSymbol;
        bytes32 tokenBoughtSymbol;
        IERC20Metadata soldToken;
        IERC20Metadata boughtToken;
        uint256 initialSoldTokenBalance;
        uint256 initialBoughtTokenBalance;
    }

    function _getInitialTokensDetails(address _soldTokenAddress, address _boughtTokenAddress) internal view returns (SwapTokensDetails memory){
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        if (_boughtTokenAddress == 0xaE64d55a6f09E4263421737397D1fdFA71896a69) {
            _boughtTokenAddress = 0x9e295B5B976a184B14aD8cd72413aD846C299660;
        }

        if (_soldTokenAddress == 0x9e295B5B976a184B14aD8cd72413aD846C299660) {
            _soldTokenAddress = 0xaE64d55a6f09E4263421737397D1fdFA71896a69;
        }

        bytes32 _tokenSoldSymbol = tokenManager.tokenAddressToSymbol(_soldTokenAddress);
        bytes32 _tokenBoughtSymbol = tokenManager.tokenAddressToSymbol(_boughtTokenAddress);

        require(tokenManager.isTokenAssetActive(_boughtTokenAddress), "Asset not supported.");

        IERC20Metadata _soldToken = IERC20Metadata(_soldTokenAddress);
        IERC20Metadata _boughtToken = IERC20Metadata(_boughtTokenAddress);

        return SwapTokensDetails({
            tokenSoldSymbol: _tokenSoldSymbol,
            tokenBoughtSymbol: _tokenBoughtSymbol,
            soldToken: _soldToken,
            boughtToken: _boughtToken,
            initialSoldTokenBalance: _soldToken.balanceOf(address(this)),
            initialBoughtTokenBalance: _boughtToken.balanceOf(address(this))
        });
    }

    /* ========== EVENTS ========== */

    /**
     * @dev emitted after a swap of assets
     * @param user the address of user making the purchase
     * @param soldAsset sold by the user
     * @param boughtAsset bought by the user
     * @param amountSold amount of tokens sold
     * @param amountBought amount of tokens bought
     * @param timestamp time of the swap
     **/
    event Swap(address indexed user, bytes32 indexed soldAsset, bytes32 indexed boughtAsset, uint256 amountSold, uint256 amountBought, uint256 timestamp);

}