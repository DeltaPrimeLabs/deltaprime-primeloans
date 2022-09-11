interface IOwnershipFacet {
    function owner() external view returns (address owner_);

    function transferOwnership(address _newOwner) external;
}
