// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: d5641d2d8be5d188d6e4f4f272ae32174783f6a1;
pragma solidity 0.8.17;

import "../HealthMeterFacetProd.sol";

contract HealthMeterFacetProdAvalanche is HealthMeterFacetProd {
    function getDataServiceId() public pure override returns (string memory) {
        return "redstone-avalanche-prod";
    }

    function getUniqueSignersThreshold() public pure override returns (uint8) {
        return 3;
    }

    function getAuthorisedSignerIndex(
        address signerAddress
    ) public pure override returns (uint8) {
        if (signerAddress == 0x1eA62d73EdF8AC05DfceA1A34b9796E937a29EfF) {
        return 0;
        } else if (signerAddress == 0x2c59617248994D12816EE1Fa77CE0a64eEB456BF) {
        return 1;
        } else if (signerAddress == 0x12470f7aBA85c8b81D63137DD5925D6EE114952b) {
        return 2;
        } else if (signerAddress == 0x109B4a318A4F5ddcbCA6349B45f881B4137deaFB) {
        return 3;
        } else if (signerAddress == 0x83cbA8c619fb629b81A65C2e67fE15cf3E3C9747) {
        return 4;
        } else {
        revert SignerNotAuthorised(signerAddress);
        }
    }
}
