interface IOwnershipFacet {
    function owner() external view returns (address owner_);

    function transferOwnership(address _newOwner) external;

    function acceptOwnership() external;

    function pendingOwner() external view returns (address pendingOwner_);
}
