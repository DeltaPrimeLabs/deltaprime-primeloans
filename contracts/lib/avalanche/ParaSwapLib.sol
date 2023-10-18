// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

library ParaSwapLib {
    struct SimpleData {
        address fromToken;
        address toToken;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 expectedAmount;
        address[] callees;
        bytes exchangeData;
        uint256[] startIndexes;
        uint256[] values;
        address payable beneficiary;
        address payable partner;
        uint256 feePercent;
        bytes permit;
        uint256 deadline;
        bytes16 uuid;
    }

    struct Route {
        uint256 index; //Adapter at which index needs to be used
        address targetExchange;
        uint256 percent;
        bytes payload;
        uint256 networkFee; //NOT USED - Network fee is associated with 0xv3 trades
    }

    struct Adapter {
        address payable adapter;
        uint256 percent;
        uint256 networkFee; //NOT USED
        Route[] route;
    }

    struct Path {
        address to;
        uint256 totalNetworkFee; //NOT USED - Network fee is associated with 0xv3 trades
        Adapter[] adapters;
    }

    struct SellData {
        address fromToken;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 expectedAmount;
        address payable beneficiary;
        Path[] path;
        address payable partner;
        uint256 feePercent;
        bytes permit;
        uint256 deadline;
        bytes16 uuid;
    }

    struct DirectUniV3 {
        address fromToken;
        address toToken;
        address exchange;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 expectedAmount;
        uint256 feePercent;
        uint256 deadline;
        address payable partner;
        bool isApproved;
        address payable beneficiary;
        bytes path;
        bytes permit;
        bytes16 uuid;
    }

    bytes4 private constant SIMPLESWAP_SELECTOR = 0x54e3f31b;
    bytes4 private constant MULTISWAP_SELECTOR = 0xa94e78ef;
    bytes4 private constant DIRECT_UNIV3_SELECTOR = 0xa6886da9;

    function extractTokensAndAmount(bytes4 selector, bytes memory data) internal pure returns (address fromToken, address toToken, uint256 fromAmount) {
        if (selector == SIMPLESWAP_SELECTOR) {
            return getSimpleSwapData(data);
        }
        else if (selector == MULTISWAP_SELECTOR) {
            return getMultiSwapData(data);
        }
        else if (selector == DIRECT_UNIV3_SELECTOR) {
            return getDirectUniV3SwapData(data);
        } else {
            revert ("Unknown Selector");
        }
    }

    function getSimpleSwapData(bytes memory data) internal pure returns (address fromToken, address toToken, uint256 fromAmount) {
        SimpleData memory simpleData = abi.decode(data, (SimpleData));
        (fromToken, toToken, fromAmount) = (simpleData.fromToken, simpleData.toToken, simpleData.fromAmount);
    }

    function getMultiSwapData(bytes memory data) internal pure returns (address fromToken, address toToken, uint256 fromAmount) {
        uint256 length;
        assembly {
            // Read 32 bytes from data ptr + 32 bytes offset, shift right 12 bytes
            fromToken := shr(mul(0x0c, 0x08), mload(add(data, 0x20)))
            // Read 32 bytes from data ptr + 52 bytes offset
            fromAmount := mload(add(data, 0x34))
            // bytes_memory_len_offset + address + uint256(x3) + address = (32 + 20 + 3*32 + 20) bytes = 168
            // 0xa8 = 168 bytes offset = offset at which Path[] memory ptr resides

            let pathArrayLength := mload(mload(add(data, 0xa8))) // First element of array in memory layout is array length
            // One element of Path struct occupies address + uint256 + Path[] -> (20 + 32 + 32) bytes -> 84 bytes that is 0x54
            let toTokenOffsetFromPathArrayStart := add(mul(sub(pathArrayLength, 0x1), 0x54), 0x20) // (Path[].length - 1) * 84 bytes + 32 bytes offset (1st element of array is 32 bytes representing array length)
            toToken := shr(mul(0x0c, 0x08), mload(add(mload(add(data, 0xa8)), toTokenOffsetFromPathArrayStart)))
        }
    }

    function getDirectUniV3SwapData(bytes memory data) internal pure returns (address fromToken, address toToken, uint256 fromAmount) {
        DirectUniV3 memory directData = abi.decode(data, (DirectUniV3));
        (fromToken, toToken, fromAmount) = (directData.fromToken, directData.toToken, directData.fromAmount);
    }
}
