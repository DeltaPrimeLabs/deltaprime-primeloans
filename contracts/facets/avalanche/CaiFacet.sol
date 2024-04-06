// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 70f3282b1751e5abb80bec8675a5d2be940a592e;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../ReentrancyGuardKeccak.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../lib/SolvencyMethods.sol";
import "../../interfaces/IWrappedNativeToken.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract CaiFacet is ReentrancyGuardKeccak, SolvencyMethods {
    using TransferHelper for address;

    address private constant INDEX_ROUTER =
        0xD6dd95610fC3A3579a2C32fe06158d8bfB8F4eE9;

    address private constant CAI = 0x48f88A3fE843ccb0b5003e70B4192c1d7448bEf0;

    function mintCai(
        bytes4 selector,
        bytes memory data,
        address fromToken,
        uint256 fromAmount,
        uint256 minOut
    ) external nonReentrant onlyOwner remainsSolvent {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        require(minOut > 0, "minOut needs to be > 0");
        require(
            fromAmount > 0,
            "Amount of tokens to sell has to be greater than 0"
        );

        bytes32 fromTokenSymbol = tokenManager.tokenAddressToSymbol(fromToken);

        address(fromToken).safeApprove(INDEX_ROUTER, 0);
        address(fromToken).safeApprove(INDEX_ROUTER, fromAmount);

        uint256 beforeCaiBalance = IERC20(CAI).balanceOf(address(this));
        uint256 beforeFromTokenBalance = IERC20(fromToken).balanceOf(address(this));

        (bool success, ) = INDEX_ROUTER.call((abi.encodePacked(selector, data)));
        require(success, "Mint failed");

        uint256 afterCaiBalance = IERC20(CAI).balanceOf(address(this));
        uint256 afterFromTokenBalance = IERC20(fromToken).balanceOf(address(this));

        address(CAI).safeApprove(INDEX_ROUTER, 0);
        address(CAI).safeApprove(INDEX_ROUTER, type(uint256).max);

        uint256 caiBoughtAmount = afterCaiBalance - beforeCaiBalance;
        require(caiBoughtAmount >= minOut, "Too little received");

        _increaseExposure(tokenManager, CAI, caiBoughtAmount);
        _decreaseExposure(tokenManager, fromToken, beforeFromTokenBalance - afterFromTokenBalance);

        emit CaiMinted(
            msg.sender,
            fromTokenSymbol,
            fromAmount,
            caiBoughtAmount,
            block.timestamp
        );
    }

    function burnCai(
        bytes4 selector,
        bytes memory data,
        uint256 shares,
        address toToken,
        uint256 minOut
    ) external nonReentrant onlyOwner remainsSolvent {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        require(minOut > 0, "minOut needs to be > 0");
        require(shares > 0, "Amount of tokens to sell has to be greater than 0");

        bytes32 toTokenSymbol = tokenManager.tokenAddressToSymbol(toToken);

        address(CAI).safeApprove(INDEX_ROUTER, 0);
        address(CAI).safeApprove(INDEX_ROUTER, shares);

        uint256 beforeCaiBalance = IERC20(CAI).balanceOf(address(this));
        uint256 beforeTokenBalance = IERC20(toToken).balanceOf(address(this));

        (bool success, ) = INDEX_ROUTER.call((abi.encodePacked(selector, data)));
        require(success, "Burn failed");

        uint256 afterCaiBalance = IERC20(CAI).balanceOf(address(this));
        uint256 afterTokenBalance = IERC20(toToken).balanceOf(address(this));

        uint256 boughtAmount = afterTokenBalance - beforeTokenBalance;
        require(boughtAmount >= minOut, "Too little received");

        _decreaseExposure(tokenManager, CAI, beforeCaiBalance - afterCaiBalance);
        _increaseExposure(tokenManager, toToken, boughtAmount);

        emit CaiBurned(
            msg.sender,
            shares,
            toTokenSymbol,
            boughtAmount,
            block.timestamp
        );
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /* ========== RECEIVE AVAX FUNCTION ========== */
    receive() external payable {}

    /**
     * @dev emitted after a CAI mint
     * @param user the address of user minting the CAI
     * @param soldAsset sold by the user
     * @param amountSold amount of tokens sold
     * @param amountMinted amount of CAI minted
     * @param timestamp time of the mint
     **/
    event CaiMinted(
        address indexed user,
        bytes32 indexed soldAsset,
        uint256 amountSold,
        uint256 amountMinted,
        uint256 timestamp
    );

    /**
     * @dev emitted after a CAI mint
     * @param user the address of user minting the CAI
     * @param shares amount of CAI burned
     * @param buyAsset redeemed by the user
     * @param amountRedeemed amount of CAI minted
     * @param timestamp time of the mint
     **/
    event CaiBurned(
        address indexed user,
        uint256 indexed shares,
        bytes32 indexed buyAsset,
        uint256 amountRedeemed,
        uint256 timestamp
    );
}
