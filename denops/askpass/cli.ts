#!/usr/bin/env -S deno run --no-check --allow-env=ASKPASS_ADDRESS --allow-net=127.0.0.1
import { Session } from "https://deno.land/x/msgpack_rpc@v3.1.4/mod.ts";
import { writeAll } from "https://deno.land/std@0.128.0/io/mod.ts";
import { ASKPASS_ADDRESS } from "./const.ts";

const addr = Deno.env.get(ASKPASS_ADDRESS);
if (!addr) {
  throw new Error(`No ${ASKPASS_ADDRESS} environment variable found`);
}

const conn = await Deno.connect(JSON.parse(addr));
const session = new Session(conn, conn);
const input = await session.call("ask", Deno.args[0] ?? "") as string;
const encoder = new TextEncoder();
await writeAll(Deno.stdout, encoder.encode(input));
session.close();
conn.close();
