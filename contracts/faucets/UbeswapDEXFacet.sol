pragma solidity ^0.8.4;

import "./UniswapV2DEXFacet.sol";

contract UbeswapDEXFacet is UniswapV2DEXFacet {

    /**
    * Swaps one asset to another
    * @param _soldAsset asset to be sold
    * @param _boughtAsset asset to be bought
    * @param _exactSold exact amount of asset to be sold
    * @param _minimumBought minimum amount of asset to be bought
    * @dev This function uses the redstone-evm-connector
    **/
    function swapUbeswap(bytes32 _soldAsset, bytes32 _boughtAsset, uint256 _exactSold, uint256 _minimumBought) public onlyOwner remainsSolvent returns (uint256[] memory) {
        return swapAssets(_soldAsset, _boughtAsset, _exactSold, _minimumBought);
    }

    /**
     * Returns address of UniswapV2-like exchange
     **/
    function getExchangeIntermediaryContract() public override returns (address) {
        return 0x5C858338E60Efa214446Ca0d0Ec88ad2F09AB996;
    }
}