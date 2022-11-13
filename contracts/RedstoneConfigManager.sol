// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: f63ef97516096bbd3db42914b6554a461f90ef40;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";

contract RedstoneConfigManager is Ownable {
    mapping(address => bool) internal signerAuthorized;
    address[] public trustedSigners;

    constructor(address[] memory _trustedSigners) {
        for (uint256 i = 0; i < _trustedSigners.length; i++) {
            require(!signerExists(_trustedSigners[i]), "Signer already exists");
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
            emit SignerAdded(msg.sender, _trustedSigners[i], block.timestamp);
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
            emit SignerRemoved(msg.sender, _trustedSigners[i], block.timestamp);
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

    /* ========== OVERRIDDEN FUNCTIONS ========== */

    function renounceOwnership() public virtual override {}

    // EVENTS
    /**
    * @dev emitted after adding a signer
    * @param user performing the transaction
    * @param signer address of added signer
    * @param timestamp of change
    **/
    event SignerAdded(address indexed user, address signer, uint256 timestamp);

    /**
    * @dev emitted after removing a signer
    * @param user performing the transaction
    * @param signer address of removed signer
    * @param timestamp of change
    **/
    event SignerRemoved(address indexed user, address signer, uint256 timestamp);
}
