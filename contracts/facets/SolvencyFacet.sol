// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "redstone-evm-connector/lib/contracts/message-based/PriceAware.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../TokenManager.sol";

//This path is updated during deployment
import "../lib/avalanche/DeploymentConstants.sol";
import "../Pool.sol";

contract SolvencyFacet is PriceAware {

    //IMPORTANT: KEEP IT IDENTICAL ACROSS FACETS TO BE PROPERLY UPDATED BY DEPLOYMENT SCRIPTS
    uint256 private constant _MAX_LTV = 5000;

    /* ========== REDSTONE-EVM-CONNECTOR OVERRIDDEN FUNCTIONS ========== */

    /**
     * Override PriceAware method to consider Avalanche guaranteed block timestamp time accuracy
     **/
    function getMaxBlockTimestampDelay() public virtual override view returns (uint256) {
        return 30;
    }

    /**
     * Override PriceAware method, addresses below belong to authorized signers of data feeds
     **/
    function isSignerAuthorized(address _receivedSigner) public override virtual view returns (bool) {
        return DeploymentConstants.getRedstoneConfigManager().signerExists(_receivedSigner);
    }

    /* ================== */

    /**
    * Checks if the loan is solvent.
    * It means that the ratio between debt and current collateral (defined as total value minus debt) is below safe level,
    * which is parametrized by the getMaxLtv()
    * @dev This function uses the redstone-evm-connector
    **/
    function isSolvent() public view returns (bool) {
        return getLTV() < getMaxLtv();
    }

    function executeGetPricesFromMsg(bytes32[] memory symbols) external returns (uint256[] memory) {
        return getPricesFromMsg(symbols);
    }

    /**
   * Returns the current debt from all lending pools
   * @dev This function uses the redstone-evm-connector
   **/
    function getDebt() public view virtual returns (uint256) {
        uint256 debt = 0;
        TokenManager tokenManager = DeploymentConstants.getTokenManager();
        bytes32[] memory assets = tokenManager.getAllPoolAssets();
        uint256[] memory prices = getPricesFromMsg(assets);

        for (uint256 i = 0; i < assets.length; i++) {
            IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(assets[i], true));

            Pool pool = Pool(tokenManager.getPoolAddress(assets[i]));
            //10**18 (wei in eth) / 10**8 (precision of oracle feed) = 10**10
            debt = debt + pool.getBorrowed(address(this)) * prices[i] * 10 ** 10
            / 10 ** token.decimals();
        }

        return debt;
    }

    /**
     * Returns the current value of Prime Account in USD including all tokens as well as staking and LP positions
     * @dev This function uses the redstone-evm-connector
     **/
    function getTotalValue() public view virtual returns (uint256) {
        bytes32[] memory assets = DeploymentConstants.getAllOwnedAssets();
        uint256[] memory prices = getPricesFromMsg(assets);
        uint256 nativeTokenPrice = getPriceFromMsg(DeploymentConstants.getNativeTokenSymbol());
        if (prices.length > 0) {
            TokenManager tokenManager = DeploymentConstants.getTokenManager();

            uint256 total = address(this).balance * nativeTokenPrice / 10 ** 8;

            for (uint256 i = 0; i < prices.length; i++) {
                require(prices[i] != 0, "Asset price returned from oracle is zero");

                IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(assets[i], true));
                uint256 assetBalance = token.balanceOf(address(this));

                total = total + (prices[i] * 10 ** 10 * assetBalance / (10 ** token.decimals()));
            }

            return total;
        } else {
            return 0;
        }
    }

    function getFullLoanStatus() public view returns (uint256[4] memory) {
        return [getTotalValue(), getDebt(), getLTV(), isSolvent() ? uint256(1) : uint256(0)];
    }

    /**
     * Returns current Loan To Value (solvency ratio) associated with the loan, defined as debt / (total value - debt)
     * The collateral is equal to total loan value takeaway debt.
     * @dev This function uses the redstone-evm-connector
     **/
    // TODO: Refactor - change usage in code and tests to use getLTV only
    function getLTV() public view virtual returns (uint256) {
        uint256 debt = getDebt();
        uint256 totalValue = getTotalValue();

        if (debt == 0) {
            return 0;
        } else if (debt < totalValue) {
            return (debt * DeploymentConstants.getPercentagePrecision()) / (totalValue - debt);
        } else {
            return getMaxLtv();
        }
    }

    /**
     * Returns max LTV (with the accuracy in a thousandth)
     * IMPORTANT: when changing, update other facets as well
     **/
    function getMaxLtv() public view returns (uint256) {
        return _MAX_LTV;
    }
}
