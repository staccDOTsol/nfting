import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Nfting } from "../target/types/nfting";

describe("nfting", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.nfting as Program<Nfting>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
