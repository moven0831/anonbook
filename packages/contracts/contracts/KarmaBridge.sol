// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Unirep} from "@unirep/contracts/Unirep.sol";
import {EpochKeyVerifierHelper} from "@unirep/contracts/verifierHelpers/EpochKeyVerifierHelper.sol";

contract KarmaBridge {
    Unirep public immutable unirep;
    EpochKeyVerifierHelper public immutable epkHelper;

    address public owner;

    uint256 public constant NEWCOMER = 1;
    uint256 public constant CONTRIBUTOR = 10;
    uint256 public constant TRUSTED = 100;
    uint256 public constant LEGEND = 1000;

    modifier onlyOwner() {
        require(msg.sender == owner, "Ownable: caller is not the owner");
        _;
    }

    constructor(
        Unirep _unirep,
        EpochKeyVerifierHelper _epkHelper,
        uint48 _epochLength
    ) {
        unirep = _unirep;
        epkHelper = _epkHelper;
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
        uint256[] calldata publicSignals,
        uint256[8] calldata proof,
        uint256 karma
    ) public onlyOwner {
        EpochKeyVerifierHelper.EpochKeySignals memory signals =
            epkHelper.verifyAndCheckCaller(publicSignals, proof);

        uint48 targetEpoch = unirep.attesterCurrentEpoch(
            uint160(address(this))
        );

        unirep.attest(signals.epochKey, targetEpoch, 0, karma);
    }
}
