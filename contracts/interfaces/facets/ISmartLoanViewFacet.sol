pragma solidity ^0.8.17;

import "../IStakingPositions.sol";

interface ISmartLoanViewFacet {
    
    struct AssetNameBalance {
        bytes32 name;
        uint256 balance;
    }

    struct AssetNameDebt {
        bytes32 name;
        uint256 debt;
    }

    struct AssetNamePrice {
        bytes32 name;
        uint256 price;
    }
    
    function getAllAssetsBalances() external view returns (AssetNameBalance[] memory);

    function getDebts() external view returns (AssetNameDebt[] memory);

    function getAllAssetsPrices() external returns (AssetNamePrice[] memory);

    function getAllOwnedAssets() external view returns (bytes32[] memory result);

    function getSupportedTokensAddresses() external view returns (address[] memory result);

    function getBalance(bytes32 _asset) external view returns (uint256);

    function getPercentagePrecision() external view returns (uint256);

    function getContractOwner() external view returns (address _owner);

    function getProposedOwner() external view returns (address _proposed);

    function getReferrer() external view returns (address _referrer);

    function getStakedPositions() external view returns (IStakingPositions.StakedPosition[] memory  _positions);
}
