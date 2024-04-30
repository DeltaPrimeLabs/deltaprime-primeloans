// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: d0e8ed51430900dbfc0d3920039874c8fd080b08;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../../interfaces/ITokenManager.sol";
import "../../Pool.sol";
import "../SolvencyFacetProd.sol";
import "../../interfaces/IStakingPositions.sol";
import "../../interfaces/facets/avalanche/ITraderJoeV2Facet.sol";
import "../../interfaces/uniswap-v3-periphery/INonfungiblePositionManager.sol";
import "../../lib/uniswap-v3/UniswapV3IntegrationHelper.sol";
import {PriceHelper} from "../../lib/joe-v2/PriceHelper.sol";
import {Uint256x256Math} from "../../lib/joe-v2/math/Uint256x256Math.sol";
import {TickMath} from "../../lib/uniswap-v3/TickMath.sol";
import {FullMath} from "../../lib/uniswap-v3/FullMath.sol";


//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";
import "../../interfaces/facets/avalanche/IUniswapV3Facet.sol";

contract SolvencyFacetProdArbitrum is SolvencyFacetProd {
    function getDataServiceId() public view virtual override returns (string memory) {
        return "redstone-arbitrum-prod";
    }

    function getUniqueSignersThreshold() public view virtual override returns (uint8) {
        return 3;
    }

    function getAuthorisedSignerIndex(
        address signerAddress
    ) public view virtual override returns (uint8) {
        if (signerAddress == 0x345Efd26098e173F811e3B9Af1B0e0a11872B38b) {
            return 0;
        } else if (signerAddress == 0xbD0c5ccd85D5831B10E3e49527B8Cd67e2EFAf39) {
            return 1;
        } else if (signerAddress == 0x2F3E8EC88C01593d10ca9461c807660fF2D8DB28) {
            return 2;
        } else if (signerAddress == 0xb7f154bB5491565D215F4EB1c3fe3e84960627aF) {
            return 3;
        } else if (signerAddress == 0xE6b0De8F4B31F137d3c59b5a0A71e66e7D504Ef9) {
            return 4;
        } else {
            revert SignerNotAuthorised(signerAddress);
        }
    }

    function getLTIPEligibleTVL() public view returns (uint256) {
        bytes32[] memory notEligibleTokens = new bytes32[](19);
        notEligibleTokens[0] = bytes32("ETH");
        notEligibleTokens[1] = bytes32("USDC");
        notEligibleTokens[2] = bytes32("ARB");
        notEligibleTokens[3] = bytes32("BTC");
        notEligibleTokens[4] = bytes32("DAI");
        notEligibleTokens[5] = bytes32("USDT");
        notEligibleTokens[6] = bytes32("FRAX");
        notEligibleTokens[7] = bytes32("USDC.e");
        notEligibleTokens[8] = bytes32("UNI");
        notEligibleTokens[9] = bytes32("LINK");
        notEligibleTokens[10] = bytes32("GMX");
        notEligibleTokens[11] = bytes32("MAGIC");
        notEligibleTokens[12] = bytes32("WOO");
        notEligibleTokens[13] = bytes32("wstETH");
        notEligibleTokens[14] = bytes32("JOE");
        notEligibleTokens[15] = bytes32("GRAIL");
        notEligibleTokens[16] = bytes32("ezETH");
        notEligibleTokens[17] = bytes32("weETH");
        notEligibleTokens[18] = bytes32("rsETH");

        uint256[] memory prices = getOracleNumericValuesFromTxMsg(notEligibleTokens);
        AssetPrice[] memory assetsPrices = new AssetPrice[](notEligibleTokens.length);
        for(uint i; i<notEligibleTokens.length; i++){
            assetsPrices[i] = AssetPrice({
                asset: notEligibleTokens[i],
                price: prices[i]
            });
        }

        uint256 notEligibleAssetsValue = _getTotalAssetsValueBase(assetsPrices);
        uint256 debt = getDebt();

        return debt > notEligibleAssetsValue ? debt - notEligibleAssetsValue : 0;
    }
}
