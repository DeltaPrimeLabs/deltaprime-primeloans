pragma solidity ^0.8.4;
import "@openzeppelin/contracts/access/Ownable.sol";

contract RedstoneConfigManager is Ownable{
    address[] internal trustedSigners;
    uint256 public maxBlockTimestampDelay;

    constructor(address[] memory _trustedSigners, uint256 _maxBlockTimestampDelay) {
        maxBlockTimestampDelay = _maxBlockTimestampDelay;
        for(uint256 i=0; i<_trustedSigners.length; i++) {
            trustedSigners.push(_trustedSigners[i]);
        }
    }

    function getTrustedSigners() external view returns (address[] memory) {
        return trustedSigners;
    }

    function setMaxBlockTimestampDelay(uint256 _maxBlockTimestampDelay) public onlyOwner {
        maxBlockTimestampDelay = _maxBlockTimestampDelay;
    }

    function signerExists(address signer) public view returns(bool exists) {
        exists = false;
        for(uint256 i=0; i<trustedSigners.length; i++) {
            if(trustedSigners[i] == signer) {
                return true;
            }
        }
    }

    function addTrustedSigners(address[] memory _trustedSigners) public onlyOwner {
        for(uint256 i=0; i<_trustedSigners.length; i++) {
            require(!signerExists(_trustedSigners[i]), "Signer already exists");
            trustedSigners.push(_trustedSigners[i]);
        }
    }

    function removeTrustedSigners(address[] memory _trustedSigners) public onlyOwner {
        for(uint256 i=0; i<_trustedSigners.length; i++) {
            _removeTrustedSigner(_trustedSigners[i]);
        }
    }

    function _removeTrustedSigner(address _trustedSigner) private {
        for(uint256 i=0; i<trustedSigners.length; i++) {
            if(_trustedSigner == trustedSigners[i]) {
                if(i < (trustedSigners.length-1)) {
                    trustedSigners[i] = trustedSigners[trustedSigners.length-1];
                }
                trustedSigners.pop();
            }
        }
    }
}
