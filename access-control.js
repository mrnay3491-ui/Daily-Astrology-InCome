// Online access gate. Access control codes live in Supabase PostgreSQL, not GitHub.
// NOTE: the original business ledger still uses device-local browser storage.
// Supabase client loaded after checking project configuration.

const gate=document.getElementById('dab-gate');
const gateMessage=document.getElementById('dab-message');
const gateUser=document.getElementById('dab-user-section');
const gateAdmin=document.getElementById('dab-admin-section');
const adminPanel=document.getElementById('dab-admin-panel');
const adminButton=document.getElementById('dab-admin-button');
const logoutButton=document.getElementById('dab-logout-button');
const adminMessage=document.getElementById('dab-admin-message');
const codeList=document.getElementById('dab-code-list');
const codeResult=document.getElementById('dab-new-code');
let client=null,activeUser=null,activeRole=null,pollBusy=false;

function message(text,isError=false){gateMessage.textContent=text;gateMessage.classList.toggle('dab-error',isError);}
function uiMode(mode){gateUser.hidden=mode!=='user';gateAdmin.hidden=mode!=='admin';}
function setAdminMessage(text,error=false){adminMessage.textContent=text;adminMessage.classList.toggle('dab-error',error);}
function lock(reason='Admin ထံမှ Access Code တောင်းယူပါ။'){
  document.body.classList.add('dab-locked');
  adminPanel.hidden=true;adminButton.hidden=true;logoutButton.hidden=true;
  window.dabCloseApp?.();
  activeRole=null;
  uiMode('user');
  message(reason);
}
function unlock(user,role){
  activeUser=user;activeRole=role;
  window.dabOpenApp?.({userId:user.id,role});
  document.body.classList.remove('dab-locked');
  adminButton.hidden=role!=='admin';logoutButton.hidden=role!=='admin';
  gate.hidden=true;
  if(role==='admin')setAdminMessage('Access Code ထုတ်ပေးနိုင်ပါပြီ။');
}
function setupError(){
  lock('Supabase ချိတ်ဆက်မှု မသတ်မှတ်ရသေးပါ။ Owner က supabase-config.js ကို ပြင်ဆင်ပြီး Supabase SQL Setup လုပ်ပေးရပါမယ်။');
  document.getElementById('dab-user-code').disabled=true;
  document.querySelector('#dab-user-form button[type=submit]').disabled=true;
  document.getElementById('dab-admin-email').disabled=true;
  document.getElementById('dab-admin-password').disabled=true;
  document.querySelector('#dab-admin-form button[type=submit]').disabled=true;
}
const url=(window.DAB_SUPABASE_URL||'').trim();
const key=(window.DAB_SUPABASE_ANON_KEY||'').trim();
if(!url.startsWith('https://')||!key||key.includes('PASTE_')||url.includes('PASTE_')){
  setupError();
}else{
  try {
    const sdk=await import('https://esm.sh/@supabase/supabase-js@2');
    client=sdk.createClient(url,key,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}});
  }catch(e){setupError();message('Supabase Library မဖွင့်နိုင်ပါ။ အင်တာနက်စစ်ပြီး Refresh လုပ်ပါ။',true);}
}
async function status(){
  if(!client)throw new Error('Supabase မချိတ်ထားပါ');
  const {data,error}=await client.rpc('dab_access_status');
  if(error)throw error;
  return data;
}
async function checkStatus(){
  if(pollBusy||!client||!activeUser)return;
  pollBusy=true;
  try {
    const {data:{user},error}=await client.auth.getUser();
    if(error||!user)throw new Error('Login သက်တမ်းကုန်ဆုံးပါပြီ');
    const result=await status();
    if(!result?.ok){gate.hidden=false;lock(result?.reason||'အသုံးပြုခွင့်မရှိပါ');}
  }catch(error){gate.hidden=false;lock('Online ချိတ်ဆက်ပြီး Access Code ကို ပြန်စစ်ဆေးရန်လိုအပ်ပါသည်။');}
  finally{pollBusy=false;}
}
async function initialize(){
  if(!client)return;
  message('အကောင့်/Access Code စစ်ဆေးနေပါသည်…');
  try{
    const {data:{user},error}=await client.auth.getUser();
    if(error||!user){lock();return;}
    activeUser=user;
    const s=await status();
    if(s?.ok){unlock(user,s.role);return;}
    lock(s?.reason||'Admin ထံမှ Access Code တောင်းယူပါ။');
    // An unapproved *permanent* account may be an Admin who hasn't been assigned yet.
    if(!user.is_anonymous)uiMode('admin');
  }catch(e){lock('Online မရှိပါ / Server ချိတ်မရပါ။ အင်တာနက်ဖွင့်ပြီး ပြန်ကြိုးစားပါ။');}
}

