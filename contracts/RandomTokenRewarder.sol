// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {VRFV2WrapperConsumerBase} from "@chainlink/contracts/src/v0.8/vrf/VRFV2WrapperConsumerBase.sol";
import {LinkTokenInterface} from "@chainlink/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./SmartLoansFactory.sol";
import "./Pool.sol";


contract RandomTokenRewarder is
VRFV2WrapperConsumerBase,
ConfirmedOwner
{
    event RequestSent(uint256 requestId, uint32 numWords);

    // event for transferring reward to winner
    event RewardTransferred(address indexed winner, address indexed rewardToken, uint256 amount, uint256 blockNumber);

    // past requests Id.
    uint256[] public requestIds;
    uint256 public lastRequestId;

    // Depends on the number of requested values that you want sent to the
    // fulfillRandomWords() function. Test and adjust
    // this limit based on the network that you select, the size of the request,
    // and the processing of the callback request in the fulfillRandomWords()
    // function.
    uint32 callbackGasLimit = 1000000;

    // The default is 3, but you can set this higher.
    uint16 requestConfirmations = 3;

    // For this example, retrieve 2 random values in one request.
    // Cannot exceed VRFV2Wrapper.getConfig().maxNumWords.
    uint32 numWords = 1;

    uint256 public minimumGmBtcAmount = 100 * 1e18;
    uint256 public minimumGmBtcBorrowed = 187600;
    address public rewardToken = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;

    // setters for above 3 variables
    function setMinimumGmBtcAmount(uint256 _minimumGmBtcAmount) external onlyOwner {
        minimumGmBtcAmount = _minimumGmBtcAmount;
    }

    function setMinimumGmBtcBorrowed(uint256 _minimumGmBtcBorrowed) external onlyOwner {
        minimumGmBtcBorrowed = _minimumGmBtcBorrowed;
    }

    function setRewardToken(address _rewardToken) external onlyOwner {
        rewardToken = _rewardToken;
    }

    // ERC20 withdraw owner only
    function withdrawERC20(address _token, address _to, uint256 _amount) external onlyOwner {
        IERC20(_token).transfer(_to, _amount);
    }

    // Address LINK
    address public linkAddress = 0x5947BB275c521040051D82396192181b413227A3;
    // Address WRAPPER
    address public wrapperAddress = 0x721DFbc5Cfe53d32ab00A9bdFa605d3b8E1f3f42;
    // Address SmartLoansFactoryTUP
    address public smartLoansFactoryTUP = 0x3Ea9D480295A73fd2aF95b4D96c2afF88b21B03D;
    // Address DPBTC pool TUP
    address public btcPoolTUP = 0x475589b0Ed87591A893Df42EC6076d2499bB63d0;
    // Address GM BTC Avalanche
    address public gmBtcUsdcAvalanche = 0x913C1F46b48b3eD35E7dc3Cf754d4ae8499F31CF;

    constructor()
    ConfirmedOwner(msg.sender)
    VRFV2WrapperConsumerBase(linkAddress, wrapperAddress)
    {}

    function requestRewardDistributionWithRandomWords()
    external
    onlyOwner
    returns (uint256 requestId)
    {
        requestId = requestRandomness(
            callbackGasLimit,
            requestConfirmations,
            numWords
        );
        emit RequestSent(requestId, numWords);
        return requestId;
    }

    function isAccountEligible(address primeAccount) internal view returns (bool){
        return (
            Pool(btcPoolTUP).getBorrowed(primeAccount) >= minimumGmBtcBorrowed &&
            IERC20(gmBtcUsdcAvalanche).balanceOf(primeAccount) >= minimumGmBtcAmount
        );
    }

    function fulfillRandomWords(
        uint256 _requestId,
        uint256[] memory _randomWords
    ) internal override {
        uint256 randomWord = _randomWords[0];
        SmartLoansFactory slf = SmartLoansFactory(smartLoansFactoryTUP);
        uint256 numberOfPrimeAccounts = slf.getLoansLength();
        uint256 primeAccountIndex = randomWord % numberOfPrimeAccounts;
        bool found = false;
        while(!found){
            if(isAccountEligible(slf.getLoans(primeAccountIndex, 1)[0])){
                found = true;
                break;
            }
            if(primeAccountIndex == numberOfPrimeAccounts){
                primeAccountIndex = 0;
            } else {
                primeAccountIndex++;
            }
        }
        address primeAccountAddress = slf.getLoans(primeAccountIndex, 1)[0];
        uint256 rewardBalance = IERC20(rewardToken).balanceOf(address(this));
        IERC20(rewardToken).transfer(primeAccountAddress, rewardBalance);
        emit RewardTransferred(primeAccountAddress, rewardToken, rewardBalance, block.number);
    }
}

