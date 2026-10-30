const test = require("node:test");
const assert = require("node:assert/strict");
const { isMobileRequest, mobilePathFor, isMobilePath } = require("../src/lib/device");

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  android: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
  androidTablet: "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
};

const req = (headers) => ({ get: (name) => headers[name.toLowerCase()] });

test("device: celulares recebem a versão mobile", () => {
  assert.equal(isMobileRequest(req({ "user-agent": UA.iphone })), true);
  assert.equal(isMobileRequest(req({ "user-agent": UA.android })), true);
});

test("device: tablets e computadores ficam na versão completa", () => {
  assert.equal(isMobileRequest(req({ "user-agent": UA.androidTablet })), false);
  assert.equal(isMobileRequest(req({ "user-agent": UA.ipad })), false);
  assert.equal(isMobileRequest(req({ "user-agent": UA.windows })), false);
  assert.equal(isMobileRequest(req({})), false);
});

test("device: Client Hint prevalece sobre o user-agent", () => {
  assert.equal(isMobileRequest(req({ "sec-ch-ua-mobile": "?1", "user-agent": UA.windows })), true);
  // "Versão para computador" no Chrome Android.
  assert.equal(isMobileRequest(req({ "sec-ch-ua-mobile": "?0", "user-agent": UA.android })), false);
});

test("device: rotas da versão completa têm equivalente mobile", () => {
  assert.equal(mobilePathFor("/reports/new"), "/m/reports/new");
  assert.equal(mobilePathFor("/reports/42"), "/m/reports/42");
  assert.equal(mobilePathFor("/history"), "/m/history");
  assert.equal(mobilePathFor("/notifications"), "/m/notifications");
  assert.equal(mobilePathFor("/change-password"), "/m/change-password");
  assert.equal(mobilePathFor("/profile"), "/m");
  assert.equal(mobilePathFor("/admin/reports"), "/m");
  assert.equal(mobilePathFor("/"), "/m");
  assert.equal(isMobilePath("/m"), true);
  assert.equal(isMobilePath("/m/reports/1"), true);
  assert.equal(isMobilePath("/media"), false);
});
