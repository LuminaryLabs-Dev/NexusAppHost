import test from "node:test";
import assert from "node:assert/strict";
import { Network, normalizePublicUrl, publicIPv4 } from "../src/services/network.mjs";
const resolver = async () => [{ address: "93.184.216.34", family: 4 }];
function networkWith(routes) {
  const calls = [];
  const network = new Network({
    resolver,
    transport: async (url, address) => {
      calls.push({ url: url.href, address });
      const result = routes[url.href];
      if (!result) throw new Error(`Unexpected URL ${url.href}`);
      return result;
    },
  });
  return { network, calls };
}
test("public IPv4 filter rejects local, private, benchmark and documentation ranges", () => {
  for (const ip of ["0.0.0.1","10.0.0.1","100.64.0.1","127.0.0.1","169.254.1.1","172.16.0.1","192.168.1.1","192.0.2.1","198.18.0.1","198.51.100.2","203.0.113.9","224.0.0.1","255.255.255.255"])
    assert.equal(publicIPv4(ip), false, ip);
  assert.equal(publicIPv4("93.184.216.34"), true);
  assert.equal(publicIPv4("192.0.1.1"), true);
});
test("URL policy allows only public HTTP(S) on standard ports without credentials", () => {
  assert.equal(normalizePublicUrl("https://example.com/a#frag").href, "https://example.com/a");
  for (const url of ["file:///etc/passwd","http://localhost/","http://127.0.0.1/","https://user:pass@example.com/","https://example.com:8443/","http://[::1]/"])
    assert.throws(() => normalizePublicUrl(url), { name: "HostError" });
});
test("fetch returns one readable page and preserves final URL", async () => {
  const { network, calls } = networkWith({"https://example.com/":{status:200,headers:{"content-type":"text/html; charset=utf-8"},body:"<title>Example</title><p>Hello</p>"}});
  const result = await network.fetch({url:"https://example.com/"});
  assert.equal(result.url,"https://example.com/");
  assert.equal(result.status,200);
  assert.match(result.body,/Hello/);
  assert.match(result.fetchedAt,/^\d{4}-\d{2}-\d{2}T/);
  assert.equal(calls.length,1);
});
test("redirects are followed through the same public policy", async () => {
  const { network, calls } = networkWith({
    "https://example.com/start":{status:302,headers:{location:"/final"},body:""},
    "https://example.com/final":{status:200,headers:{"content-type":"text/plain"},body:"done"},
  });
  const result=await network.fetch({url:"https://example.com/start"});
  assert.equal(result.url,"https://example.com/final");
  assert.equal(result.body,"done");
  assert.equal(calls.length,2);
});
test("redirects to local/private targets are rejected before transport", async () => {
  const { network, calls }=networkWith({"https://example.com/start":{status:302,headers:{location:"http://127.0.0.1/private"},body:""}});
  await assert.rejects(network.fetch({url:"https://example.com/start"}),{code:"NETWORK_PRIVATE"});
  assert.equal(calls.length,1);
});
test("HTTP errors, unreadable types and oversized bodies fail clearly", async () => {
  for (const [response,code] of [
    [{status:403,headers:{"content-type":"text/html"},body:"denied"},"NETWORK_HTTP"],
    [{status:200,headers:{"content-type":"application/pdf"},body:"%PDF"},"NETWORK_TYPE"],
    [{status:200,headers:{"content-type":"text/html"},body:"x".repeat(180001)},"NETWORK_SIZE"],
  ]) {
    const {network}=networkWith({"https://example.com/":response});
    await assert.rejects(network.fetch({url:"https://example.com/"}),{code});
  }
});
test("payload cannot smuggle headers or additional fetch options", async () => {
  const {network}=networkWith({});
  await assert.rejects(network.fetch({url:"https://example.com/",headers:{authorization:"secret"}}),{code:"NETWORK_PAYLOAD"});
});
