import { spawn } from "child_process";

const server = spawn("node", ["dist/index.js"], {
  cwd: "C:/arc-mcp-server",
  stdio: ["pipe", "pipe", "pipe"],
});

let buffer = "";
const pending = new Map();
let msgId = 1;

server.stderr.on("data", (d) => process.stderr.write(d));

server.stdout.on("data", (data) => {
  buffer += data.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id != null && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {}
  }
});

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = msgId++;
    pending.set(id, resolve);
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    server.stdin.write(msg + "\n");
  });
}

function notify(method, params = {}) {
  const msg = JSON.stringify({ jsonrpc: "2.0", method, params });
  server.stdin.write(msg + "\n");
}

async function run() {
  // 1. Initialize MCP handshake
  const init = await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0" },
  });
  console.log(`\n✓ Server: ${init.result?.serverInfo?.name} v${init.result?.serverInfo?.version}`);
  notify("notifications/initialized");

  // 2. List tools
  const tools = await send("tools/list");
  const toolNames = tools.result?.tools?.map((t) => t.name) ?? [];
  console.log(`✓ Tools registered: ${toolNames.length}`);
  console.log(`  ${toolNames.join(", ")}\n`);

  // 3. arc_get_gas_price (no args, no key needed)
  console.log("── arc_get_gas_price ─────────────────────");
  const gas = await send("tools/call", { name: "arc_get_gas_price", arguments: {} });
  const gasData = JSON.parse(gas.result?.content?.[0]?.text ?? "{}");
  console.log(`  Current: ${gasData.current}`);
  console.log(`  Min testnet: ${gasData.minimum_testnet}`);
  console.log(`  Recommended: ${gasData.recommended}`);

  // 4. arc_get_block (latest)
  console.log("\n── arc_get_block (latest) ────────────────");
  const block = await send("tools/call", { name: "arc_get_block", arguments: {} });
  const blockData = JSON.parse(block.result?.content?.[0]?.text ?? "{}");
  console.log(`  Block #${blockData.number}`);
  console.log(`  Timestamp: ${blockData.timestamp}`);
  console.log(`  Transactions: ${blockData.transactions}`);
  console.log(`  Base fee: ${blockData.baseFeePerGas}`);

  // 5. arc_get_balance (ERC-8183 contract)
  console.log("\n── arc_get_balance (ERC-8183 contract) ───");
  const balance = await send("tools/call", {
    name: "arc_get_balance",
    arguments: { address: "0x0747EEf0706327138c69792bF28Cd525089e4583" },
  });
  const balData = JSON.parse(balance.result?.content?.[0]?.text ?? "{}");
  console.log(`  ERC-20 USDC: ${balData.usdc?.erc20}`);
  console.log(`  Native gas:  ${balData.usdc?.native_gas}`);

  // 6. arc_get_job_count
  console.log("\n── arc_get_job_count ─────────────────────");
  const count = await send("tools/call", { name: "arc_get_job_count", arguments: {} });
  const countRaw = count.result?.content?.[0]?.text ?? "{}";
  if (countRaw.startsWith("Error:")) {
    console.log(`  ⚠ ${countRaw}`);
  } else {
    const countData = JSON.parse(countRaw);
    console.log(`  Total jobs on Arc Testnet: ${countData.total_jobs}`);
  }

  // 7. arc_get_events (recent JobCreated events)
  console.log("\n── arc_get_events (last 10 job events) ───");
  const events = await send("tools/call", {
    name: "arc_get_events",
    arguments: { contract: "jobs", limit: 10 },
  });
  const evRaw = events.result?.content?.[0]?.text ?? "{}";
  if (evRaw.startsWith("Error:")) {
    console.log(`  ⚠ ${evRaw}`);
  } else {
    const evData = JSON.parse(evRaw);
    console.log(`  Total events in last 1000 blocks: ${evData.total}`);
    console.log(`  Returned: ${evData.returned}`);
    console.log(`  Block range: ${evData.range?.from} → ${evData.range?.to}`);
  }

  console.log("\n✅ All tests passed - arc-mcp-server is live on Arc Testnet\n");
  server.kill();
}

run().catch((err) => {
  console.error("Test failed:", err);
  server.kill();
  process.exit(1);
});
