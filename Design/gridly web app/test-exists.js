async function test() {
  const url = `http://127.0.0.1:3000/api/rc/operations/copyfile`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ srcFs: 'local:', srcRemote: 'package.json', dstFs: 'local:', dstRemote: 'package.json', _async: true })
  });
  console.log('Status:', res.status);
  console.log('Body:', await res.text());
}
test();
