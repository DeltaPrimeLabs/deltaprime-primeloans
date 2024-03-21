// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.17;

interface ISPrime {
    /**
     * @dev Event emitted when a range is set for a specific active index.
     * @param activeId The index of the active range.
     * @param low The lower bound of the range.
     * @param upper The upper bound of the range.
     */
    event RangeSet(uint24 indexed activeId, uint24 low, uint24 upper);

    /**
     * @dev Struct representing information about a pair.
     * @param lowerRange The lower bound of the range.
     * @param upperRange The upper bound of the range.
     * @param lastRebalance The timestamp of the last rebalance.
     * @param totalShare The total share of the pair.
     * @param lbPair The address of the liquidity pair.
     */
    struct PairInfo {
        uint24 lowerRange;
        uint24 upperRange;
        uint64 lastRebalance;
        uint256 totalShare;
        address lbPair;
    }
    
    // Owner functions
    function addBins(uint24 activeId, uint24 lower, uint24 upper, address lbPair) external;
    function removeBins(uint24 activeId) external;

    // Interactive functions
    function rebalance(
        uint24 activeId,
        uint24 newLower,
        uint24 newUpper,
        uint24 desiredActiveId,
        uint24 slippageActiveId,
        bytes calldata distributions
    ) external;
    function deposit(uint24 activeId, uint256 amountX, uint256 amountY, bytes calldata distributions) external;
    function withdraw(uint24 activeId, uint256 shareWithdraw) external;
}
