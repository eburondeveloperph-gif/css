async function run() {
  const gowaUrl = 'https://gowa-7c8k.srv909561.hstgr.cloud';
  const hdrs = { 'Authorization': 'Basic YWRtaW46MTIwMjIx', 'Content-Type': 'application/json', 'Host': 'srv909561.hstgr.cloud', 'X-Device-Id': '2754b6f1-dbc8-46ae-8d35-e5ed7853c4f3' };
  
  const endpoints = ['/message/sendText', '/send/message', '/message/text', '/send/message/text'];
  for (const ep of endpoints) {
      let res = await fetch(gowaUrl + ep, { headers: hdrs, method: 'POST', body: JSON.stringify({phone: '123', text: 'test'}) });
      console.log('POST', ep, res.status, await res.text());
  }
}
run();
