pragma solidity ^0.8.17;

interface IZapFacet {
    function long(
        uint256 _amount,
        bytes32 _toAsset,
        bytes32 _farmAsset,
        bytes1 _selector,
        bytes memory _data
    ) external;

    function closeLongPosition(
        uint256 _positionIndex,
        bytes1 _selector,
        bytes memory _data
    ) external;

    function short(
        bytes32 _fromAsset,
        uint256 _amount,
        bytes32 _farmAsset,
        bytes1 _selector,
        bytes memory _data
    ) external;

    function closeShortPosition(
        uint256 _positionIndex,
        bytes1 _selector,
        bytes memory _data
    ) external;
}
