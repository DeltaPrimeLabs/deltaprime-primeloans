pragma solidity ^0.8.17;

interface IAssetsOperationsFacet {
    function borrow(bytes32 _asset, uint256 _amount) external;

    function fund(bytes32 _fundedAsset, uint256 _amount) external;

    function fundGLP(uint256 _amount) external;

    function repay(bytes32 _asset, uint256 _amount) payable external;

    function withdraw(bytes32 _withdrawnAsset, uint256 _amount) external;
}
