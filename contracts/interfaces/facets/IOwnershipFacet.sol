pragma solidity ^0.8.17;

interface IOwnershipFacet {
    function owner() external view returns (address owner_);

    function proposeOwnershipTransfer(address _newOwner) external;

    function acceptOwnership() external;

    function proposedOwner() external view returns (address proposedOwner_);
}
