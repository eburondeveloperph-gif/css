import fetch from 'node-fetch';
async function run() {
  const res = await fetch('https://gowa-7c8k.srv909561.hstgr.cloud/api/docs.json', { headers: { 'Authorization': 'Basic YWRtaW46MTIwMjIx' }});
  console.log(await res.text());
}
run();
