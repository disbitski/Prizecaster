// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

/**
 * @title PrizecasterVRF
 * @notice Chainlink VRF v2.5 subscription consumer for event raffle drawings.
 * @dev Example contract. Unaudited; review before production use.
 */
contract PrizecasterVRF is VRFConsumerBaseV2Plus {
    event RequestSent(uint256 indexed requestId, uint256 participantCount);
    event WinnerFulfilled(uint256 indexed requestId, uint256 indexed winnerNumber, uint256 randomWord);
    event RequestConfigUpdated(bytes32 keyHash, uint32 callbackGasLimit, uint16 requestConfirmations);

    struct RequestStatus {
        bool fulfilled;
        bool exists;
        uint256 participantCount;
        uint256 winnerNumber;
        uint256 randomWord;
    }

    mapping(uint256 requestId => RequestStatus status) private s_requests;

    uint256[] public requestIds;
    uint256 public lastRequestId;
    uint256 public s_subscriptionId;
    bytes32 public keyHash;
    uint32 public callbackGasLimit = 100_000;
    uint16 public requestConfirmations = 3;
    uint32 public constant NUM_WORDS = 1;

    constructor(
        address coordinatorAddress,
        uint256 subscriptionId,
        bytes32 initialKeyHash
    ) VRFConsumerBaseV2Plus(coordinatorAddress) {
        require(coordinatorAddress != address(0), "coordinator required");
        require(subscriptionId != 0, "subscription required");
        require(initialKeyHash != bytes32(0), "key hash required");
        s_subscriptionId = subscriptionId;
        keyHash = initialKeyHash;
    }

    function requestWinner(
        uint256 participantCount,
        bool enableNativePayment
    ) external onlyOwner returns (uint256 requestId) {
        require(participantCount > 0, "participants required");

        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: s_subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: enableNativePayment})
                )
            })
        );

        s_requests[requestId] = RequestStatus({
            fulfilled: false,
            exists: true,
            participantCount: participantCount,
            winnerNumber: 0,
            randomWord: 0
        });

        requestIds.push(requestId);
        lastRequestId = requestId;

        emit RequestSent(requestId, participantCount);
    }

    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        RequestStatus storage request = s_requests[requestId];
        require(request.exists, "request not found");

        uint256 randomWord = randomWords[0];
        uint256 winnerNumber = (randomWord % request.participantCount) + 1;

        request.fulfilled = true;
        request.randomWord = randomWord;
        request.winnerNumber = winnerNumber;

        emit WinnerFulfilled(requestId, winnerNumber, randomWord);
    }

    function getRequestStatus(
        uint256 requestId
    )
        external
        view
        returns (
            bool fulfilled,
            uint256 participantCount,
            uint256 winnerNumber,
            uint256 randomWord
        )
    {
        RequestStatus memory request = s_requests[requestId];
        require(request.exists, "request not found");
        return (request.fulfilled, request.participantCount, request.winnerNumber, request.randomWord);
    }

    function setRequestConfig(
        bytes32 newKeyHash,
        uint32 newCallbackGasLimit,
        uint16 newRequestConfirmations
    ) external onlyOwner {
        require(newKeyHash != bytes32(0), "key hash required");
        require(newCallbackGasLimit > 0, "gas limit required");
        require(newRequestConfirmations >= 3, "confirmations too low");

        keyHash = newKeyHash;
        callbackGasLimit = newCallbackGasLimit;
        requestConfirmations = newRequestConfirmations;

        emit RequestConfigUpdated(newKeyHash, newCallbackGasLimit, newRequestConfirmations);
    }

    function setSubscriptionId(uint256 newSubscriptionId) external onlyOwner {
        require(newSubscriptionId != 0, "subscription required");
        s_subscriptionId = newSubscriptionId;
    }
}
