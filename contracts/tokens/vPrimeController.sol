// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@redstone-finance/evm-connector/contracts/mocks/AuthorisedMockSignersBase.sol";
import "@redstone-finance/evm-connector/contracts/core/RedstoneConsumerNumericBase.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/ITokenManager.sol";
import "../Pool.sol";
import "./mock/sPrimeMock.sol";
import "./vPrime.sol";

contract vPrimeController is Ownable, RedstoneConsumerNumericBase, AuthorisedMockSignersBase {
    function getAuthorisedSignerIndex(address receivedSigner)
    public
    view
    virtual
    override
    returns (uint8)
    {
        return getAuthorisedMockSignerIndex(receivedSigner);
    }

    function validateTimestamp(uint256 receivedTimestampMilliseconds) public view virtual override {
        // Always pass
    }

    Pool[] public whitelistedPools; // TODO: create IPoolInterface
    SPrimeMock[] public whitelistedSPrimeContracts;
    ITokenManager public tokenManager;
    vPrime public vPrimeContract;
    uint256 public constant DEPOSITOR_YEARLY_V_PRIME_RATE = 5;
    uint256 public constant MAX_V_PRIME_VESTING_YEARS = 3;
    uint256 public constant V_PRIME_DETERIORATION_DAYS = 14;

    constructor(Pool[] memory _whitelistedPools, SPrimeMock[] memory _whitelistedSPrimeContracts, ITokenManager _tokenManager, vPrime _vPrime) {
        whitelistedPools = _whitelistedPools;
        whitelistedSPrimeContracts = _whitelistedSPrimeContracts;
        tokenManager = _tokenManager;
        vPrimeContract = _vPrime;
    }

    function getUserDepositDollarValueAcrossWhiteListedPools(address userAddress) public view returns (uint256) {
        uint256 totalDollarValue = 0;
        bytes32[] memory poolsTokenSymbols = new bytes32[](whitelistedPools.length);
        for (uint i = 0; i < whitelistedPools.length; i++) {
            poolsTokenSymbols[i] = tokenManager.tokenAddressToSymbol(whitelistedPools[i].tokenAddress());
        }
        uint256[] memory prices = getOracleNumericValuesFromTxMsg(poolsTokenSymbols);

        for (uint i = 0; i < whitelistedPools.length; i++) {
            uint256 poolBalance = IERC20(whitelistedPools[i]).balanceOf(userAddress);
            uint256 poolDollarValue = poolBalance * prices[i] * 1e10 / 10 ** whitelistedPools[i].decimals();
            totalDollarValue += poolDollarValue;
        }
        return totalDollarValue;
    }

    function getUserBorrowedDollarValueAcrossWhitelistedPools(address userAddress) public view returns (uint256) {
        uint256 totalDollarValue = 0;
        bytes32[] memory poolsTokenSymbols = new bytes32[](whitelistedPools.length);
        for (uint i = 0; i < whitelistedPools.length; i++) {
            poolsTokenSymbols[i] = tokenManager.tokenAddressToSymbol(whitelistedPools[i].tokenAddress());
        }
        uint256[] memory prices = getOracleNumericValuesFromTxMsg(poolsTokenSymbols);

        for (uint i = 0; i < whitelistedPools.length; i++) {
            uint256 poolBorrowedAmount = whitelistedPools[i].getBorrowed(userAddress);
            uint256 poolDollarValue = poolBorrowedAmount * prices[i] * 1e10 / 10 ** whitelistedPools[i].decimals();
            totalDollarValue += poolDollarValue;
        }
        return totalDollarValue;
    }

    function getUserSPrimeDollarValue(address userAddress) public view returns (uint256) {
        uint256 totalDollarValue = 0;
        for (uint i = 0; i < whitelistedSPrimeContracts.length; i++) {
            uint256 sPrimeDollarValue = whitelistedSPrimeContracts[i].getUserDepositDollarValue(userAddress);
            totalDollarValue += sPrimeDollarValue;
        }
        return totalDollarValue;
    }
    /*
    * For every $10 deposited and $1 $sPRIME staked into one of DeltaPrime’s liquidity pools, your balance increases with 5 $vPRIME per year.
    * Only full 10-1 pairs can produce $vPRIME.
    */
    function getDepositorVPrimePairsCount(address userAddress) public view returns (uint256){
        uint256 userDepositDollarValue = getUserDepositDollarValueAcrossWhiteListedPools(userAddress);
        uint256 userSPrimeDollarValue = getUserSPrimeDollarValue(userAddress);
        uint256 depositAndSPrime10To1PairsCount = Math.min(userDepositDollarValue / 10, userSPrimeDollarValue) / 1e18;
        return depositAndSPrime10To1PairsCount;
    }

    function getDepositorVPrimeRateAndMaxCap(address userAddress) public view returns (int256, uint256){
        uint256 vPrimePairsCount = getDepositorVPrimePairsCount(userAddress);
        uint256 vPrimeMaxCap = vPrimePairsCount * DEPOSITOR_YEARLY_V_PRIME_RATE * MAX_V_PRIME_VESTING_YEARS * 1e18;
        uint256 currentVPrimeBalance = IERC20(vPrimeContract).balanceOf(userAddress);
        int256 vPrimeRate = int256(vPrimeMaxCap) - int256(currentVPrimeBalance);
        if(vPrimeRate < 0){
            vPrimeRate = vPrimeRate / int256(V_PRIME_DETERIORATION_DAYS) / 1 days;
        } else{
            vPrimeRate = vPrimeRate / int256(MAX_V_PRIME_VESTING_YEARS) / 365 days;
        }
        return (vPrimeRate, vPrimeMaxCap);
    }

    function updateVPrimeSnapshot(address userAddress) public {
        (int256 vPrimeRate, uint256 vPrimeMaxCap) = getDepositorVPrimeRateAndMaxCap(userAddress);
        vPrimeContract.adjustBalance(userAddress, vPrimeRate, vPrimeMaxCap);
    }

    /**
    * @notice Updates the list of whitelisted pools.
    * @dev Can only be called by the contract owner.
    * @param newWhitelistedPools An array of addresses representing the new list of whitelisted pools.
    */
    function updateWhitelistedPools(Pool[] memory newWhitelistedPools) external onlyOwner {
        whitelistedPools = newWhitelistedPools;
        emit WhitelistedPoolsUpdated(newWhitelistedPools, msg.sender, block.timestamp);
    }

    /**
    * @notice Updates the list of whitelisted sPrime contracts.
    * @dev Can only be called by the contract owner.
    * @param newWhitelistedSPrimeContracts An array of addresses representing the new list of whitelisted sPrime contracts.
    */
    function updateWhitelistedSPrimeContracts(SPrimeMock[] memory newWhitelistedSPrimeContracts) external onlyOwner {
        whitelistedSPrimeContracts = newWhitelistedSPrimeContracts;
        emit WhitelistedSPrimeContractsUpdated(newWhitelistedSPrimeContracts, msg.sender, block.timestamp);
    }

    /**
    * @notice Updates the token manager contract.
    * @dev Can only be called by the contract owner.
    * @param newTokenManager The address of the new token manager contract.
    */
    function updateTokenManager(ITokenManager newTokenManager) external onlyOwner {
        tokenManager = newTokenManager;
        emit TokenManagerUpdated(newTokenManager, msg.sender, block.timestamp);
    }


    // EVENTS
    event WhitelistedPoolsUpdated(Pool[] newWhitelistedPools, address userAddress, uint256 timestamp);
    event WhitelistedSPrimeContractsUpdated(SPrimeMock[] newWhitelistedSPrimeContracts, address userAddress, uint256 timestamp);
    event TokenManagerUpdated(ITokenManager newTokenManager, address userAddress, uint256 timestamp);
}
