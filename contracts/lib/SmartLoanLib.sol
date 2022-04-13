// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;

library SmartLoanLib {
    function addUniqueAsset(bytes32[] storage _array, bytes32 _asset) internal {
        for(uint i=0; i<_array.length; i++) {
            if (_array[i] == _asset) {
                return;
            }
        }
        _array.push(_asset);
    }

    function removeAsset(bytes32[] storage _array, bytes32 _asset) internal {
        for(uint i=0; i<_array.length; i++) {
            if (_array[i] == _asset) {
                _array[i] = _array[_array.length - 1];
                _array.pop();
            }
        }
    }
}
