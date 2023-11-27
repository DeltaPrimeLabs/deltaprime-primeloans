// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: f9171d928d202be8df847b45d098bda14373cb32;
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
}
