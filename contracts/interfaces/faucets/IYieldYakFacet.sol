interface IYieldYakFacet {
  function _getLTV (  ) external returns ( uint256 ltv );
  function getMaxBlockTimestampDelay (  ) external view returns ( uint256 );
  function getMaxDataTimestampDelay (  ) external view returns ( uint256 );
  function getTotalStakedValueYYAV3SA1 (  ) external view returns ( uint256 totalValue );
  function getTotalStakedValueYYVSAVAXV2 (  ) external view returns ( uint256 totalValue );
  function isSignerAuthorized ( address _receivedSigner ) external view returns ( bool );
  function isTimestampValid ( uint256 _receivedTimestamp ) external view returns ( bool );
  function stakeAVAXYak ( uint256 amount ) external;
  function stakeSAVAXYak ( uint256 amount ) external;
  function unstakeAVAXYak ( uint256 amount ) external;
  function unstakeSAVAXYak ( uint256 amount ) external;
}