document.getElementById('dab-switch-admin').addEventListener('click',()=>{uiMode('admin');message('Admin Email နှင့် Password ဖြင့် ဝင်ပါ။');});
document.getElementById('dab-switch-user').addEventListener('click',()=>{uiMode('user');message('Admin ထုတ်ပေးသော Access Code ကို ဖြည့်ပါ။');});
document.getElementById('dab-user-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!client)return;
  const btn=e.submitter||e.currentTarget.querySelector('button[type=submit]');btn.disabled=true;
  message('Code စစ်ဆေးနေပါသည်…');
  try{
    let {data:{user}}=await client.auth.getUser();
    if(!user||!user.is_anonymous){
      if(user)await client.auth.signOut({scope:'local'});
      const created=await client.auth.signInAnonymously();
      if(created.error)throw created.error;
      user=created.data.user;
    }
    const input=document.getElementById('dab-user-code');
    const {data,error}=await client.rpc('dab_redeem_code',{p_code:input.value.trim()});
    if(error)throw error;
    if(!data?.ok)throw new Error(data?.reason||'Code မမှန်ပါ');
    input.value='';unlock(user,'user');
  }catch(error){message('ဝင်မရပါ — '+(error?.message||String(error)),true);}
  finally{btn.disabled=false;}
});
document.getElementById('dab-admin-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!client)return;
  const btn=e.submitter||e.currentTarget.querySelector('button[type=submit]');btn.disabled=true;
  message('Admin Login စစ်ဆေးနေပါသည်…');
  try{
    const email=document.getElementById('dab-admin-email').value.trim();
    const password=document.getElementById('dab-admin-password').value;
    const {data,error}=await client.auth.signInWithPassword({email,password});
    document.getElementById('dab-admin-password').value='';
    if(error)throw error;
    const s=await status();
    if(!s?.ok||s.role!=='admin'){
      await client.auth.signOut({scope:'local'});
      throw new Error('ဤ Account ကို Admin ခွင့်မပြုထားပါ');
    }
    unlock(data.user,'admin');
    await openAdminPanel();
  }catch(error){message('Admin Login မအောင်မြင်ပါ — '+(error?.message||String(error)),true);}
  finally{btn.disabled=false;}
});
logoutButton.addEventListener('click',async()=>{
  if(!confirm('App မှ ထွက်မည်လား?'))return;
  if(client)try{await client.auth.signOut({scope:'local'});}catch(e){}
  activeUser=null;activeRole=null;gate.hidden=false;lock('Logout ပြီးပါပြီ။ Admin Code ရှိသူသာ ပြန်ဝင်နိုင်ပါသည်။');
});

