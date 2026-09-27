// Signs in to the admin the way staff do: email + password → emailed code (returned as devCode locally) → PIN.
export const TEST_PIN = '135790';
export const LOCAL_PIN = '246810';
export async function adminLogin(post, email, password, pin = email === 'admin@cnm.local' ? LOCAL_PIN : TEST_PIN) {
  const a = await post('/api/admin/login', { email, password });
  if (a.status !== 200) return a;
  const b = await post('/api/admin/login/otp', { code: a.data.devCode }, a.cookie);
  if (b.status !== 200) return b;
  return post('/api/admin/login/pin', { pin }, b.cookie);
}
