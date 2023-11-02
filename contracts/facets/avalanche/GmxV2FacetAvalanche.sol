// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 799a1765b64edc5c158198ef84f785af79e234ae;
pragma solidity 0.8.17;

//This path is updated during deployment
import "../GmxV2Facet.sol";

abstract contract GmxV2FacetAvalanche is GmxV2Facet {
    using TransferHelper for address;

    // https://github.com/gmx-io/gmx-synthetics/blob/main/deployments/avalanche/
    // GMX contracts
    function getGMX_V2_ROUTER() internal pure virtual override returns (address) {
        return 0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6;
    }

    function getGMX_V2_EXCHANGE_ROUTER() internal pure virtual override returns (address) {
        return 0x11E590f6092D557bF71BaDEd50D81521674F8275;
    }

    function getGMX_V2_DEPOSIT_VAULT() internal pure virtual override returns (address) {
        return 0x90c670825d0C62ede1c5ee9571d6d9a17A722DFF;
    }

    function getGMX_V2_WITHDRAWAL_VAULT() internal pure virtual override returns (address) {
        return 0xf5F30B10141E1F63FC11eD772931A8294a591996;
    }

    // TODO: Dynamically source whitelisted keepers?
    function getGMX_V2_KEEPER() internal pure virtual override returns (address) {
        return 0xE47b36382DC50b90bCF6176Ddb159C4b9333A7AB;
    }

    // Markets

    // Tokens

    // Mappings
    function marketToLongToken(address market) internal override pure returns (address){
        revert("Not implemented");
    }

    function marketToShortToken(address market) internal override pure returns (address){
        revert("Not implemented");
    }

    // MODIFIERS
    modifier onlyWhitelistedAccounts {
        if(
            msg.sender == 0x0E5Bad4108a6A5a8b06820f98026a7f3A77466b2 ||
            msg.sender == 0x2fFA7E9624B923fA811d9B9995Aa34b715Db1945 ||
            msg.sender == 0x0d7137feA34BC97819f05544Ec7DE5c98617989C ||
            msg.sender == 0xC6ba6BB819f1Be84EFeB2E3f2697AD9818151e5D ||
            msg.sender == 0x14f69F9C351b798dF31fC53E33c09dD29bFAb547 ||
            msg.sender == 0x5C23Bd1BD272D22766eB3708B8f874CB93B75248 ||
            msg.sender == 0x000000F406CA147030BE7069149e4a7423E3A264 ||
            msg.sender == 0x5D80a1c0a5084163F1D2620c1B1F43209cd4dB12 ||
            msg.sender == 0xb79c2A75cd9073d68E75ddF71D53C07747Df7933 ||
            msg.sender == 0x6C21A841d6f029243AF87EF01f6772F05832144b
        ){
            _;
        } else {
            revert("Not whitelisted");
        }
    }
}
