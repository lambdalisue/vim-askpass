import type { Denops } from "https://deno.land/x/denops_std@v1.8.0/mod.ts";
import * as path from "https://deno.land/std@0.106.0/path/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v1.8.0/variable/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v1.8.0/function/mod.ts";
import * as unknownutil from "https://deno.land/x/unknownutil@v1.1.0/mod.ts";
import { Session } from "https://deno.land/x/msgpack_rpc@v3.1.0/mod.ts";
import { ASKPASS_ADDRESS } from "./const.ts";

export async function main(denops: Denops): Promise<void> {
  listen(denops).catch((e) => {
    console.error(
      `[askpass] Unexpected error occurred for Neovim listener: ${e}`,
    );
  });
  const askpass = path.fromFileUrl(new URL("./cli.ts", import.meta.url));
  await vars.e.set(denops, "ASKPASS", askpass);
}

async function listen(denops: Denops): Promise<void> {
  const listener = Deno.listen({
    hostname: "127.0.0.1",
    port: 0, // Automatically select free port
  });
  await vars.e.set(
    denops,
    ASKPASS_ADDRESS,
    JSON.stringify(listener.addr),
  );
  for await (const conn of listener) {
    handle(denops, conn).catch((e) => {
      console.error(`[askpass] Unexpected error occurred: ${e}`);
    });
  }
}

function handle(denops: Denops, conn: Deno.Conn): Promise<void> {
  const session = new Session(conn, conn, {
    async ask(prompt: unknown) {
      unknownutil.ensureString(prompt);
      return await fn.inputsecret(denops, prompt);
    },
  });
  return session.waitClosed();
}