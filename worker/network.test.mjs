import test from "node:test";
import assert from "node:assert/strict";
import { checkUrl, privateIp } from "./network.mjs";

test("bloqueia endereços internos e reservados", () => {
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "169.254.1.2",
    "192.168.0.1",
    "::1",
    "fd00::1",
    "::ffff:7f00:1",
    "2001:db8::1",
  ]) {
    assert.equal(privateIp(address), true, address);
  }
  assert.equal(privateIp("8.8.8.8"), false);
  assert.equal(privateIp("2606:4700:4700::1111"), false);
});

test("rejeita URLs locais, protocolos e credenciais", async () => {
  for (const url of [
    "http://localhost/",
    "http://localhost./",
    "file:///etc/passwd",
    "http://127.0.0.1/",
    "https://user:pass@example.com/",
    "http://example.com:8080/",
  ]) {
    await assert.rejects(checkUrl(url), undefined, url);
  }
});

test("permite a página de demonstração apenas quando habilitada", async () => {
  await assert.rejects(checkUrl("http://localhost:5173/"));
  assert.equal(
    await checkUrl("http://localhost:5173/", { allowDemo: true }),
    "http://localhost:5173/",
  );
});
