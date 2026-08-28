import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAccount, createClient, chains } from "../vendor/genlayer-js/index.js";
import { TransactionHashVariant } from "../vendor/genlayer-js/types/index.js";
import { waitForFinalizedTransaction } from "../lib/receipt.ts";
import { nativePayoutDelivered } from "../lib/payout.ts";

if (process.env.RUN_STUDIONET_LIFECYCLE !== "1") throw new Error("Set RUN_STUDIONET_LIFECYCLE=1 explicitly; this script creates sandbox records and tiny test-value transactions.");
export const deployment=JSON.parse(readFileSync(new URL("../lib/deployment.json",import.meta.url),"utf8"));
assert.equal(deployment.network,"studionet");
assert.equal(deployment.chainId,61999);
export const reader=createClient({chain:chains.studionet,endpoint:deployment.rpcUrl});
assert.equal(await reader.getChainId(),61999,"Never run this harness outside Studionet");
export const accounts=[createAccount(),createAccount()];
export const clients=accounts.map(account=>createClient({chain:chains.studionet,endpoint:deployment.rpcUrl,account}));
export const evidence=[];
export function log(event,details={}) {console.log(JSON.stringify({at:new Date().toISOString(),event,...details},(_,value)=>typeof value==="bigint"?value.toString():value));}
export async function read(method,args=[]) {return reader.readContract({address:deployment.contractAddress,functionName:method,args,jsonSafeReturn:true,transactionHashVariant:TransactionHashVariant.LATEST_FINAL});}
export async function write(index,method,args=[],value=0n) {
  assert.ok(value>=0n&&value<=1000n,"Test-value limit is 1000 wei per call");
  log("submitting",{method,args,account:accounts[index].address,value});
  const hash=await clients[index].writeContract({address:deployment.contractAddress,functionName:method,args,value,leaderOnly:false,consensusMaxRotations:5});
  log("submitted",{method,hash});
  await waitForFinalizedTransaction(String(hash),()=>reader.getTransaction({hash}),{
    onProgress:({status})=>log("progress",{method,hash,status}),
  });
  evidence.push({method,hash});
  log("finalized_success",{method,hash});
  return hash;
}
export async function payoutDelivery(hash, recipient, amount) {
  const ids=await reader.getTriggeredTransactionIds({hash});
  const children=[];
  for(const id of ids) {
    const child=await reader.request({method:"eth_getTransactionByHash",params:[id]});
    const delivered=nativePayoutDelivered(child,{contract:deployment.contractAddress,recipient,amount:BigInt(amount)});
    children.push({hash:id,status:child.status,value:child.value,recipient:child.to_address,delivered});
  }
  log("payout_children",{parent:hash,children,deliveryProven:children.length===1&&children.every(child=>child.delivered)});
  return children;
}
