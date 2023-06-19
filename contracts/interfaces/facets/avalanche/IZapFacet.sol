pragma solidity ^0.8.17;

interface IZapFacet {
    function longAVAXUSDC(
        uint256 _amount,
        bytes1 _selector,
        bytes memory _data,
        bytes4 _stakeSelector,
        bytes4 _unstakeSelector
    ) external;

    function shortAVAXUSDC(
        uint256 _amount,
        bytes1 _selector,
        bytes memory _data,
        bytes4 _stakeSelector,
        bytes4 _unstakeSelector
    ) external;

    function longAVAXUSDT(
        uint256 _amount,
        bytes1 _selector,
        bytes memory _data,
        bytes4 _stakeSelector,
        bytes4 _unstakeSelector
    ) external;

    function shortAVAXUSDT(
        uint256 _amount,
        bytes1 _selector,
        bytes memory _data,
        bytes4 _stakeSelector,
        bytes4 _unstakeSelector
    ) external;

    function closeLongPosition(
        uint256 _positionIndex,
        bytes1 _selector,
        bytes memory _data,
        uint256 _minAmount
    ) external;

    function closeShortPosition(
        uint256 _positionIndex,
        bytes1 _selector,
        bytes memory _data,
        uint256 _minAmount
    ) external;
}
