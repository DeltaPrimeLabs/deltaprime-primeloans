interface ISmartLoanWrappedNativeTokenFacet {
  function depositNativeToken (  ) payable external;
  function unwrapAndWithdraw ( uint256 _amount ) payable external;
  function wrapNativeToken ( uint256 amount ) external;
}
