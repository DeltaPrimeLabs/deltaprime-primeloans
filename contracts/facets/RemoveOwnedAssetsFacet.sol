// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 4da64a8a04844045e51b88c6202064e16ea118aa;
pragma solidity 0.8.17;

import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";

contract RemoveOwnedAssetsFacet {

    function removeUSDTeFromOwnedAssets() external virtual {
        if (
            address(this) == 0x09cf3Ca6FB2e8921292BFFB4e3bD240Cf6E27856 ||
            address(this) == 0x7618D1CE29993bC5A8738B03B8836f6A2d96a61d ||
            address(this) == 0x77074C947AcF2b24c6e9a830d0D4C05353BA6AD7 ||
            address(this) == 0xAd644e3831A0d907CB2a4b372E780b36f97C3834 ||
            address(this) == 0xbfF4d5dB387d351D2923a5202676dA38eFb5baCc ||
            address(this) == 0xdBeF7A49849c0ACD444902fA8942cefBa7B4e567 ||
            address(this) == 0xe23448D99172d100c7D1112306AbDda686F517c6
        ) {
            require(msg.sender == 0xbAc44698844f13cF0AF423b19040659b688ef036, "msg.sender is not authorized");
            DiamondStorageLib.removeOwnedAsset("USDT.e");
        } else {
            revert("Account not whitelisted for this operation");
        }
    }

    function removeSHLBUSDTeUSDTFromOwnedAssets() external virtual {
        if (
            address(this) == 0x19F9C63cC50D8DbCd268F59798F8854cDCF21eE5 ||
            address(this) == 0x82d9eBd96c4D98aDB3DB1F98439450d07d285A56 ||
            address(this) == 0x8333F64C0417CBA6aEdDFcf9e8B534c1bCBD5881 ||
            address(this) == 0xAd644e3831A0d907CB2a4b372E780b36f97C3834 ||
            address(this) == 0xbfF4d5dB387d351D2923a5202676dA38eFb5baCc ||
            address(this) == 0xCBf98a5229Ad211563B6e5Aa463925225615fD6a ||
            address(this) == 0xe23448D99172d100c7D1112306AbDda686F517c6
        ) {
            require(msg.sender == 0xbAc44698844f13cF0AF423b19040659b688ef036, "msg.sender is not authorized");
            DiamondStorageLib.removeOwnedAsset("SHLB_USDT.e-USDt_C");
        } else {
            revert("Account not whitelisted for this operation");
        }
    }
}