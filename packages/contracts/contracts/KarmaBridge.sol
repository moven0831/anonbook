// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Unirep} from "@unirep/contracts/Unirep.sol";

contract KarmaBridge {
    Unirep public immutable unirep;

    address public owner;

    // Tier thresholds (for reference; proofs are verified on-chain)
    uint256 public constant NEWCOMER = 1;
    uint256 public constant CONTRIBUTOR = 10;
    uint256 public constant TRUSTED = 100;
    uint256 public constant LEGEND = 1000;

    modifier onlyOwner() {
        require(msg.sender == owner, "Ownable: caller is not the owner");
        _;
    }

    constructor(Unirep _unirep, uint48 _epochLength) {
        unirep = _unirep;
        owner = msg.sender;
        unirep.attesterSignUp(_epochLength);
    }

    function userSignUp(
        uint256[] calldata publicSignals,
        uint256[8] calldata proof
    ) public onlyOwner {
        unirep.userSignUp(publicSignals, proof);
    }

    function attestKarma(
        uint256 epochKey,
        uint48 targetEpoch,
        uint256 karma
    ) public onlyOwner {
        // Attest karma into data[0]
        unirep.attest(epochKey, targetEpoch, 0, karma);
    }
}
