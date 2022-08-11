interface IYieldYakFacet {
  function getTotalStakedValue (  ) external view returns ( uint256 totalValue );
  function stakeAVAXYak ( uint256 amount ) external;
  function unstakeAVAXForASpecifiedAmount ( uint256 amount ) external;
  function unstakeAVAXYak ( uint256 amount ) external;
}
