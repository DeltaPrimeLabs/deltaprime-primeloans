// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: d5641d2d8be5d188d6e4f4f272ae32174783f6a1;
pragma solidity 0.8.17;

import "../HealthMeterFacetProd.sol";

contract HealthMeterFacetProdArbitrum is HealthMeterFacetProd {
    function getDataServiceId() public pure override returns (string memory) {
        return "redstone-arbitrum-prod";
    }

    function getUniqueSignersThreshold() public pure override returns (uint8) {
        return 3;
    }

    function getAuthorisedSignerIndex(
        address signerAddress
    ) public pure override returns (uint8) {
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
