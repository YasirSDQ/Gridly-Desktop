async function test() {
  const url = `http://127.0.0.1:3000/api/rc/operations/copyfile`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ srcFs: 'Y:', srcRemote: '20201220_130308.mp4', dstFs: '2:', dstRemote: '20201220_130308.mp4', _async: true })
  });
  console.log('Status:', res.status);
  console.log('Body:', await res.text());
}
test();
