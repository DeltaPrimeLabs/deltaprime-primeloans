interface IFundingFacet {
  function _getLTV (  ) external returns ( uint256 ltv );
  function borrow ( bytes32 _asset, uint256 _amount ) external;
  function fund ( bytes32 _fundedAsset, uint256 _amount ) external;
  function getMaxBlockTimestampDelay (  ) external view returns ( uint256 );
  function getMaxDataTimestampDelay (  ) external view returns ( uint256 );
  function isSignerAuthorized ( address _receivedSigner ) external view returns ( bool );
  function isTimestampValid ( uint256 _receivedTimestamp ) external view returns ( bool );
  function repay ( bytes32 _asset, uint256 _amount ) external;
  function withdraw ( bytes32 _withdrawnAsset, uint256 _amount ) external;
}
