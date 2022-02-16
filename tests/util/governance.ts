import { Keyring } from "@axiaaxc/api";
import { ApiTypes, SubmittableExtrinsic } from "@axiaaxc/api/types";
import { KeyringPair } from "@axiaaxc/keyring/types";
import { blake2AsHex } from "@axiaaxc/util-crypto";
import {
  ALITH_PRIV_KEY,
  BALTATHAR_PRIV_KEY,
  CHARLETH_PRIV_KEY,
  DOROTHY_PRIV_KEY,
} from "./constants";
import { DevTestContext } from "./setup-dev-tests";
import { createBlockWithExtrinsic } from "./axlib-rpc";

const keyring = new Keyring({ type: "ethereum" });

export const notePreimage = async <
  Call extends SubmittableExtrinsic<ApiType>,
  ApiType extends ApiTypes
>(
  context: DevTestContext,
  proposal: Call,
  account: KeyringPair
): Promise<string> => {
  const encodedProposal = proposal.method.toHex() || "";
  await context.axiaaxcApi.tx.democracy.notePreimage(encodedProposal).signAndSend(account);
  await context.createBlock();

  return blake2AsHex(encodedProposal);
};

export const execFromTwoThirdsOfCouncil = async <
  Call extends SubmittableExtrinsic<ApiType>,
  ApiType extends ApiTypes
>(
  context: DevTestContext,
  axiaaxcCall: Call
) => {
  // Council members
  const charleth = await keyring.addFromUri(CHARLETH_PRIV_KEY, null, "ethereum");
  const dorothy = await keyring.addFromUri(DOROTHY_PRIV_KEY, null, "ethereum");

  // Charleth submit the proposal to the council (and therefore implicitly votes for)
  let lengthBound = axiaaxcCall.encodedLength;
  const { events: proposalEvents } = await createBlockWithExtrinsic(
    context,
    charleth,
    context.axiaaxcApi.tx.councilCollective.propose(2, axiaaxcCall, lengthBound)
  );
  const proposalHash = proposalEvents
    .find((e) => e.method.toString() == "Proposed")
    .data[2].toHex() as string;

  // Dorothy vote for this proposal and close it
  await Promise.all([
    context.axiaaxcApi.tx.councilCollective.vote(proposalHash, 0, true).signAndSend(charleth),
    context.axiaaxcApi.tx.councilCollective.vote(proposalHash, 0, true).signAndSend(dorothy),
  ]);
  await context.createBlock();

  return await createBlockWithExtrinsic(
    context,
    dorothy,
    context.axiaaxcApi.tx.councilCollective.close(proposalHash, 0, 1_000_000_000, lengthBound)
  );
};

export const execFromAllMembersOfTechCommittee = async <
  Call extends SubmittableExtrinsic<ApiType>,
  ApiType extends ApiTypes
>(
  context: DevTestContext,
  axiaaxcCall: Call
) => {
  // Tech committee members
  const alith = await keyring.addFromUri(ALITH_PRIV_KEY, null, "ethereum");
  const baltathar = await keyring.addFromUri(BALTATHAR_PRIV_KEY, null, "ethereum");

  // Alith submit the proposal to the council (and therefore implicitly votes for)
  let lengthBound = axiaaxcCall.encodedLength;
  const { events: proposalEvents } = await createBlockWithExtrinsic(
    context,
    alith,
    context.axiaaxcApi.tx.techCommitteeCollective.propose(2, axiaaxcCall, lengthBound)
  );
  const proposalHash = proposalEvents
    .find((e) => e.method.toString() == "Proposed")
    .data[2].toHex() as string;

  // Get proposal count
  const proposalCount = await context.axiaaxcApi.query.techCommitteeCollective.proposalCount();

  // Alith, Baltathar vote for this proposal and close it
  await Promise.all([
    context.axiaaxcApi.tx.techCommitteeCollective
      .vote(proposalHash, Number(proposalCount) - 1, true)
      .signAndSend(alith),
    context.axiaaxcApi.tx.techCommitteeCollective
      .vote(proposalHash, Number(proposalCount) - 1, true)
      .signAndSend(baltathar),
  ]);

  await context.createBlock();
  await context.createBlock();
  return await createBlockWithExtrinsic(
    context,
    baltathar,
    context.axiaaxcApi.tx.techCommitteeCollective.close(
      proposalHash,
      Number(proposalCount) - 1,
      1_000_000_000,
      lengthBound
    )
  );
};
