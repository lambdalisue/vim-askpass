import type { Denops } from "https://deno.land/x/denops_std@v3.1.4/mod.ts";
import * as path from "https://deno.land/std@0.128.0/path/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v3.1.4/batch/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v3.1.4/variable/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v3.1.4/function/mod.ts";
import * as unknownutil from "https://deno.land/x/unknownutil@v1.1.0/mod.ts";
import { Session } from "https://deno.land/x/msgpack_rpc@v3.1.4/mod.ts";
import { ASKPASS_ADDRESS } from "./const.ts";

export async function main(denops: Denops): Promise<void> {
  const [disableSsh, disableSudo] = await batch.gather(
    denops,
    async (denops) => {
      await vars.g.get(denops, "askpass_disable_ssh", 0);
      await vars.g.get(denops, "askpass_disable_sudo", 0);
    },
  ) as [number, number];
  listen(denops).catch((e) => {
    console.error(
      `[askpass] Unexpected error occurred for Neovim listener: ${e}`,
    );
  });
  const askpass = path.fromFileUrl(new URL("./cli.ts", import.meta.url));
  await batch.batch(denops, async (denops) => {
    await vars.e.set(denops, "ASKPASS", askpass);
    if (!disableSsh) {
      // NOTE: it may be necessary to redirect the input from /dev/null
      // https://man.openbsd.org/ssh#SSH_ASKPASS
      await vars.e.set(
        denops,
        "DISPLAY",
        await vars.e.get(denops, "DISPLAY", "dummy:0"),
      );
      await vars.e.set(denops, "SSH_ASKPASS", askpass);
    }
    if (!disableSudo) {
      // NOTE: Add `-A` option to enable this feature
      // https://man7.org/linux/man-pages/man8/sudo.8.html
      await vars.e.set(denops, "SUDO_ASKPASS", askpass);
    }
  });
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
