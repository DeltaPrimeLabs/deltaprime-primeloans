// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";

contract RedstoneConfigManager is Ownable {
    mapping(address => bool) internal signerAuthorized;
    address[] public trustedSigners;

    constructor(address[] memory _trustedSigners) {
        for (uint256 i = 0; i < _trustedSigners.length; i++) {
            _addTrustedSigner(_trustedSigners[i]);
        }
    }

    function getTrustedSigners() external view returns (address[] memory) {
        return trustedSigners;
    }

    function signerExists(address signer) public view returns (bool) {
        return signerAuthorized[signer];
    }

    function addTrustedSigners(address[] memory _trustedSigners) public onlyOwner {
        for (uint256 i = 0; i < _trustedSigners.length; i++) {
            require(!signerExists(_trustedSigners[i]), "Signer already exists");
            _addTrustedSigner(_trustedSigners[i]);
        }
    }

    function _addTrustedSigner(address newSigner) private {
        signerAuthorized[newSigner] = true;
        trustedSigners.push(newSigner);
    }

    function removeTrustedSigners(address[] memory _trustedSigners) public onlyOwner {
        for (uint256 i = 0; i < _trustedSigners.length; i++) {
            require(signerExists(_trustedSigners[i]), "Signer does not exists");
            _removeTrustedSigner(_trustedSigners[i]);
        }
    }

    function _removeTrustedSigner(address signerToRemove) private {
        // Signer is no longer authorized
        signerAuthorized[signerToRemove] = false;

        // Remove signerToRemove from the trustedSigners list
        for (uint256 i = 0; i < trustedSigners.length; i++) {
            // Lookup signerToRemove position in the trustedSigners list
            if (trustedSigners[i] == signerToRemove) {
                // If signerToRemove is not at the last place in the list, copy last list's element to it's place
                if (i != trustedSigners.length - 1) {
                    trustedSigners[i] = trustedSigners[trustedSigners.length - 1];
                }
                // Remove last list's element
                trustedSigners.pop();
            }
        }
    }
}