async function openAdminPanel(){
  if(activeRole!=='admin')return;
  adminPanel.hidden=false;await refreshCodes();
}
adminButton.addEventListener('click',openAdminPanel);
document.getElementById('dab-close-admin').addEventListener('click',()=>{adminPanel.hidden=true;});
function textSafe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function dateText(s){return s?new Date(s).toLocaleDateString('en-GB'):'သက်တမ်းမကုန်';}
async function refreshCodes(){
  if(!client||activeRole!=='admin')return;
  codeList.textContent='စာရင်းဖတ်နေပါသည်…';
  const {data,error}=await client.rpc('dab_admin_list_codes');
  if(error){codeList.textContent='စာရင်းမရပါ: '+error.message;return;}
  if(!data?.length){codeList.textContent='Code မရှိသေးပါ';return;}
  codeList.innerHTML=data.map(x=>`<div class="dab-license-row">
    <div><b>${textSafe(x.label||'Unnamed')}</b><small>ထုတ်ထားသည့်နေ့ ${dateText(x.created_at)} · သက်တမ်း ${dateText(x.expires_at)}<br>သုံးထားသောဖုန်း ${Number(x.used_devices)||0}/${Number(x.max_devices)||1} · ${x.revoked?'ပိတ်ထား':'ဖွင့်ထား'}</small></div>
    <div class="dab-license-actions">
      <button type="button" data-license-id="${x.id}" data-operation="${x.revoked?'restore':'revoke'}" class="dab-small">${x.revoked?'ပြန်ဖွင့်':'ပိတ်မည်'}</button>
      <button type="button" data-license-id="${x.id}" data-operation="reset" class="dab-small">ဖုန်းနေရာလွတ်စေ</button>
    </div></div>`).join('');
}
document.getElementById('dab-admin-refresh').addEventListener('click',refreshCodes);
document.getElementById('dab-create-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!client||activeRole!=='admin')return;
  const btn=e.submitter||e.currentTarget.querySelector('button[type=submit]');btn.disabled=true;
  const label=document.getElementById('dab-code-label').value.trim();
  const days=Number(document.getElementById('dab-code-days').value);
  const maxDevices=Number(document.getElementById('dab-code-devices').value);
  setAdminMessage('Code ထုတ်နေပါသည်…');
  try{
    const {data,error}=await client.rpc('dab_admin_create_code',{p_label:label,p_days:days,p_max_devices:maxDevices});
    if(error)throw error;
    codeResult.hidden=false;
    document.getElementById('dab-created-code').textContent=data.code;
    setAdminMessage('Code ထုတ်ပြီးပါပြီ။ အောက်က Code ကို ချက်ချင်း Copy/သိမ်းထားပါ — နောက်မှ ပြန်ဖော်ကြည့်လို့မရပါ။');
    await refreshCodes();
  }catch(error){setAdminMessage(error?.message||'Code မထုတ်နိုင်ပါ',true)}
  finally{btn.disabled=false;}
});
document.getElementById('dab-copy-code').addEventListener('click',async()=>{
  const value=document.getElementById('dab-created-code').textContent;
  try{await navigator.clipboard.writeText(value);setAdminMessage('Code ကို Copy ကူးပြီးပါပြီ။')}
  catch(e){setAdminMessage('Copy မရပါ။ Code စာသားကို ဖိပြီး Select → Copy လုပ်ပါ။',true)}
});
codeList.addEventListener('click',async e=>{
  const button=e.target.closest('button[data-operation]');if(!button||activeRole!=='admin')return;
  const id=button.dataset.licenseId,op=button.dataset.operation;
  const promptText=op==='reset'?'ဒီ Code ကို အရင်ဖုန်းတွေကနေ အသုံးမပြုနိုင်တော့အောင် ဖုန်းစာရင်း Reset လုပ်မည်လား?':op==='revoke'?'ဒီ Code ကို ပိတ်မည်လား?':'ဒီ Code ကို ပြန်ဖွင့်မည်လား?';
  if(!confirm(promptText))return;
  button.disabled=true;
  try{
    const name=op==='reset'?'dab_admin_reset_devices':'dab_admin_set_revoked';
    const args=op==='reset'?{p_id:id}:{p_id:id,p_revoked:op==='revoke'};
    const {error}=await client.rpc(name,args);
    if(error)throw error;
    setAdminMessage('အောင်မြင်ပါပြီ။ App ဖွင့်ထားသူများကို နောက်တစ်ကြိမ် Online စစ်ဆေးချိန်တွင် သက်ရောက်ပါမယ်။');
    await refreshCodes();
  }catch(error){setAdminMessage(error?.message||'မလုပ်နိုင်ပါ',true)}
  finally{button.disabled=false;}
});
// Validate existing access on startup and again every 2 minutes / when returning to the app.
setInterval(checkStatus,120000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkStatus();});
window.addEventListener('online',checkStatus);
await initialize();
