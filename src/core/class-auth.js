/* Verified teacher/guardian sign-in for cloud class sync. A local parent PIN
   remains a screen lock only; the server always verifies Firebase ID tokens.
   Credentials are never saved in Takhti's profile/localStorage. */
let CLASS_AUTH = { token:'',email:'',role:'',classes:[],expires:0,apiKey:'',loading:false,error:'' };
async function classAuthConfig(){
  if(CLASS_AUTH.apiKey) return CLASS_AUTH.apiKey;
  const r=await fetch('/api/auth-config',{cache:'no-store'});
  if(!r.ok) throw new Error('Sign-in is unavailable');
  const d=await r.json();
  if(!d.enabled || !d.apiKey) throw new Error('School accounts are not configured');
  CLASS_AUTH.apiKey=d.apiKey;
  return d.apiKey;
}
async function classAuthSignIn(){
  if(CLASS_AUTH.loading) return;
  const email=String(document.getElementById('classEmail')?.value||'').trim();
  const password=String(document.getElementById('classPassword')?.value||'');
  if(!email || !password){CLASS_AUTH.error='Enter your account email and password';render();return;}
  CLASS_AUTH.loading=true;CLASS_AUTH.error='';
  try{
    const key=await classAuthConfig();
    const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+encodeURIComponent(key),{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
    const d=await r.json();
    if(!r.ok || !d.idToken) throw new Error('Could not sign in. Check your account details or ask your school administrator.');
    const roleResponse=await fetch('/api/class-identity',{headers:{Authorization:'Bearer '+d.idToken},cache:'no-store'});
    const role=await roleResponse.json();
    if(!roleResponse.ok || !['teacher','guardian'].includes(role.role)) throw new Error(role.error||'Your school has not approved this account');
    CLASS_AUTH.token=d.idToken; CLASS_AUTH.email=d.email||email; CLASS_AUTH.role=role.role; CLASS_AUTH.classes=role.classes||[];
    CLASS_AUTH.expires=Date.now()+Math.max(0,Number(d.expiresIn)||3600)*1000;
  }catch(e){CLASS_AUTH.error=e.message||'Sign-in unavailable';}
  finally{CLASS_AUTH.loading=false;render();}
}
function classAuthSignOut(){CLASS_AUTH={token:'',email:'',role:'',classes:[],expires:0,apiKey:CLASS_AUTH.apiKey,loading:false,error:''};render();}
function classAuthToken(){return CLASS_AUTH.token && Date.now()+10000<CLASS_AUTH.expires?CLASS_AUTH.token:null;}
function classAuthHTML(){
  if(classAuthToken()) return '<div class="paper"><b>'+attr(CLASS_AUTH.role)+' account: '+attr(CLASS_AUTH.email)+'</b><p class="muted">Verified access is checked by the school server for every class request.</p><button class="btn ghost" onclick="classAuthSignOut()">Sign out</button></div>';
  return '<div class="paper"><b>School / guardian sign-in</b><p class="muted">Required for secure class syncing. The local parent PIN is not a school login.</p>'+
    '<input class="input" id="classEmail" type="email" autocomplete="username" placeholder="Account email">'+
    '<input class="input" id="classPassword" type="password" autocomplete="current-password" placeholder="Password">'+
    '<button class="btn" onclick="classAuthSignIn()">Sign in</button>'+
    (CLASS_AUTH.error?'<p class="retry">'+attr(CLASS_AUTH.error)+'</p>':'')+'</div>';
}
