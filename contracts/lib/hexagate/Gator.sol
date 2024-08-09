// SPDX-License-Identifier: PRIVATE
// all rights reserved to Hexagate

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

interface IGator {
    function initialize(address owner) external;

    function enter(bytes4 signature) external;
    function exit(bytes4 signature) external;

    function approveClient(address client) external;
    function approveClients(address[] calldata clients) external;

    function denyClient(address client) external;
    function denyClients(address[] calldata clients) external;

    function approveFlow(bytes32 flow) external;
    function approveFlows(bytes32[] calldata flows) external;

    function denyFlow(bytes32 flow) external;
    function denyFlows(bytes32[] calldata flows) external;

    function enable() external;
    function disable() external;
}

error ClientNotApproved(address client);
error FlowNotApproved(bytes32 flow);
error AlreadyEnabled();
error AlreadyDisabled();

contract Gator is Ownable, Initializable, UUPSUpgradeable {
    // == Events ==
    event Enabled();
    event Disabled();
    event ClientApproved(address indexed client);
    event ClientDenied(address indexed client);
    event FlowApproved(bytes32 indexed flow);
    event FlowDenied(bytes32 indexed flow);

    // == Constants ==
    uint256 private constant FALSE = 1;
    uint256 private constant TRUE = 2;
    // keccak("gator.flow")
    uint256 private constant FLOW_SLOT = 0xe2f2692cd9a0f44c494c30611a5682d690a3ed957ac1867be2e6a4a331e5b271;

    // == Storage data ==
    uint256 public $enabled;
    mapping(bytes32 => uint256) private $allowedFlows;
    mapping(address => uint256) private $gatedClients;

    // This contract is to be used behind a proxy, so the constructor should not be used
    constructor() Ownable() {
        _disableInitializers();
    }

    // Allow upgrades to this contract by the owner
    function _authorizeUpgrade(address) internal override onlyOwner {}

    // This initializer is used instead of the constructor
    function initialize(address owner) external initializer {
        _transferOwnership(owner);
        $enabled = TRUE;
    }

    // == Modifiers ==

    modifier onlyGated() {
        if ($gatedClients[msg.sender] != TRUE) {
            revert ClientNotApproved(msg.sender);
        }

        _;
    }

    // == Gator client called functions ==

    function _checkFlow(bytes4 selector, bool isEnter) internal {
        if ($enabled == FALSE) {
            return;
        }

        bytes32 flow;
        // Load the current flow identifier from the transient storage
        // slot `FLOW_SLOT`
        assembly {
            flow := sload(FLOW_SLOT)
        }

        // Calculate the the new flow identifier according to the current state
        flow = keccak256(abi.encodePacked(flow, msg.sender, selector, isEnter));
        if ($allowedFlows[flow] != TRUE) {
            revert FlowNotApproved(flow);
        }

        // Store the new flow identifier to the transient storage
        // slot `FLOW_SLOT`
        assembly {
            sstore(FLOW_SLOT, flow)
        }
    }

    function enter(bytes4 selector) external onlyGated {
        _checkFlow(selector, true);
    }

    function exit(bytes4 selector) external onlyGated {
        _checkFlow(selector, false);
    }

    // == Admin functions ==

    function approveFlow(bytes32 flow) public onlyOwner {
        $allowedFlows[flow] = TRUE;
        emit FlowApproved(flow);
    }

    function approveFlows(bytes32[] calldata flows) external onlyOwner {
        for (uint256 i = 0; i < flows.length; i++) {
            approveFlow(flows[i]);
        }
    }

    function denyFlow(bytes32 flow) public onlyOwner {
        $allowedFlows[flow] = FALSE;
        emit FlowDenied(flow);
    }

    function denyFlows(bytes32[] calldata flows) external onlyOwner {
        for (uint256 i = 0; i < flows.length; i++) {
            denyFlow(flows[i]);
        }
    }

    function approveClient(address client) public onlyOwner {
        $gatedClients[client] = TRUE;
        emit ClientApproved(client);
    }

    function approveClients(address[] calldata clients) external onlyOwner {
        for (uint256 i = 0; i < clients.length; i++) {
            approveClient(clients[i]);
        }
    }

    function denyClient(address client) public onlyOwner {
        $gatedClients[client] = FALSE;
        emit ClientDenied(client);
    }

    function denyClients(address[] calldata clients) external onlyOwner {
        for (uint256 i = 0; i < clients.length; i++) {
            denyClient(clients[i]);
        }
    }

    function enable() public onlyOwner {
        if ($enabled == TRUE) {
            revert AlreadyEnabled();
        }
        $enabled = TRUE;
        emit Enabled();
    }

    function disable() public onlyOwner {
        if ($enabled == FALSE) {
            revert AlreadyDisabled();
        }
        $enabled = FALSE;
        emit Disabled();
    }
}
