pragma solidity ^0.8.17;

interface IGLPFacet {
    function claimGLpFees() external;

    function mintAndStakeGlp(address _token, uint256 _amount, uint256 _minUsdg, uint256 _minGlp) external returns(uint256);

    function unstakeAndRedeemGlp(address _tokenOut, uint256 _glpAmount, uint256 _minOut) external returns(uint256);

    event GLPMint(address indexed user, bytes32 indexed tokenToMintWith, uint256 tokenToMintWithAmount, uint256 glpOutputAmount, uint256 timestamp);

    event GLPRedemption(address indexed user, bytes32 indexed redeemedToken, uint256 glpRedeemedAmount, uint256 redeemedTokenAmount, uint256 timestamp);
}
